import ExcelJS from 'exceljs';

export const BRAND = 'FF0F55A8';
export function newBook() { const wb = new ExcelJS.Workbook(); wb.creator = 'ECG BIM Department Management Portal'; wb.created = new Date(); return wb; }
export function addSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number | null)[][], widths?: number[]) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  h.alignment = { vertical: 'middle' };
  for (const r of rows) ws.addRow(r);
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths?.[i] ?? Math.min(48, Math.max(12, headers[i].length + 4)); });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return ws;
}
export function infoSheet(wb: ExcelJS.Workbook, title: string, lines: [string, string][]) {
  const ws = wb.addWorksheet('Export info');
  ws.addRow([title]).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.addRow([]);
  for (const [k, v] of lines) { const r = ws.addRow([k, v]); r.getCell(1).font = { bold: true }; }
  ws.getColumn(1).width = 28; ws.getColumn(2).width = 100;
}
export async function sendBook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
