'use strict';
// حسابات لوحة التحكم والوجبات والنقل والتقارير — تتم في المتصفح على بيانات رجعت من قاعدة البيانات بعد تطبيق صلاحيات المستخدم
const Compute = (() => {
  const ROLE_LABELS = { admin: 'مدير النظام', event_manager: 'مدير المناسبة', building_supervisor: 'مشرف المبنى', transport: 'مسؤول النقل', catering: 'مسؤول الإعاشة', country_supervisor: 'مشرف دولة' };
  const CAT_LABELS = { individual: 'فرد', family_head: 'رب أسرة', family_member: 'تابع لأسرة', group_member: 'عضو في فوج' };
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const eachDay = (from, to) => { const o = []; for (let d = from; d < to; d = addDays(d, 1)) { o.push(d); if (o.length > 800) break; } return o; };
  const eachDayIncl = (from, to) => eachDay(from, addDays(to, 1));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const HOUSERS = ['admin', 'event_manager', 'building_supervisor'], TRANSPORTERS = ['admin', 'event_manager', 'transport'], MEAL_ROLES = ['admin', 'event_manager', 'catering'], MEALS = ['breakfast', 'lunch', 'dinner'];
  const forbid = () => Object.assign(new Error('لا تملك صلاحية لتنفيذ هذا الإجراء'), { status: 403, data: {} });
  const notFound = m => Object.assign(new Error(m || 'غير موجود'), { status: 404, data: {} });

  function roomState(r, booked) { if (r.status !== 'active' || r.capacity <= 0) return 'unavailable'; if (booked <= 0) return 'free'; return booked >= r.capacity ? 'full' : 'partial'; }

  const loadVisitors = (rpc, q) => rpc('GET', '/visitors', q).then(r => r.visitors);

  // ----- النقل -----
  async function transportData(rpc, eventId, date) {
    const r = await rpc('GET', '/transports', { event_id: eventId, date });
    return r;
  }
  function transportDay(visitors, tasks, drivers, date) {
    const need = kind => {
      const col = kind === 'pickup' ? 'arrival_date' : 'departure_date';
      const vs = visitors.filter(v => v.needs_transport && v[col] === date);
      const covered = v => tasks.some(t => t.kind === kind && (t.visitor_id === v.id || (v.head_id && t.visitor_id === v.head_id) || (v.group_id && t.group_id === v.group_id)));
      return { persons: vs.length, unassigned: vs.filter(v => !covered(v)).map(v => ({ id: v.id, full_name: v.full_name, head_id: v.head_id, group_id: v.group_id, arrival_time: v.arrival_time, airport: v.airport, flight_no: v.flight_no, airline: v.airline, country_name: v.country_name })) };
    };
    const pick = need('pickup'), drop = need('dropoff'); const used = new Set(tasks.map(t => t.driver_id));
    return { date, tasks, need_pickup: pick.persons, need_dropoff: drop.persons, unassigned_pickup: pick.unassigned, unassigned_dropoff: drop.unassigned,
      assigned_passengers: tasks.reduce((a, t) => a + t.passengers, 0), fleet_capacity: drivers.reduce((a, d) => a + d.capacity, 0), fleet_cars: drivers.length, cars_used: used.size, free_drivers: drivers.filter(d => !used.has(d.id)).length };
  }
  async function transportDaily(rpc, q) {
    const date = isDate(q.date) ? q.date : today();
    const [vs, t] = await Promise.all([loadVisitors(rpc, { event_id: q.event_id }), transportData(rpc, q.event_id, date)]);
    return transportDay(vs, t.tasks, t.drivers, date);
  }
  async function transportSummary(rpc, q) {
    const [vs, t] = await Promise.all([loadVisitors(rpc, { event_id: q.event_id }), transportData(rpc, q.event_id)]);
    const dates = new Set(); vs.filter(v => v.needs_transport).forEach(v => { if (v.arrival_date) dates.add(v.arrival_date); if (v.departure_date) dates.add(v.departure_date); });
    t.tasks.forEach(x => dates.add(x.task_date));
    return { days: [...dates].sort().map(d => { const x = transportDay(vs, t.tasks.filter(k => k.task_date === d), t.drivers, d); return { date: d, need_pickup: x.need_pickup, need_dropoff: x.need_dropoff, assigned: x.assigned_passengers, fleet_capacity: x.fleet_capacity, unassigned: x.unassigned_pickup.length + x.unassigned_dropoff.length, tasks: x.tasks.length }; }) };
  }

  // ----- الوجبات -----
  async function mealsData(rpc, ev) {
    const [all, ex] = await Promise.all([loadVisitors(rpc, { event_id: ev.id }), rpc('GET', '/exclusions', { event_id: ev.id })]);
    const vs = all.filter(v => v.arrival_date); const exc = new Map();
    ex.exclusions.forEach(e => { if (!exc.has(e.visitor_id)) exc.set(e.visitor_id, new Set()); exc.get(e.visitor_id).add(e.date + '|' + e.meal); });
    let min = ev.start_date, max = ev.end_date;
    for (const v of vs) { if (v.arrival_date < min) min = v.arrival_date; const e = v.departure_date || ev.end_date; if (e > max) max = e; }
    const days = {}; for (const d of eachDayIncl(min, max)) days[d] = { date: d, residents: 0, breakfast: 0, lunch: 0, dinner: 0, total: 0, people: [] };
    for (const v of vs) {
      const end = v.departure_date || ev.end_date; const x = exc.get(v.id) || new Set();
      for (const d of eachDayIncl(v.arrival_date, end < v.arrival_date ? v.arrival_date : end)) {
        const day = days[d]; if (!day) continue; day.residents++;
        const has = {}; for (const m of MEALS) { has[m] = !(x.has(d + '|' + m) || x.has('*|' + m)); if (has[m]) { day[m]++; day.total++; } }
        day.people.push({ id: v.id, full_name: v.full_name, country_name: v.country_name, diet_notes: v.diet_notes, has, star: Object.fromEntries(MEALS.map(m => [m, x.has('*|' + m)])) });
      }
    }
    return days;
  }
  const stripPeople = ({ people, ...d }) => d;

  // ----- لوحة التحكم -----
  async function dashboard(rpc, u, q) {
    const ev = (await rpc('GET', '/events', {})).events.find(e => e.id === +q.event_id); if (!ev) throw Object.assign(new Error('يجب اختيار مناسبة صحيحة'), { status: 400, data: {} });
    const date = isDate(q.date) ? q.date : today();
    const vs = u.role === 'building_supervisor' ? [] : await loadVisitors(rpc, { event_id: ev.id });
    const countAt = f => vs.filter(f).length; const out = { event: ev, date, role: u.role };
    const countries = {}; vs.forEach(v => { countries[v.country_name] = (countries[v.country_name] || 0) + 1; });
    out.visitors = { total: vs.length, individuals: countAt(v => v.category === 'individual'), families: countAt(v => v.category === 'family_head'), family_members: countAt(v => v.category === 'family_member'),
      group_members: countAt(v => v.category === 'group_member'), countries: Object.keys(countries).length,
      present: countAt(v => v.arrival_date && v.arrival_date <= date && (!v.departure_date || v.departure_date >= date)), arriving: countAt(v => v.arrival_date === date), departing: countAt(v => v.departure_date === date),
      unhoused: countAt(v => !v.bookings.length), incomplete: countAt(v => !v.arrival_date || !v.departure_date) };
    out.by_country = Object.entries(countries).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    const flow = {}; for (const d of eachDayIncl(ev.start_date, ev.end_date)) flow[d] = { date: d, arrivals: 0, departures: 0 };
    vs.forEach(v => { if (v.arrival_date) (flow[v.arrival_date] ||= { date: v.arrival_date, arrivals: 0, departures: 0 }).arrivals++; if (v.departure_date) (flow[v.departure_date] ||= { date: v.departure_date, arrivals: 0, departures: 0 }).departures++; });
    out.flow = Object.values(flow).sort((a, b) => a.date.localeCompare(b.date));
    if (HOUSERS.includes(u.role)) out.rooms = await roomStats(rpc, date);
    if (u.role === 'country_supervisor') out.mine = { housed: vs.filter(v => v.bookings.length).length, unhoused: vs.filter(v => !v.bookings.length).length, with_driver: vs.filter(v => v.transports.length).length };
    if (TRANSPORTERS.includes(u.role)) {
      const tt = await transportData(rpc, ev.id, date); const t = transportDay(vs, tt.tasks, tt.drivers, date); const maxCap = Math.max(0, ...tt.drivers.map(d => d.capacity));
      out.transport = { need_pickup: t.need_pickup, need_dropoff: t.need_dropoff, assigned_passengers: t.assigned_passengers, fleet_capacity: t.fleet_capacity,
        cars_required: maxCap ? Math.ceil((t.need_pickup + t.need_dropoff) / maxCap) : null, free_drivers: t.free_drivers, fleet_cars: t.fleet_cars, unassigned: t.unassigned_pickup.length + t.unassigned_dropoff.length };
    }
    if (MEAL_ROLES.includes(u.role)) { const days = await mealsData(rpc, ev); out.meals_today = stripPeople(days[date] || { date, residents: 0, breakfast: 0, lunch: 0, dinner: 0, total: 0 }); out.meals_flow = Object.values(days).map(stripPeople); }
    return out;
  }
  async function roomStats(rpc, date) {
    const rooms = (await rpc('GET', '/room-stats', { date })).rooms; const st = { free: 0, partial: 0, full: 0, unavailable: 0 }; const byB = {}; let cap = 0, booked = 0;
    for (const r of rooms) {
      const n = r.booked; st[roomState(r, n)]++;
      const b = byB[r.building_id] || (byB[r.building_id] = { name: r.building_name, capacity: 0, booked: 0 });
      if (r.status === 'active') { b.capacity += r.capacity; b.booked += n; cap += r.capacity; booked += n; }
    }
    return { rooms_total: rooms.length, rooms_booked: st.partial + st.full, rooms_available: st.free + st.partial, rooms_state: st, capacity: cap, booked_places: booked, occupancy_pct: cap ? Math.round(booked * 100 / cap) : 0,
      by_building: Object.values(byB).map(b => ({ ...b, pct: b.capacity ? Math.round(b.booked * 100 / b.capacity) : 0 })) };
  }

  // ----- التقارير -----
  // مدى التواريخ: date_from / date_to (أيٌّ منهما اختياري؛ بدونهما = كل أيام المناسبة). q.date يبقى للتوافق (يوم واحد)
  const range = q => { let f = isDate(q.date_from) ? q.date_from : '', t = isDate(q.date_to) ? q.date_to : ''; if (isDate(q.date)) { f = f || q.date; t = t || q.date; } if (f && t && f > t) [f, t] = [t, f]; return { f, t }; };
  const inRange = (d, r) => !!d && (!r.f || d >= r.f) && (!r.t || d <= r.t);
  const rangeText = r => r.f || r.t ? `الفترة: ${r.f || 'بداية المناسبة'} ← ${r.t || 'نهاية المناسبة'}` : 'كل أيام المناسبة';
  const C = (key, label, width = 18) => ({ key, label, width });
  const dayAr = d => ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date(d + 'T00:00:00Z').getUTCDay()];
  const roomText = bs => bs.map(b => `${b.building_name} / ${b.floor_name} / ${b.room_number}`).join('، ');
  const rv = (rpc, q, country) => loadVisitors(rpc, { event_id: q.event_id, country_id: country || q.country_id });
  const REPORTS = {
    visitors_all: { roles: ['admin', 'event_manager', 'country_supervisor', 'transport', 'catering'], title: 'كشف كامل بأسماء الزائرين', async build(rpc, u, q) {
      const cols = [C('i', '#', 5), C('name', 'الاسم', 26), C('country', 'الدولة', 14), C('cat', 'التصنيف', 13), C('rel', 'رب الأسرة / الفوج', 22), C('phone', 'الهاتف', 17), C('ad', 'الوصول', 12), C('at', 'الوقت', 8), C('dd', 'المغادرة', 12), C('dt', 'وقت المغادرة', 10), C('flight', 'الرحلة', 14), C('airport', 'المطار', 14), C('room', 'الغرفة', 28), C('driver', 'السائق', 18), C('notes', 'ملاحظات', 20)];
      const rows = (await rv(rpc, q)).map((v, i) => ({ i: i + 1, name: v.full_name, country: v.country_name, cat: CAT_LABELS[v.category], rel: v.head_name || v.group_name || '', phone: v.phone, ad: v.arrival_date, at: v.arrival_time, dd: v.departure_date, dt: v.departure_time,
        flight: [v.airline, v.flight_no].filter(Boolean).join(' '), airport: v.airport, room: roomText(v.bookings), driver: v.transports.filter(t => t.kind === 'pickup').map(t => `${t.driver_name} (${t.car_number})`).join('، '), notes: [v.diet_notes, v.notes].filter(Boolean).join(' | ') }));
      return { cols, rows };
    } },
    by_country: { roles: ['admin', 'event_manager', 'country_supervisor'], title: 'إحصاء الزائرين حسب الدولة', async build(rpc, u, q) {
      const vs = await rv(rpc, q); const m = {};
      for (const v of vs) { const r = m[v.country_name] ||= { country: v.country_name, total: 0, ind: 0, fam: 0, mem: 0, grp: 0, housed: 0, unhoused: 0 };
        r.total++; if (v.category === 'individual') r.ind++; if (v.category === 'family_head') r.fam++; if (v.category === 'family_member') r.mem++; if (v.category === 'group_member') r.grp++; v.bookings.length ? r.housed++ : r.unhoused++; }
      const rows = Object.values(m).sort((a, b) => b.total - a.total);
      if (rows.length > 1) rows.push(rows.reduce((t, r) => { for (const k of ['total', 'ind', 'fam', 'mem', 'grp', 'housed', 'unhoused']) t[k] += r[k]; return t; }, { country: 'الإجمالي', total: 0, ind: 0, fam: 0, mem: 0, grp: 0, housed: 0, unhoused: 0 }));
      return { cols: [C('country', 'الدولة'), C('total', 'إجمالي الزائرين', 14), C('ind', 'أفراد', 10), C('fam', 'عائلات (أرباب)', 14), C('mem', 'تابعون', 10), C('grp', 'أعضاء أفواج', 12), C('housed', 'تم تسكينهم', 12), C('unhoused', 'لم يُسكنوا', 12)], rows };
    } },
    families_groups: { roles: ['admin', 'event_manager', 'country_supervisor'], title: 'كشف العائلات والأفواج', async build(rpc, u, q) {
      const vs = await rv(rpc, q); const rows = [];
      for (const h of vs.filter(v => v.category === 'family_head')) { const mem = vs.filter(v => v.head_id === h.id);
        rows.push({ type: 'عائلة', name: h.full_name, country: h.country_name, leader: h.full_name, count: 1 + mem.length, ad: h.arrival_date, dd: h.departure_date, rooms: roomText([...h.bookings, ...mem.flatMap(m => m.bookings)].filter((b, i, a) => a.findIndex(x => x.room_id === b.room_id) === i)), members: mem.map(m => m.full_name).join('، ') }); }
      const groups = {}; for (const v of vs.filter(x => x.category === 'group_member')) (groups[v.group_id] ||= []).push(v);
      for (const list of Object.values(groups)) { const f = list[0]; const lead = list.find(x => x.is_leader);
        rows.push({ type: 'فوج', name: f.group_name, country: f.country_name, leader: lead ? lead.full_name : (f.guide_name || ''), count: list.length, ad: f.arrival_date, dd: f.departure_date,
          rooms: roomText(list.flatMap(m => m.bookings).filter((b, i, a) => a.findIndex(x => x.room_id === b.room_id) === i)), members: list.map(m => m.full_name).join('، ') }); }
      return { cols: [C('type', 'النوع', 9), C('name', 'الاسم / الفوج', 24), C('country', 'الدولة', 14), C('leader', 'رب الأسرة / القائد', 22), C('count', 'العدد', 8), C('ad', 'الوصول', 12), C('dd', 'المغادرة', 12), C('rooms', 'الغرف', 34), C('members', 'الأفراد', 44)], rows };
    } },
    arrivals_departures: { roles: ['admin', 'event_manager', 'country_supervisor', 'transport'], title: 'كشف القادمين والمغادرين', async build(rpc, u, q) {
      const vs = await rv(rpc, q); const R = range(q); const rows = [];
      for (const v of vs) {
        if (inRange(v.arrival_date, R)) rows.push({ date: v.arrival_date, type: 'وصول', time: v.arrival_time, name: v.full_name, country: v.country_name, flight: [v.airline, v.flight_no].filter(Boolean).join(' '), airport: v.airport, driver: v.transports.filter(t => t.kind === 'pickup').map(t => t.driver_name).join('، ') });
        if (inRange(v.departure_date, R)) rows.push({ date: v.departure_date, type: 'مغادرة', time: v.departure_time, name: v.full_name, country: v.country_name, flight: '', airport: '', driver: v.transports.filter(t => t.kind === 'dropoff').map(t => t.driver_name).join('، ') });
      }
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.time.localeCompare(b.time));
      return { cols: [C('date', 'التاريخ', 12), C('type', 'النوع', 9), C('time', 'الوقت', 8), C('name', 'الاسم', 26), C('country', 'الدولة', 14), C('flight', 'الرحلة', 18), C('airport', 'المطار', 16), C('driver', 'السائق', 18)], rows, subtitle: rangeText(R) };
    } },
    arrivals_counts: { roles: ['admin', 'event_manager', 'country_supervisor', 'transport'], title: 'القادمون والمغادرون — أعداد حسب اليوم والرحلة', async build(rpc, u, q) {
      const vs = await rv(rpc, q); const R = range(q); const m = new Map();
      const add = (date, flight, airport, k) => { const key = date + '|' + flight + '|' + airport; const r = m.get(key) || { date, flight, airport, arr: 0, dep: 0 }; r[k]++; m.set(key, r); };
      for (const v of vs) {
        if (inRange(v.arrival_date, R)) add(v.arrival_date, [v.airline, v.flight_no].filter(Boolean).join(' ') || 'بدون رحلة', v.airport || '', 'arr');
        if (inRange(v.departure_date, R)) add(v.departure_date, '—', '', 'dep');   // المغادرة لا تُسجَّل لها رحلة، فتُجمع باليوم
      }
      const days = [...new Set([...m.values()].map(r => r.date))].sort(); const rows = []; let A = 0, D = 0;
      for (const d of days) {
        const list = [...m.values()].filter(r => r.date === d).sort((a, b) => (a.flight === '—') - (b.flight === '—') || a.flight.localeCompare(b.flight));
        let sa = 0, sd = 0; for (const r of list) { rows.push({ date: d, day: dayAr(d), flight: r.flight, airport: r.airport, arr: r.arr, dep: r.dep, total: r.arr + r.dep }); sa += r.arr; sd += r.dep; }
        rows.push({ date: d, day: '', flight: 'إجمالي اليوم', airport: '', arr: sa, dep: sd, total: sa + sd }); A += sa; D += sd;
      }
      if (days.length) rows.push({ date: 'الإجمالي', day: '', flight: '', airport: '', arr: A, dep: D, total: A + D });
      return { cols: [C('date', 'التاريخ', 13), C('day', 'اليوم', 11), C('flight', 'الرحلة', 22), C('airport', 'المطار', 16), C('arr', 'عدد القادمين', 13), C('dep', 'عدد المغادرين', 13), C('total', 'المجموع', 10)], rows, subtitle: rangeText(R) };
    } },
    housing: { roles: HOUSERS, title: 'كشف تسكين المباني والأدوار', async build(rpc, u, q) {
      let bs = (await rpc('GET', '/bookings', { event_id: q.event_id })).bookings;
      if (q.building_id) bs = bs.filter(b => b.building_id === +q.building_id); if (q.floor_id) bs = bs.filter(b => b.floor_id === +q.floor_id);
      const st = (await rpc('GET', '/structure', {})).buildings; const cap = {}; st.forEach(b => b.floors.forEach(f => f.rooms.forEach(r => (cap[r.id] = r.capacity))));
      const rows = bs.map(b => ({ building: b.building_name, floor: b.floor_name, room: b.room_number, capacity: cap[b.room_id] ?? '', name: b.full_name, country: b.country_name, from_date: b.from_date, to_date: b.to_date }));
      return { cols: [C('building', 'المبنى', 18), C('floor', 'الدور', 14), C('room', 'الغرفة', 9), C('capacity', 'السعة', 8), C('name', 'المقيم', 26), C('country', 'الدولة', 14), C('from_date', 'من', 12), C('to_date', 'إلى', 12)], rows };
    } },
    rooms_status: { roles: HOUSERS, title: 'كشف الغرف المتاحة والمشغولة', async build(rpc, u, q) {
      const date = isDate(q.date) ? q.date : today(); const [st, rs] = await Promise.all([rpc('GET', '/structure', {}), rpc('GET', '/room-stats', { date })]);
      const m = new Map(rs.rooms.map(r => [r.id, r.booked])); const lab = { free: 'متاحة', partial: 'مشغولة جزئياً', full: 'مكتملة', unavailable: 'خارج الخدمة' }; const rows = [];
      for (const b of st.buildings) for (const f of b.floors) for (const r of f.rooms) { const n = m.get(r.id) || 0; rows.push({ building: b.name, floor: f.name, room: r.number, capacity: r.capacity, booked: n, remaining: r.status === 'active' ? Math.max(0, r.capacity - n) : 0, state: lab[roomState(r, n)] }); }
      return { cols: [C('building', 'المبنى', 18), C('floor', 'الدور', 14), C('room', 'الغرفة', 9), C('capacity', 'السعة', 8), C('booked', 'المحجوز', 9), C('remaining', 'المتبقي', 9), C('state', 'الحالة', 16)], rows, subtitle: 'بتاريخ ' + date };
    } },
    drivers_tasks: { roles: TRANSPORTERS, title: 'كشف السائقين ومهامهم', async build(rpc, u, q) {
      const st = { not_started: 'لم يبدأ', on_the_way: 'في الطريق', received: 'تم الاستقبال', done: 'انتهت المهمة' };
      const R = range(q); const rows = (await transportData(rpc, q.event_id, undefined)).tasks.filter(t => !R.f && !R.t || inRange(t.task_date, R)).map(t => ({ driver: t.driver_name, phone: t.driver_phone, car: [t.car_type, t.car_number].filter(Boolean).join(' - '), cap: t.car_capacity, kind: t.kind === 'pickup' ? 'استقبال' : 'توصيل مغادرة', date: t.task_date, time: t.task_time, airport: t.airport, who: t.visitor_name || ('فوج: ' + t.group_name), country: t.country_name, pax: t.passengers, flight: t.flight_info, status: st[t.status] }));
      return { cols: [C('driver', 'السائق', 18), C('phone', 'الهاتف', 16), C('car', 'السيارة', 20), C('cap', 'السعة', 7), C('kind', 'المهمة', 12), C('date', 'التاريخ', 12), C('time', 'الوقت', 8), C('airport', 'المطار', 16), C('who', 'الزائر / الفوج', 24), C('country', 'الدولة', 12), C('pax', 'الركاب', 8), C('flight', 'الرحلة', 16), C('status', 'الحالة', 13)], rows };
    } },
    meals_daily: { roles: MEAL_ROLES, title: 'كشف الوجبات اليومية', async build(rpc, u, q) {
      const ev = (await rpc('GET', '/events', {})).events.find(e => e.id === +q.event_id); const days = Object.values(await mealsData(rpc, ev));
      return { cols: [C('date', 'التاريخ', 13), C('residents', 'عدد المقيمين', 13), C('breakfast', 'الإفطار', 10), C('lunch', 'الغداء', 10), C('dinner', 'العشاء', 10), C('total', 'إجمالي الوجبات', 14)], rows: days.map(stripPeople) };
    } },
    supervisors: { roles: ['admin', 'event_manager'], title: 'كشف مسؤوليات المشرفين', async build(rpc) {
      const us = (await rpc('GET', '/users', {})).users.filter(x => ['building_supervisor', 'country_supervisor'].includes(x.role));
      const rows = us.map(x => ({ name: x.name, role: ROLE_LABELS[x.role], phone: x.phone, scope: x.role === 'country_supervisor' ? 'الدول: ' + x.countries.map(c => c.name).join('، ') : x.floors.map(f => `${f.building_name} / ${f.floor_name}`).join('، '), status: x.status === 'active' ? 'نشط' : 'موقوف', notes: x.notes }));
      return { cols: [C('name', 'الاسم', 22), C('role', 'الصفة', 14), C('phone', 'الهاتف', 16), C('scope', 'المسؤولية', 50), C('status', 'الحالة', 9), C('notes', 'ملاحظات', 24)], rows };
    } },
  };
  async function report(rpc, u, type, q) {
    const def = REPORTS[type]; if (!def) throw notFound('تقرير غير معروف'); if (!def.roles.includes(u.role)) throw forbid();
    const ev = (await rpc('GET', '/events', {})).events.find(e => e.id === +q.event_id); if (!ev) throw Object.assign(new Error('يجب اختيار مناسبة صحيحة'), { status: 400, data: {} });
    const { cols, rows, subtitle } = await def.build(rpc, u, { ...q, event_id: ev.id });
    return { def, ev, cols, rows, subtitle };
  }
  const reportList = u => Object.entries(REPORTS).filter(([, d]) => d.roles.includes(u.role)).map(([k, d]) => ({ key: k, title: d.title }));
  const api = { ROLE_LABELS, CAT_LABELS, dashboard, mealsData, stripPeople, transportDaily, transportSummary, report, reportList, isDate, today };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.Compute = api;
  return api;
})();
