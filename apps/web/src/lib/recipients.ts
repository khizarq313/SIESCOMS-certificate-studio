'use client';
import { useMemo } from 'react';
import { dynamicFields, emailOk, rowValues, sampleValues, suggestMapping, type ColumnMap, type Row, type Values } from '@siescoms/certificate';
import { useApp } from './store';

/** Everything derived from the recipient list, shared by the Recipients and Delivery steps. */
export function useRecipients() {
  const design = useApp((s) => s.design);
  const recipMode = useApp((s) => s.recipMode);
  const manualPeople = useApp((s) => s.manualPeople);
  const singleVals = useApp((s) => s.single);
  const singleEmail = useApp((s) => s.singleEmail);
  const listRows = useApp((s) => s.rows);
  const listHeaders = useApp((s) => s.headers);
  const listMap = useApp((s) => s.map);
  const listEmail = useApp((s) => s.emailCol);
  const prevIdx = useApp((s) => s.prevIdx);

  const dyn = dynamicFields(design);
  const isManual = recipMode === 'single';
  let rows: Row[], headers: string[], map: ColumnMap, ecol: string;
  let single = false;

  if (isManual) {
    const people = manualPeople && manualPeople.length > 0
      ? manualPeople
      : [{ id: '1', values: singleVals, email: singleEmail }];
    single = people.length === 1;
    headers = [...dyn.map((f) => f.label), 'Email'];
    map = Object.fromEntries(dyn.map((f) => [f.key, f.label]));
    ecol = 'Email';
    rows = people.map((p, i) => {
      const r: Row = {};
      for (const f of dyn) {
        const custom = p.values?.[f.key];
        r[f.label] = custom !== undefined ? custom : (f.sampleValue || (f.type === 'recipient_name' ? `Person ${i + 1}` : ''));
      }
      r.Email = p.email || '';
      return r;
    });
  } else {
    single = false;
    rows = listRows;
    headers = listHeaders;
    map = listMap;
    ecol = listEmail;
  }
  const valsFor = (row: Row | undefined): Values => rowValues(design, row, map);
  const nameOf = (row: Row | undefined, i: number) => (map.recipient_name && row?.[map.recipient_name]) || `Row ${i + 1}`;
  const issues = (row: Row): string[] => {
    const o: string[] = [];
    for (const f of dyn) if (map[f.key] && !String(row[map[f.key]] || '').trim()) o.push(`${f.label} is empty`);
    if (ecol && !single) { const e = row[ecol]; if (!e) o.push('No email address'); else if (!emailOk(e)) o.push('Email looks wrong'); }
    return o;
  };
  const idx = Math.min(prevIdx, Math.max(0, rows.length - 1));
  const prev = rows[idx];
  const prevVals = prev ? valsFor(prev) : sampleValues(design);
  // Checked once per change to the list, not on every render (lists can have thousands of rows).
  const bad = useMemo(() => (single ? [] : rows.map((r, i) => ({ i, r, list: issues(r) })).filter((x) => x.list.length)),
    [single, rows, map, ecol, design]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = [...dyn.filter((f) => map[f.key]).map((f) => map[f.key]), ...(ecol ? [ecol] : [])];
  // Every recipient-name field needs a column, or it prints the sample name on everyone's certificate.
  const mapsOk = isManual ? true : dyn.filter((f) => f.type === 'recipient_name').every((f) => !!map[f.key]);
  const ready = isManual ? (rows.length > 0) : (!!rows.length && mapsOk);
  const valid = useMemo(() => rows.filter((r) => ecol && emailOk(r[ecol])), [rows, ecol]);
  const prevName = prev ? (single ? prevVals.recipient_name || 'Preview' : nameOf(prev, idx)) : '';
  return { design, dyn, single, rows, headers, map, ecol, valsFor, nameOf, issues, idx, prev, prevVals, prevName, bad, cols, mapsOk, ready, valid };
}

/** Puts a parsed list into the store, matching columns to fields. */
export function loadList(name: string, headers: string[], rows: Row[], note = '') {
  const { design, set } = useApp.getState();
  const { map, emailColumn } = suggestMapping(dynamicFields(design), headers);
  set({ dataName: name, headers, rows, map, emailCol: emailColumn, prevIdx: 0, dataNote: note, run: null, listError: '' });
}

export function loadSampleList() {
  const N = ['Aarav Sharma', 'Diya Menon', 'Rohan Iyer', 'Ananya Gupta', 'Kabir Singh', 'Ishita Rao', 'Vihaan Patel', 'Meera Krishnan', 'Arjun Nair', 'Saanvi Joshi', 'Aditya Kulkarni', 'Priya Das', 'Venkataraghavan Subramaniam Iyer', 'Neha Bhat', 'Siddharth Reddy', 'Kavya Pillai', 'Rahul Verma', 'Tanvi Shah', 'Nikhil Desai', 'Pooja Hegde', 'Yash Malhotra', 'Riya Kapoor', 'Omkar Jadhav', 'Lakshmi Narayanan'];
  const DEP = ['MCA', 'MMS', 'PGDM', 'MCA'];
  const rows = N.map((n, i) => {
    const w = n.toLowerCase().split(' ');
    return { 'Full Name': n, Email: i === 7 ? '' : i === 15 ? 'kavya.pillai@siescoms' : `${w[0]}.${w[w.length - 1]}@siescoms.edu`, 'Roll No': `MCA-2026-${String(i + 1).padStart(3, '0')}`, Department: DEP[i % 4], Event: 'Annual Tech Symposium 2026' };
  });
  loadList('symposium_attendees.xlsx (sample)', ['Full Name', 'Email', 'Roll No', 'Department', 'Event'], rows);
}
