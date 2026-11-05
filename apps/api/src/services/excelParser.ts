import * as XLSX from 'xlsx';

export interface ParsedSheet { headers: string[]; rows: Record<string, string>[] }

export const MAX_ROWS = 5000;

/** Reads the first sheet of an Excel or CSV file. Cells come back as the text Excel shows. */
export function parseSpreadsheet(buffer: Buffer, fileName: string): ParsedSheet {
  const isCsv = /\.csv$/i.test(fileName);
  const wb = isCsv
    ? XLSX.read(buffer.toString('utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw Object.assign(new Error('That file has no sheets.'), { status: 400 });

  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false, dateNF: 'd mmmm yyyy', blankrows: false });
  const nonEmpty = grid.filter((r) => r.some((c) => String(c).trim()));
  if (nonEmpty.length < 2) throw Object.assign(new Error('That file needs a header row and at least one person.'), { status: 400 });

  // Header names: trimmed, blank ones named, duplicates numbered.
  const seen = new Map<string, number>();
  const headers = nonEmpty[0].map((h, i) => {
    let name = String(h).trim() || `Column ${i + 1}`;
    const n = seen.get(name) || 0;
    seen.set(name, n + 1);
    if (n) name = `${name} (${n + 1})`;
    return name;
  });
  const body = nonEmpty.slice(1);
  if (body.length > MAX_ROWS) throw Object.assign(new Error(`That list has ${body.length} rows. The limit is ${MAX_ROWS} per batch.`), { status: 400 });
  const rows = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
  return { headers, rows };
}
