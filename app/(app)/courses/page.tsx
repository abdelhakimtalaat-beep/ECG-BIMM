'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, ExternalLink, GraduationCap, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/client';
import { videoSrc } from '@/lib/video';

interface Session { id?: string; title: string; video_url: string | null }
interface Course { id: string; title: string; instructor: string | null; description: string | null; video_url: string | null; server_path: string | null; sessions: Session[] }

export default function CoursesPage() {
  const { me } = useApp(); const toast = useToast(); const admin = me.role === 'admin';
  const [courses, setCourses] = useState<Course[] | null>(null); const [sel, setSel] = useState<string | null>(null); const [idx, setIdx] = useState(0);
  const [edit, setEdit] = useState<Course | 'new' | null>(null); const [del, setDel] = useState<Course | null>(null);
  const load = useCallback(async (keep?: string) => {
    try { const r = await api<{ courses: Course[] }>('/api/courses'); setCourses(r.courses); setSel((cur) => keep ?? (r.courses.some((c) => c.id === cur) ? cur : r.courses[0]?.id ?? null)); }
    catch (e: any) { toast(e.message, 'err'); setCourses([]); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const course = useMemo(() => courses?.find((c) => c.id === sel) ?? null, [courses, sel]);
  useEffect(() => { setIdx(0); }, [sel]);
  const session = course?.sessions[idx] ?? null;
  const link = session?.video_url || course?.video_url || null; const src = videoSrc(link);
  const copyPath = async () => { try { await navigator.clipboard.writeText(course!.server_path!); toast('Path copied'); } catch { toast('Could not copy. Select the path and copy it.', 'err'); } };

  return (
    <div className="space-y-4">
      <PageHeader title="Internal Courses" subtitle="Training › Internal Courses" actions={admin ? <button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Plus size={14} />New course</button> : undefined} />
      {courses === null ? <Spinner /> : !courses.length ? <Empty title="No courses yet" hint={admin ? 'Press “New course” to add the first one.' : 'The Administrator has not added any course yet.'} /> : <>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Courses">
          {courses.map((c) => <button key={c.id} role="tab" aria-selected={c.id === sel} onClick={() => setSel(c.id)} className={`rounded-lg border px-3 py-1.5 text-sm ${c.id === sel ? 'border-brand-600 bg-brand-50 font-semibold text-brand-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{c.title}</button>)}
        </div>
        {course && <div className="card overflow-hidden rounded-2xl border-2 border-slate-300 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="relative aspect-video overflow-hidden rounded-3xl border-2 border-slate-400 bg-slate-900" aria-label="Video screen">
                {!src ? <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300"><Play size={40} /><p className="text-sm">{link ? 'This link cannot be shown here' : 'No video link has been added yet'}</p></div>
                  : src.kind === 'file' ? <video key={src.src} className="h-full w-full" src={src.src} controls autoPlay={false} playsInline />
                  : <iframe key={src.src} className="h-full w-full" src={src.src} title={session?.title || course.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="no-referrer" />}
              </div>
              {src && <p className="mt-2 text-xs text-slate-500">Video does not play? <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href={src.open} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} />Open it in a new tab</a></p>}
            </div>
            <aside className="min-w-0">
              <h2 className="border-b-2 border-slate-700 pb-1 text-xl font-semibold text-brand-900">{course.title}</h2>
              <p className="mt-2 border-b border-slate-300 pb-1 text-sm text-slate-700"><span className="text-slate-500">Instructor: </span><b>{course.instructor || '—'}</b></p>
              {course.description && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{course.description}</p>}
              <ol className="mt-3 space-y-1" aria-label="Sessions">
                {course.sessions.map((s, i) => <li key={s.id ?? i}><button onClick={() => setIdx(i)} aria-current={i === idx} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === idx ? 'bg-brand-50 font-semibold text-brand-900' : 'text-slate-700 hover:bg-slate-100'}`}><span className="w-6 shrink-0 text-slate-500">{i + 1}-</span><span className="min-w-0 flex-1 truncate">{s.title}</span>{i === idx && <Play size={12} className="shrink-0" />}</button></li>)}
                {!course.sessions.length && <li className="text-sm text-slate-500">No sessions yet.</li>}
              </ol>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-medium text-slate-500">Course path on the ECG Server</p>
                {course.server_path ? <div className="mt-1 flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-xs text-slate-800" dir="ltr">{course.server_path}</code><button className="btn-ghost btn-sm" onClick={copyPath} aria-label="Copy path" title="Copy path"><Copy size={14} /></button></div> : <p className="text-xs text-slate-400">Not set</p>}
              </div>
              {admin && <div className="mt-3 flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setEdit(course)}><Pencil size={14} />Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(course)}><Trash2 size={14} />Delete</button></div>}
            </aside>
          </div>
        </div>}
      </>}
      {edit && <CourseModal course={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={async (id) => { setEdit(null); await load(id); }} />}
      <Confirm open={!!del} danger title="Delete course" message={<>Delete <b>{del?.title}</b> and its {del?.sessions.length ?? 0} sessions? The videos themselves are not touched.</>} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={async () => { try { await api(`/api/courses/${del!.id}`, { method: 'DELETE' }); toast('Course deleted'); setDel(null); setSel(null); await load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>
  );
}

function CourseModal({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: course?.title ?? '', instructor: course?.instructor ?? '', description: course?.description ?? '', video_url: course?.video_url ?? '', server_path: course?.server_path ?? '' });
  const [ss, setSs] = useState<Session[]>(course?.sessions.map((s) => ({ title: s.title, video_url: s.video_url ?? '' })) ?? [{ title: 'Session 01', video_url: '' }]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const move = (i: number, d: number) => setSs((a) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const add = () => setSs((a) => [...a, { title: `Session ${String(a.length + 1).padStart(2, '0')}`, video_url: '' }]);
  const save = async () => {
    if (f.title.trim().length < 2) { toast('Enter the course title', 'err'); return; }
    setBusy(true);
    try {
      const body = { ...f, sessions: ss.filter((s) => s.title.trim()).map((s) => ({ title: s.title, video_url: s.video_url || null })) };
      const r = course ? await api<{ id?: string }>(`/api/courses/${course.id}`, { method: 'PUT', body }) : await api<{ id: string }>('/api/courses', { method: 'POST', body });
      toast('Course saved'); onSaved(course?.id ?? (r as any).id);
    } catch (e: any) { toast(e.message, 'err'); setBusy(false); }
  };
  return <Modal open wide onClose={onClose} title={course ? 'Edit course' : 'New course'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Save</button></>}>
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course title"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} autoFocus /></Field>
        <Field label="Instructor"><input className="input" value={f.instructor} onChange={(e) => set('instructor', e.target.value)} maxLength={200} /></Field>
      </div>
      <Field label="Course path on the ECG Server" hint="For example \\\\ECG-SERVER\\Training\\Revit Basics. Shown with a Copy button; browsers cannot open server folders directly."><input className="input" dir="ltr" value={f.server_path} onChange={(e) => set('server_path', e.target.value)} maxLength={500} /></Field>
      <Field label="Course video link (used for sessions that have no link of their own)" hint="A direct video file (.mp4), YouTube, Vimeo, Google Drive or any web page that allows embedding."><input className="input" dir="ltr" value={f.video_url} onChange={(e) => set('video_url', e.target.value)} placeholder="https://" maxLength={1000} /></Field>
      <Field label="Description (optional)"><textarea className="input min-h-[60px]" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} /></Field>
      <div>
        <p className="label">Sessions</p>
        <ul className="space-y-2">
          {ss.map((s, i) => <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2"><span className="text-sm text-slate-500">{i + 1}-</span>
            <input className="input" aria-label={`Session ${i + 1} title`} value={s.title} onChange={(e) => setSs((a) => a.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={200} />
            <input className="input" dir="ltr" aria-label={`Session ${i + 1} video link`} placeholder="Video link https://" value={s.video_url ?? ''} onChange={(e) => setSs((a) => a.map((x, j) => (j === i ? { ...x, video_url: e.target.value } : x)))} maxLength={1000} />
            <span className="flex"><button type="button" className="btn-ghost btn-sm" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={14} /></button><button type="button" className="btn-ghost btn-sm" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={14} /></button><button type="button" className="btn-ghost btn-sm text-red-600" aria-label="Remove session" onClick={() => setSs((a) => a.filter((_, j) => j !== i))}><Trash2 size={14} /></button></span></li>)}
        </ul>
        <button type="button" className="btn-secondary btn-sm mt-2" onClick={add}><Plus size={14} />Add session</button>
      </div>
    </div>
  </Modal>;
}
