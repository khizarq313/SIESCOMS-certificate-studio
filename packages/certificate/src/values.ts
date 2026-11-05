import type { Design, FieldItem, Values } from './model';
import { LONG_NAME } from './templates';

export type Row = Record<string, string>;
/** Field key → spreadsheet column ('' means "same for everyone"). */
export type ColumnMap = Record<string, string>;

export const textFields = (d: Pick<Design, 'items'>): FieldItem[] => d.items.filter((i): i is FieldItem => i.kind === 'field');
export const dynamicFields = (d: Pick<Design, 'items'>): FieldItem[] => textFields(d).filter((f) => f.isDynamic);

/** `base` if no text field uses it yet, otherwise the first free `base_2`, `base_3`, … (counting fields would reuse a key after a delete). */
export function freeKey(d: Pick<Design, 'items'>, base: string): string {
  const used = new Set(textFields(d).map((f) => f.key));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** Values for the editor preview: sample text, optionally with a long name swapped in. */
export function sampleValues(d: Pick<Design, 'items'>, longName = false): Values {
  const v: Values = {};
  for (const f of textFields(d)) {
    if (f.isDynamic) v[f.key] = longName && f.type === 'recipient_name' ? LONG_NAME : f.sampleValue || f.label;
    else if (!(f.key in v)) v[f.key] = f.defaultValue;
  }
  return v;
}

/** Values for one recipient. Unmapped dynamic fields fall back to their sample text. */
export function rowValues(d: Pick<Design, 'items'>, row: Row | undefined, map: ColumnMap): Values {
  const v: Values = {};
  for (const f of textFields(d)) {
    if (f.isDynamic) v[f.key] = map[f.key] ? String(row?.[map[f.key]] ?? '') : f.sampleValue;
    else if (!(f.key in v)) v[f.key] = f.defaultValue;
  }
  return v;
}

/** Text drawn for a field given resolved values. */
export const fieldText = (f: FieldItem, values: Values): string => (f.isDynamic ? values[f.key] ?? f.sampleValue : f.defaultValue);

/** Fills {{key}} placeholders. Unknown keys are left as they are, so a missing detail shows up instead of sample text. */
export function fillPlaceholders(text: string, values: Values): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (Object.hasOwn(values, k) ? values[k] : m));
}

/** What an email can fill in: spreadsheet columns, as written and as snake_case ({{Department}} or {{department}}), then the certificate's own values. */
export function placeholderValues(row: Row | undefined, vals: Values): Values {
  const all: Values = {};
  for (const [k, v] of Object.entries(row || {})) { all[k] = v; all[k.toLowerCase().replace(/\W+/g, '_')] = v; }
  return Object.assign(all, vals);
}

export const emailOk = (e: string | undefined): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

/** Safe file name that keeps non-English letters (e.g. "Certificate_अनन्या_राव.pdf"). */
export function safeFileStem(name: string, fallback = 'Recipient'): string {
  const s = String(name || '')
    .normalize('NFC')
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return s || fallback;
}
export const certificateFileName = (name: string) => `Certificate_${safeFileStem(name)}.pdf`;

/** Rules for matching spreadsheet columns to fields (from the prototype, extended). */
const RULES: Record<string, RegExp> = {
  recipient_name: /name/i,
  roll_number: /roll|reg|\bid\b/i,
  event_name: /event|course|program|workshop/i,
  issue_date: /issue|^date/i,
};
export function suggestMapping(fields: FieldItem[], headers: string[]): { map: ColumnMap; emailColumn: string } {
  const map: ColumnMap = {};
  for (const f of fields) {
    const re = RULES[f.type];
    map[f.key] =
      headers.find((h) => (re ? re.test(h) && !/mail/i.test(h) : h.toLowerCase().replace(/\W+/g, '_') === f.key)) || '';
  }
  // Prefer an exact "name" column for the recipient over e.g. "Event Name".
  if (map.recipient_name) {
    const better = headers.find((h) => /^(full\s*)?name$|student.*name|participant.*name|recipient/i.test(h));
    if (better) map.recipient_name = better;
    else if (/event|course|program/i.test(map.recipient_name)) map.recipient_name = headers.find((h) => /name/i.test(h) && !/event|course|program|mail/i.test(h)) || '';
  }
  return { map, emailColumn: headers.find((h) => /mail/i.test(h)) || '' };
}
