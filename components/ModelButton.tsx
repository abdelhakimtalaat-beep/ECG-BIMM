'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ChevronRight, Folder, X } from 'lucide-react';
import { api } from '@/lib/client';
import { Spinner, useToast } from './ui';

declare global { interface Window { Autodesk?: any } }
const VIEWER = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*';
interface Info { state: 'unlinked' | 'no_model' | 'ready'; name: string; model_name?: string; version?: number | null; modified?: string | null; urn?: string; token?: string; expires_in?: number; can_edit: boolean }
interface Browse { folders: { id: string; name: string }[]; items: { id: string; name: string; modified: string | null }[] }

/** Loads Autodesk's viewer once (script + style) from Autodesk's servers. */
let viewerLoad: Promise<void> | null = null;
const loadViewer = () => (viewerLoad ??= new Promise<void>((res, rej) => {
  if (window.Autodesk?.Viewing) return res();
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${VIEWER}/style.min.css`; document.head.appendChild(css);
  const s = document.createElement('script'); s.src = `${VIEWER}/viewer3D.min.js`; s.onload = () => res(); s.onerror = () => { viewerLoad = null; rej(new Error('The 3D viewer could not be loaded from Autodesk (check the internet connection)')); }; document.head.appendChild(s);
}));

/** "3D" button of a project: opens the project's ACC model (newest version) in a viewer with orbit / pan / zoom / section / properties. */
export function ModelButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} onKeyDown={(e) => e.stopPropagation()} title="Open the 3D model of this project" aria-label={`Open the 3D model of ${name}`}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-slate-800"><Box size={12} />3D</button>
    {open && <ModelOverlay id={id} name={name} onClose={() => setOpen(false)} />}
  </>);
}

function ModelOverlay({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const toast = useToast(); const [info, setInfo] = useState<Info | null>(null); const [err, setErr] = useState(''); const [picking, setPicking] = useState(false); const [loading, setLoading] = useState(true);
  const box = useRef<HTMLDivElement>(null); const viewer = useRef<any>(null);
  const load = useCallback(async () => { setErr(''); setInfo(null); try { setInfo(await api<Info>(`/api/acc/model?project_id=${id}`)); } catch (e: any) { setErr(e.message); } }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && !picking && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, picking]);
  useEffect(() => {
    if (info?.state !== 'ready' || !box.current) return; let dead = false; setLoading(true);
    (async () => {
      try {
        await loadViewer(); const A = window.Autodesk.Viewing;
        await new Promise<void>((res) => A.Initializer({ env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken: (cb: (t: string, s: number) => void) => { if (!viewer.current) cb(info.token!, info.expires_in ?? 3000); else api<{ token: string; expires_in: number }>(`/api/acc/model?project_id=${id}&token_only=1`).then((t) => cb(t.token, t.expires_in)); } }, () => res()));
        if (dead || !box.current) return;
        const v = new A.GuiViewer3D(box.current, { extensions: ['Autodesk.DocumentBrowser'] }); viewer.current = v; v.start();
        A.Document.load('urn:' + info.urn, (doc: any) => { if (dead) return; v.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()).then(() => setLoading(false)).catch((e: any) => { setErr('The model could not be displayed: ' + (e?.message ?? e)); setLoading(false); }); },
          (code: number, msg: string) => { setErr(`Autodesk could not open this model (${code}${msg ? ': ' + msg : ''}). It may still be processing in ACC, or you may not have access to the file.`); setLoading(false); });
      } catch (e: any) { setErr(e.message); setLoading(false); }
    })();
    return () => { dead = true; try { viewer.current?.finish(); } catch { /* already closed */ } viewer.current = null; };
  }, [info, id]);
  const clear = async () => { try { await api('/api/acc/model', { method: 'DELETE', body: { project_id: id } }); toast('3D model cleared'); load(); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`3D model of ${name}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2">
        <Box size={18} className="text-brand-700" /><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold text-brand-900">{name}</h2>
          {info?.state === 'ready' && <p className="truncate text-xs text-slate-500">{info.model_name}{info.version ? ` · version ${info.version}` : ''}{info.modified ? ` · saved ${new Date(info.modified).toLocaleDateString('en-GB')}` : ''}</p>}</div>
        {info?.can_edit && info.state !== 'unlinked' && <><button className="btn-secondary btn-sm" onClick={() => setPicking(true)}>{info.state === 'ready' ? 'Change model' : 'Choose model'}</button>{info.state === 'ready' && <button className="btn-ghost btn-sm text-red-600" onClick={clear}>Remove</button>}</>}
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="relative flex-1 bg-slate-100">
        {!info && !err && <div className="flex h-full items-center justify-center"><Spinner /></div>}
        {err && <div className="flex h-full items-center justify-center p-6"><p role="alert" className="max-w-lg rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p></div>}
        {info?.state === 'unlinked' && <Msg title="This project is not linked to an ACC project yet">The link is made automatically when the portal project number matches the start of the ACC project name (for example 3574 and "3574-Hacienda Waters"), and ACC is connected in Administration. Check the project number, or ask the administrator.</Msg>}
        {info?.state === 'no_model' && <Msg title="No 3D model has been chosen for this project">{info.can_edit ? <><span>Choose the ACC model file to show here. The newest version is always opened.</span><br /><button className="btn-primary mt-3" onClick={() => setPicking(true)}>Choose model</button></> : 'The BIM Manager of the project can choose the model.'}</Msg>}
        {info?.state === 'ready' && !err && <><div ref={box} className="absolute inset-0" />{loading && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70"><div className="text-center text-sm text-slate-600"><Spinner /><p className="mt-2">Loading the model from Autodesk… large models can take a minute.</p></div></div>}</>}
      </div>
      {picking && <Picker id={id} onClose={() => setPicking(false)} onPicked={() => { setPicking(false); load(); }} />}
    </div>);
}
const Msg = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="flex h-full items-center justify-center p-6 text-center"><div className="max-w-md"><p className="text-base font-semibold text-brand-900">{title}</p><p className="mt-2 text-sm text-slate-600">{children}</p></div></div>;

/** Browse the project's ACC folders and pick the model file. */
function Picker({ id, onClose, onPicked }: { id: string; onClose: () => void; onPicked: () => void }) {
  const toast = useToast(); const [path, setPath] = useState<{ id: string; name: string }[]>([]); const [d, setD] = useState<Browse | null>(null); const [err, setErr] = useState('');
  const folder = path[path.length - 1]?.id;
  useEffect(() => { setD(null); setErr(''); api<Browse>(`/api/acc/model/browse?project_id=${id}${folder ? `&folder_id=${encodeURIComponent(folder)}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [id, folder]);
  const pick = async (it: { id: string; name: string }) => { try { await api('/api/acc/model', { method: 'PUT', body: { project_id: id, item_id: it.id, name: it.name } }); toast('3D model saved'); onPicked(); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/50 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-xl"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h3 className="font-semibold text-brand-900">Choose the model file</h3><button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600"><button className="underline" onClick={() => setPath([])}>Project</button>{path.map((p, i) => <span key={p.id} className="flex items-center gap-1"><ChevronRight size={12} /><button className="underline" onClick={() => setPath(path.slice(0, i + 1))}>{p.name}</button></span>)}</div>
          {err && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {!d && !err ? <Spinner /> : d && <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 text-sm">
            {d.folders.map((f) => <li key={f.id}><button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50" onClick={() => setPath([...path, f])}><Folder size={16} className="text-amber-500" />{f.name}</button></li>)}
            {d.items.map((it) => <li key={it.id}><button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-50" onClick={() => pick(it)}><Box size={16} className="text-brand-700" /><span className="flex-1">{it.name}</span>{it.modified && <span className="text-xs text-slate-400">{new Date(it.modified).toLocaleDateString('en-GB')}</span>}</button></li>)}
            {!d.folders.length && !d.items.length && <li className="px-3 py-4 text-slate-500">Nothing here. Open another folder.</li>}
          </ul>}
          <p className="text-xs text-slate-500">Only 3D-capable files are listed (Revit, Navisworks, IFC, AutoCAD…).</p>
        </div></div>
    </div>);
}
