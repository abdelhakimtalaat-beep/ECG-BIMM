'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './ui';
import { CropState, baseScale, centered, clampOffset, sourceRect, zoomAt } from '@/lib/crop';

export interface AspectOpt { label: string; value: number }
/** Lets the user pan and zoom a photo inside a frame, then returns the cropped JPEG. Works with mouse, wheel and touch. */
export function ImageCropper({ file, aspects, outWidth = 800, title = 'Crop photo', onCancel, onDone }: {
  file: File; aspects: AspectOpt[]; outWidth?: number; title?: string; onCancel: () => void; onDone: (blob: Blob, name: string) => void | Promise<void>;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState(aspects[0].value);
  const [st, setSt] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const VW = 300, VH = Math.round(VW / aspect);

  useEffect(() => { if (nat) setSt(centered(nat.w, nat.h, VW, VH, 1)); }, [nat, VH]);
  const s = nat ? baseScale(nat.w, nat.h, VW, VH) * st.zoom : 1;

  const down = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: st.x, y: st.y }; };
  const move = (e: React.PointerEvent) => { if (!drag.current || !nat) return; const d = drag.current; setSt((c) => ({ ...c, ...clampOffset(nat.w, nat.h, VW, VH, c.zoom, d.x + e.clientX - d.px, d.y + e.clientY - d.py) })); };
  const up = () => { drag.current = null; };
  const setZoom = (z: number, cx = VW / 2, cy = VH / 2) => nat && setSt((c) => zoomAt(nat.w, nat.h, VW, VH, c, z, cx, cy));
  const wheel = (e: React.WheelEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setZoom(st.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); };

  const apply = async () => {
    if (!nat || !img.current) return; setBusy(true); setErr('');
    try {
      const r = sourceRect(nat.w, nat.h, VW, VH, st);
      const c = document.createElement('canvas'); c.width = outWidth; c.height = Math.round(outWidth / aspect);
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img.current, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/jpeg', 0.88));
      await onDone(blob, file.name.replace(/\.[^.]+$/, '') + '.jpg');
    } catch (e: any) { setErr(e.message || 'Could not process the image'); setBusy(false); }
  };

  return (
    <Modal open onClose={onCancel} title={title} footer={<><button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn-primary" onClick={apply} disabled={!nat || busy}>{busy ? 'Saving…' : 'Crop & use photo'}</button></>}>
      <div className="flex flex-col items-center gap-3">
        {aspects.length > 1 && <div className="flex gap-2">{aspects.map((a) => <button key={a.label} className={`rounded-lg border px-3 py-1 text-sm ${a.value === aspect ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`} onClick={() => setAspect(a.value)}>{a.label}</button>)}</div>}
        <div className="relative touch-none select-none overflow-hidden rounded-lg bg-slate-200 ring-2 ring-brand-500" style={{ width: VW, height: VH, cursor: 'grab' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={url} alt="Photo to crop" draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ position: 'absolute', left: 0, top: 0, maxWidth: 'none', width: nat ? nat.w * s : undefined, height: nat ? nat.h * s : undefined, transform: `translate(${st.x}px, ${st.y}px)`, pointerEvents: 'none' }} />
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/70" />)}</div>
        </div>
        <label className="flex w-full max-w-[300px] items-center gap-3 text-xs text-slate-600">Zoom
          <input type="range" min={1} max={5} step={0.01} value={st.zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" aria-label="Zoom" /></label>
        <p className="text-center text-xs text-slate-500">Drag the photo to move it, use the slider or mouse wheel to zoom. The framed area is what will be saved.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
