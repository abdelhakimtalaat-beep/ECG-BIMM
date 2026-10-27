// Geometry for the photo cropper (pure; unit tested). The image always covers the crop frame; x,y is the image's top-left inside the frame.
export interface CropState { zoom: number; x: number; y: number }
export const baseScale = (iw: number, ih: number, vw: number, vh: number) => Math.max(vw / iw, vh / ih);
export function clampOffset(iw: number, ih: number, vw: number, vh: number, zoom: number, x: number, y: number) {
  const s = baseScale(iw, ih, vw, vh) * zoom;
  return { x: Math.min(0, Math.max(vw - iw * s, x)), y: Math.min(0, Math.max(vh - ih * s, y)) };
}
export function centered(iw: number, ih: number, vw: number, vh: number, zoom = 1): CropState {
  const s = baseScale(iw, ih, vw, vh) * zoom;
  return { zoom, ...clampOffset(iw, ih, vw, vh, zoom, (vw - iw * s) / 2, (vh - ih * s) / 2) };
}
/** Changes the zoom while keeping the frame point (cx, cy) fixed under the finger / cursor. */
export function zoomAt(iw: number, ih: number, vw: number, vh: number, st: CropState, zoom: number, cx: number, cy: number): CropState {
  const z = Math.min(5, Math.max(1, zoom)); const b = baseScale(iw, ih, vw, vh);
  const k = (b * z) / (b * st.zoom);
  return { zoom: z, ...clampOffset(iw, ih, vw, vh, z, cx - (cx - st.x) * k, cy - (cy - st.y) * k) };
}
export function sourceRect(iw: number, ih: number, vw: number, vh: number, st: CropState) {
  const s = baseScale(iw, ih, vw, vh) * st.zoom;
  return { sx: -st.x / s + 0, sy: -st.y / s + 0, sw: vw / s, sh: vh / s }; // + 0 avoids -0
}
