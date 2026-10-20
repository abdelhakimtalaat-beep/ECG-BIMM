#!/usr/bin/env python3
"""Build db/seed.json and db/reconciliation.md from the supplied source files.

Nothing is invented: every value comes from the org chart (.docx), the workbook (.xlsx)
or the transcribed Reel Plan image. Anything cleaned, inferred or inconsistent is logged
as an issue so it is visible in the app (Admin > Data Quality) and in the report.
"""
import json, re, datetime, zipfile, sys
from pathlib import Path
from xml.etree import ElementTree as ET
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source"
issues = []


def issue(sev, kind, entity, msg, **extra):
    issues.append({"severity": sev, "kind": kind, "entity": entity, "message": msg, **extra})


# ---------------------------------------------------------------- org chart
NS = {"dgm": "http://schemas.openxmlformats.org/drawingml/2006/diagram",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def read_org():
    with zipfile.ZipFile(SRC / "BIMM_Organization_Chart.docx") as z:
        root = ET.fromstring(z.read("word/diagrams/data1.xml"))
    pts = {}
    for p in root.find("dgm:ptLst", NS):
        paras = []
        for para in p.iter("{%s}p" % NS["a"]):
            paras.append("".join(t.text or "" for t in para.iter("{%s}t" % NS["a"])))
        pts[p.get("modelId")] = (p.get("type", "node"), paras)
    kids = {}
    for c in root.find("dgm:cxnLst", NS):
        if c.get("type", "parOf") == "parOf":
            kids.setdefault(c.get("srcId"), []).append((int(c.get("srcOrd")), c.get("destId")))
    doc = next(k for k, v in pts.items() if v[0] == "doc")
    out = []

    def parse(paras):
        # Card text is e.g. "BIM Manager (NC)" + "C147-Nesrin Mahmoud | Architect-2002" (paragraph
        # breaks are inconsistent in the source), so work on the joined text.
        txt = " ".join(p.strip() for p in paras if p.strip())
        m = re.match(r"^(?P<title>.+?)\s*\((?P<loc>NC|SV|Alex)\)\s*(?P<rest>.*)$", txt)
        if m:
            title, loc, rest = m["title"].strip(), m["loc"], m["rest"].strip()
        else:
            m2 = re.match(r"^(?P<title>BIM Department Manager)\s*(?P<rest>.*)$", txt)
            title, loc, rest = m2["title"], None, m2["rest"].strip()
        DISC = r"(?P<disc>Architect|Structure|Structural|HVAC|Mechanical|Electrical|Civil|Plumbing|MEP)"
        m3 = re.match(r"^(?:(?P<id>[A-Za-z]?\d[A-Za-z0-9]*)-)?(?P<name>.+?)\s*\|?\s*" + DISC + r"-(?P<year>\d{4})\s*$", rest)
        if not m3:
            raise ValueError(f"Cannot parse org card: {txt!r}")
        return {"raw": txt, "job_title": title, "team_location": loc,
                "employee_id": m3["id"],
                "name": m3["name"].strip(" |"),
                "discipline": m3["disc"],
                "year": int(m3["year"])}

    def walk(pid, parent_idx):
        for _, k in sorted(kids.get(pid, [])):
            rec = parse(pts[k][1])
            rec["reports_to_idx"] = parent_idx
            out.append(rec)
            walk(k, len(out) - 1)
    walk(doc, None)
    return out


# ---------------------------------------------------------------- workbook
def clean_str(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else None


def parse_area(raw_formula, cached, ref):
    """Return (value, note). Only plain numbers (or arithmetic of numbers) are accepted."""
    v = cached if cached is not None else raw_formula
    if v is None:
        return None, None
    if isinstance(v, (int, float)):
        note = "formula result" if isinstance(raw_formula, str) and raw_formula.startswith("=") else None
        return float(v), note
    s = str(v).replace("\xa0", " ").strip()
    if re.fullmatch(r"[\d\s,.]+", s):  # "12 815 ", "26347 "
        num = re.sub(r"[\s,]", "", s)
        try:
            return float(num), f"cleaned from text {raw_formula!r}"
        except ValueError:
            pass
    return None, f"non-numeric text kept as note: {s!r}"


def read_workbook():
    wb_f = openpyxl.load_workbook(SRC / "BIM_Teams_and_Projects.xlsx")
    wb_v = openpyxl.load_workbook(SRC / "BIM_Teams_and_Projects.xlsx", data_only=True)
    ws, wv = wb_f["BIM Teams"], wb_v["BIM Teams"]
    rows = []
    for r in range(2, ws.max_row + 1):
        vals = [ws.cell(r, c).value for c in range(1, 10)]
        if all(v is None for v in vals):
            continue
        mgr, coord, no, name, cde, typ, area, status, flag = vals
        if name is None and mgr is None and coord is None:
            issue("info", "subtotal_row", f"BIM Teams!G{r}",
                  f"Subtotal formula {area!r} ignored (not a project). Its range does not cover the whole block above.")
            continue
        cached_area = wv.cell(r, 7).value
        a, note = parse_area(area, cached_area, f"G{r}")
        rows.append({"source_row": r, "manager": clean_str(mgr), "coordinator_raw": clean_str(coord),
                     "project_no_raw": None if no is None else str(no).strip(),
                     "name": clean_str(name), "cde": clean_str(cde), "type": clean_str(typ),
                     "area_raw": None if area is None else str(area), "area": a, "area_note": note,
                     "status_raw": clean_str(status), "activity": clean_str(flag)})
    return rows


# ------------------------------------------------------------------ main
org = read_org()
wb_rows = read_workbook()

# canonical employees = org chart spelling
employees = []
for i, o in enumerate(org):
    employees.append({"idx": i, **o})

# workbook name -> canonical employee (aliases are explicit, visible and reviewable)
ALIASES = {
    "nesrin elgohary": ("Nesrin Mahmoud", "Different surname in workbook (Elgohary) vs org chart (Mahmoud); matched by first name + role. Confirm."),
    "hagar abelala": ("Hagar Aboelala", "Spelling variant."),
    "fatma edriss": ("Fatma Idriss", "Spelling variant."),
    "mohamed elzawawy": ("Mohamed Alzawawy", "Spelling variant."),
    "mais talaat": ("Mais Atwan", "Different surname in workbook (Talaat) vs org chart (Atwan); only one 'Mais' exists in the org chart. Confirm."),
    "mariam samouel": ("Mariam Samuel", "Spelling variant (Work load sheet)."),
    "ibrahim elghanam": ("Ibrahim Elghannam", "Spelling variant (Work load sheet)."),
    "maha hasan": ("Maha Hassan", "Spelling variant (Work load sheet)."),
    "fatma edris": ("Fatma Idriss", "Spelling variant (Work load sheet)."),
}
by_name = {e["name"].lower(): e for e in employees}
aliases_used = {}


def resolve(name, where):
    if not name:
        return None
    k = name.lower().strip()
    if k in by_name:
        return by_name[k]
    if k in ALIASES:
        canon, why = ALIASES[k]
        aliases_used[name] = {"canonical": canon, "reason": why}
        return by_name[canon.lower()]
    issue("error", "unknown_person", where, f"'{name}' not found in the org chart.")
    return None


def split_coords(raw):
    if not raw:
        return []
    return [p.strip() for p in re.split(r"\s+and\s+|/", raw) if p.strip()]


# status mapping (editable in the app; defaults documented in README)
projects, assignments = [], []
key_index = {}
for r in wb_rows:
    no = r["project_no_raw"]
    pkey = ((no or "").lower(), re.sub(r"[^a-z0-9]", "", (r["name"] or "").lower()))
    mgr = resolve(r["manager"], f"row {r['source_row']}")
    coords = [resolve(c, f"row {r['source_row']}") for c in split_coords(r["coordinator_raw"])]
    if r["area_note"]:
        issue("warning" if r["area"] is None else "info", "area_cleaned" if r["area"] is not None else "area_non_numeric",
              f"row {r['source_row']} {r['name']}", f"Built-up area: {r['area_note']}", raw=r["area_raw"], parsed=r["area"])
    if no is None:
        issue("warning", "missing_project_no", f"row {r['source_row']} {r['name']}", "Project has no project number (allowed; stays blank).")
    elif no != no.strip() or r["project_no_raw"] != str(no):
        pass
    if no is not None and not re.fullmatch(r"\d{4}", no):
        issue("info", "nonstandard_project_no", f"row {r['source_row']} {r['name']}", f"Project number {no!r} is not a 4-digit number (kept as supplied).")
    if r["area"] is None and not r["area_note"]:
        issue("info", "missing_area", f"row {r['source_row']} {r['name']}", "Built-up area missing.")
    if r["area"] and r["area"] >= 5_000_000:
        issue("warning", "area_outlier", f"row {r['source_row']} {r['name']}", f"Built-up area {r['area']:,.0f} is unusually large; check units/typo.", parsed=r["area"])
    if not r["cde"]:
        issue("info", "missing_cde", f"row {r['source_row']} {r['name']}", "CDE missing.")
    if not r["type"]:
        issue("info", "missing_type", f"row {r['source_row']} {r['name']}", "Type missing.")
    if pkey in key_index:
        p = projects[key_index[pkey]]
        p["source_rows"].append(r["source_row"])
        issue("warning", "duplicate_project_row", f"{no} {r['name']}",
              f"Same project number + name appears on rows {p['source_rows']} under different managers/status "
              f"({p['status_raw']} vs {r['status_raw']}). Stored once; both assignments kept.", rows=p["source_rows"])
        pidx = key_index[pkey]
    else:
        pidx = len(projects)
        key_index[pkey] = pidx
        projects.append({"idx": pidx, "project_no": no, "name": r["name"], "cde": r["cde"], "type": r["type"],
                         "area": r["area"], "area_raw": r["area_raw"], "area_note": r["area_note"],
                         "status_raw": r["status_raw"], "activity": r["activity"], "source_rows": [r["source_row"]]})
    if mgr:
        assignments.append({"project_idx": pidx, "employee_idx": mgr["idx"], "role": "manager", "source_row": r["source_row"]})
    else:
        issue("error", "missing_manager", f"row {r['source_row']} {r['name']}", "No BIM Manager.")
    if not coords:
        issue("warning", "missing_coordinator", f"row {r['source_row']} {r['name']}", "No BIM Coordinator assigned in source.")
    for c in coords:
        if c:
            assignments.append({"project_idx": pidx, "employee_idx": c["idx"], "role": "coordinator", "source_row": r["source_row"]})

# shared project numbers (different names) => separate packages, flagged
from collections import defaultdict
bynum = defaultdict(list)
for p in projects:
    if p["project_no"]:
        bynum[p["project_no"].lower()].append(p)
for no, ps in bynum.items():
    if len(ps) > 1:
        issue("warning", "shared_project_no", no,
              "Project number shared by distinct names (kept as separate project records / packages): "
              + "; ".join(f"{p['name']} (row {p['source_rows'][0]})" for p in ps))
# same name, different number
byname = defaultdict(list)
for p in projects:
    byname[re.sub(r"[^a-z0-9]", "", p["name"].lower())].append(p)
for n, ps in byname.items():
    if len(ps) > 1 and len({p["project_no"] for p in ps}) > 1:
        issue("warning", "same_name_different_no", ps[0]["name"],
              "Same name with different project numbers: " + ", ".join(f"{p['project_no']} (row {p['source_rows'][0]})" for p in ps))

for a, v in aliases_used.items():
    issue("warning", "name_alias", a, f"Workbook name '{a}' matched to org-chart '{v['canonical']}'. {v['reason']}")

# employees without projects
assigned = {a["employee_idx"] for a in assignments}
for e in employees:
    if e["idx"] not in assigned and e["job_title"] != "BIM Department Manager":
        issue("info", "no_projects", e["name"], f"{e['job_title']} has no project assignments in the workbook.")
    if not e["employee_id"]:
        issue("warning", "missing_employee_id", e["name"], "No employee ID in the org chart.")

# status values in the data vs the Sheet2 list
seen_status = sorted({p["status_raw"] for p in projects if p["status_raw"]})
issue("info", "status_values", "BIM Teams", f"Status values used: {seen_status}. Sheet2 also lists 'Terminated' (unused).")

# ------------------------------------------------------------------ Reel plan (transcribed from BIM_Reel_Plan.jpg)
REELS = [
    ("9783", "Mariam Samuel", "Sunday", "2026-08-16", "Phasing in Revit"),
    ("B370", "Ibrahim Afify", "Wednesday", "2026-08-19", "PDF Calibration in Autodesk Forma"),
    ("B461", "Ibrahim Elghannam", "Sunday", "2026-08-23", None),
    ("B769", "Moataz Belal", "Wednesday", "2026-08-26", None),
    ("C084", "Rana Khaled", "Sunday", "2026-08-30", None),
    ("C106", "Sanaa Ahmed", "Wednesday", "2026-09-02", None),
    ("C145", "Fatma Idriss", "Sunday", "2026-09-06", None),
    ("C147", "Nesrin Mahmoud", "Wednesday", "2026-09-09", None),
    ("C263", "Mahmoud Hussien", "Sunday", "2026-09-13", None),
    ("C303", "Amal Zaghloul", "Wednesday", "2026-09-16", None),
    ("C304", "Nahla Magdy", "Sunday", "2026-09-20", None),
    ("C455", "Reem Saied", "Wednesday", "2026-09-23", None),
    ("C466", "Maha Hassan", "Sunday", "2026-09-27", None),
    ("C549", "Abdelrahman Radwan", "Wednesday", "2026-09-30", None),
    ("D051", "Mahitab Yosri", "Sunday", "2026-10-04", None),
    ("D357", "Nada Ibrahim", "Wednesday", "2026-10-07", None),
]
emp_by_id = {e["employee_id"]: e for e in employees if e["employee_id"]}
reels = []
for eid, nm, wd, d, topic in REELS:
    dt = datetime.date.fromisoformat(d)
    if dt.strftime("%A") != wd:
        issue("error", "weekday_mismatch", f"{nm} {d}", f"Weekday {wd} does not match date ({dt.strftime('%A')}).")
    e = emp_by_id.get(eid)
    if not e:
        issue("warning", "reel_presenter_not_in_org", f"{eid} {nm}", "Presenter appears in the Reel Plan but not in the org chart; kept as text, not linked to an employee.")
    elif e["name"].lower() != nm.lower():
        issue("warning", "reel_name_mismatch", f"{eid}", f"Reel name '{nm}' differs from org chart '{e['name']}'.")
    if not topic:
        issue("info", "reel_no_topic", f"{nm} {d}", "No topic in the source image yet.")
    reels.append({"employee_id": eid, "presenter_name": nm, "weekday": wd, "date": d, "topic": topic,
                  "employee_idx": e["idx"] if e else None})
issue("info", "reel_status", "BIM Reel Plan", "The source image has no status column. All sessions are loaded as 'Not recorded'; past sessions are NOT assumed Completed.")

seed = {"generated": datetime.datetime.now().isoformat(timespec="seconds"), "employees": employees,
        "projects": projects, "assignments": assignments, "reels": reels, "issues": issues,
        "aliases": aliases_used}
(ROOT / "db").mkdir(exist_ok=True)
(ROOT / "db" / "seed.json").write_text(json.dumps(seed, indent=1, ensure_ascii=False))

# ---- report
sev = defaultdict(int)
for i in issues:
    sev[i["severity"]] += 1
valid_area = sum(p["area"] for p in projects if p["area"])
lines = ["# Import reconciliation report", "",
         f"Generated {seed['generated']}", "",
         "## Totals", "",
         f"- Workbook project rows read: {len(wb_rows)}",
         f"- Unique project records created: {len(projects)}",
         f"- Assignments (one per person per project): {len(assignments)}",
         f"- Employees (org chart): {len(employees)}",
         f"- Reel sessions: {len(reels)}",
         f"- Projects with a valid numeric built-up area: {sum(1 for p in projects if p['area'])}",
         f"- Sum of valid built-up areas (unique projects): {valid_area:,.0f}",
         f"- Issues: {dict(sev)}", "", "## Issues", ""]
for sv in ("error", "warning", "info"):
    lines.append(f"### {sv.title()}")
    lines.append("")
    for i in issues:
        if i["severity"] == sv:
            lines.append(f"- **{i['kind']}** · {i['entity']} — {i['message']}")
    lines.append("")
(ROOT / "db" / "reconciliation.md").write_text("\n".join(lines))
print(json.dumps({"rows": len(wb_rows), "projects": len(projects), "assignments": len(assignments),
                  "employees": len(employees), "reels": len(reels), "issues": dict(sev)}))
