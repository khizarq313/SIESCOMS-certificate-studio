// The built-in certificate designs, ported from the Claude Design prototype.
// Every design is A4 landscape (842 × 595 pt).
import type { FontKey } from './fonts';
import type { Design, FieldItem, FieldType, ImageItem, Item, LineItem, LockupItem, PatchItem, ShapeItem } from './model';
import { estimateWidth } from './metrics';

export const A4 = { w: 842, h: 595 };

let seq = 0;
const salt = Math.random().toString(36).slice(2, 6);
export const newId = () => `${salt}${(++seq).toString(36)}`;

export interface TemplateDef {
  id: string;
  name: string;
  tag: string;
  bg: string;
  dark?: boolean;
  pattern?: 'dots';
  /** Horizontal offset for added details when the design has a side band. */
  dx?: number;
  /** Recipient-name lettering. */
  font: FontKey;
  size: number;
  bold?: boolean;
  italic?: boolean;
  color: string;
  /** Colour for other added details. */
  ink: string;
  build: () => Item[];
}

interface TxOpts { ls?: number; align?: 'left' | 'center' | 'right'; w?: number; cx?: number; x?: number; bold?: boolean; italic?: boolean; sample?: boolean }

function Tx(label: string, text: string, y: number, size: number, font: FontKey, color: string, o: TxOpts = {}): FieldItem {
  const ls = (o.ls || 0) * size;
  const al = o.align || 'center';
  const w = o.w || Math.min(800, Math.round(estimateWidth(text, font, size, !!o.bold, !!o.italic, ls) * 1.08 + 18));
  const cx = o.cx == null ? 421 : o.cx;
  return {
    id: newId(), kind: 'field', type: 'custom_text', label, key: 'text', isDynamic: false, sampleValue: '', defaultValue: text, sample: !!o.sample,
    x: Math.round(al === 'center' ? cx - w / 2 : o.x ?? 0), y: Math.round(y - size * 0.18), w, h: Math.round(size * 1.38),
    style: { fontFamily: font, fontSize: size, isBold: !!o.bold, isItalic: !!o.italic, color, alignment: al, autoShrink: false, minFontSize: 8, letterSpacing: +ls.toFixed(2) },
  };
}
const Nm = (y: number, size: number, font: FontKey, color: string, o: TxOpts = {}) =>
  Tx('Sample name', 'Jane Sample', y, size, font, color, { sample: true, ...o });

const Sh = (label: string, x: number, y: number, w: number, h: number, o: Partial<ShapeItem> = {}): ShapeItem => ({
  id: newId(), kind: 'shape', label, x, y, w, h, fill: '', stroke: '', sw: 0, radius: 0, sides: 'all', dbl: false, dash: false, rot: 0, opacity: 1, grad: '', ...o,
});
export const Ln = (x: number, y: number, w: number, color: string, t = 0.84, o: Partial<LineItem> = {}): LineItem => ({
  id: newId(), kind: 'line', label: 'Line', x, y: y - 4, w, h: 8, color, thick: t, dash: false, rot: 0, ...o,
});
const Im = (label: string, src: string, x: number, y: number, w: number, h: number, o: Partial<ImageItem> = {}): ImageItem => ({
  id: newId(), kind: 'image', label, src, x, y, w, h, opacity: 1, blend: '', rot: 0, campus: false, dark: false, ...o,
});
export const Lk = (x: number, y: number, w: number): LockupItem => ({ id: newId(), kind: 'lockup', label: 'SIES logo', x, y, w, h: Math.round(w * 0.52), rot: 0 });

const SUN = 'asset:sun', BADGE = 'asset:badge', CAMPUS = 'asset:campus', SIG = 'asset:sig';

const sigs = (c: string, t: number, cap: Item): Item[] => [Ln(110, 490, 170, c, t, { label: 'Signature line' }), Ln(562, 490, 170, c, t, { label: 'Date line' }), cap];

export const TEMPLATES: TemplateDef[] = [
  { id: 'classic', name: 'Classic Gold', tag: 'Formal', bg: '#FFFFFF', font: 'GreatVibes', size: 40, color: '#2A2A33', ink: '#1F2A44', build: () => [
    Sh('Outer frame', 18, 18, 806, 559, { stroke: '#B08D57', sw: 2 }), Sh('Inner frame', 28, 28, 786, 539, { stroke: '#C9AE80', sw: 0.84 }),
    Lk(47, 43, 178), Im('MCA 25 badge', BADGE, 700, 38, 94, 94, { blend: 'multiply' }),
    Tx('Title', 'Certificate', 80, 40, 'Cinzel', '#1F2A44', { ls: 0.08 }), Tx('Subtitle', 'OF PARTICIPATION', 146, 11, 'Montserrat', '#8A7550', { ls: 0.35 }),
    Tx('Intro', 'This certificate is proudly presented to', 205, 13, 'PlayfairDisplay', '#4A4A55', { italic: true }), Nm(254, 40, 'GreatVibes', '#2A2A33'),
    Ln(241, 305, 360, '#B08D57', 0.84, { label: 'Name line' }), Tx('Body text', 'for active participation in', 319, 12, 'PlayfairDisplay', '#4A4A55'),
    ...sigs('#B08D57', 0.84, Tx('Date caption', 'DATE OF ISSUE', 500, 8, 'Montserrat', '#8A7550', { ls: 0.2, cx: 647 })),
    Sh('Seal ring', 387, 446, 68, 68, { stroke: '#C9AE80', sw: 1.7, radius: 34 })] },
  { id: 'midnight', name: 'Midnight Navy', tag: 'Formal · Navy', bg: '#FFFFFF', font: 'PinyonScript', size: 40, color: '#13254A', ink: '#13254A', build: () => [
    Sh('Outer frame', 20, 20, 802, 555, { stroke: '#13254A', sw: 2.2 }), Sh('Inner frame', 29, 29, 784, 537, { stroke: '#C8A45C', sw: 0.8 }),
    Im('SIES sun', SUN, 392, 39, 57, 57), Tx('Title', 'Certificate', 116, 37, 'Cinzel', '#13254A', { ls: 0.12 }), Tx('Subtitle', 'OF APPRECIATION', 169, 9.7, 'Montserrat', '#C8A45C', { ls: 0.45 }),
    Tx('Intro', 'is gratefully presented to', 211, 12.6, 'PlayfairDisplay', '#5A5A66', { italic: true }), Nm(252, 39, 'PinyonScript', '#13254A'),
    Ln(253, 305, 337, '#C8A45C', 0.8, { label: 'Name line' }), Tx('Body text', 'in recognition of their contribution to', 319, 11.8, 'PlayfairDisplay', '#5A5A66'),
    ...sigs('#13254A', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#C8A45C', { ls: 0.25, cx: 647 })),
    Tx('Footer', 'SIES COLLEGE OF MANAGEMENT STUDIES · NERUL, NAVI MUMBAI', 537, 7.2, 'Montserrat', '#13254A', { ls: 0.3 })] },
  { id: 'saffron', name: 'Saffron Sunrise', tag: 'Events', bg: '#FFFFFF', font: 'DancingScript', size: 40, color: '#2954A8', ink: '#2A2A33', build: () => [
    Im('Sun watermark', SUN, -135, -202, 488, 488, { opacity: 0.12 }), Im('Small sun watermark', SUN, 573, 463, 370, 370, { opacity: 0.08 }),
    Sh('Top bar', 0, 0, 842, 10, { fill: '#FB8D31' }), Sh('Bottom bar', 0, 585, 842, 10, { fill: '#2954A8' }),
    Tx('College name', 'SIES College of Management Studies', 36, 10.5, 'TimesRoman', '#2954A8', { bold: true, align: 'right', x: 544, w: 260 }),
    Tx('Title', 'CERTIFICATE', 77, 36, 'Montserrat', '#2954A8', { bold: true, ls: 0.14 }), Tx('Subtitle', 'OF PARTICIPATION', 140, 11, 'Montserrat', '#E07A1F', { bold: true, ls: 0.42 }),
    Tx('Intro', 'This is to certify that', 209, 11.8, 'Montserrat', '#5A5A5A'), Nm(252, 39, 'DancingScript', '#2954A8'),
    Sh('Name bar', 261, 304, 320, 2.2, { fill: '#FB8D31', radius: 1 }), Tx('Body text', 'took part with enthusiasm in', 320, 11.4, 'Montserrat', '#5A5A5A'),
    ...sigs('#2954A8', 1, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#2954A8', { bold: true, ls: 0.2, cx: 647 }))] },
  { id: 'modern', name: 'Blue Band', tag: 'Modern', bg: '#FFFFFF', dx: 66, font: 'PlayfairDisplay', size: 34, italic: true, color: '#1F1D1A', ink: '#1F1D1A', build: () => [
    Sh('Blue band', 0, 0, 126, 595, { fill: '#2954A8' }), Sh('Orange stripe', 126, 0, 5, 595, { fill: '#FB8D31' }), Im('SIES sun', SUN, 21, 42, 84, 84),
    Tx('SIES', 'SIES', 152, 20, 'TimesRoman', '#FFFFFF', { bold: true, cx: 63 }),
    Tx('College line 1', 'COLLEGE OF', 520, 7.2, 'Montserrat', '#D5DEEF', { ls: 0.25, cx: 63 }), Tx('College line 2', 'MANAGEMENT STUDIES', 533, 7.2, 'Montserrat', '#D5DEEF', { ls: 0.1, cx: 63 }),
    Tx('Title', 'Certificate of Achievement', 83, 31, 'PlayfairDisplay', '#1F1D1A', { bold: true, cx: 487 }), Sh('Orange rule', 462, 155, 50, 2.5, { fill: '#FB8D31' }),
    Tx('Intro', 'PRESENTED TO', 211, 9.7, 'Montserrat', '#7A7A7A', { ls: 0.3, cx: 487 }), Nm(253, 34.5, 'PlayfairDisplay', '#1F1D1A', { italic: true, cx: 487 }),
    Ln(327, 305, 320, '#C9C9C9', 0.67, { label: 'Name line' }), Tx('Body text', 'for outstanding performance in', 320, 11.4, 'Montserrat', '#555555', { cx: 487 }),
    Ln(176, 490, 170, '#1F1D1A', 0.67, { label: 'Signature line' }), Ln(628, 490, 170, '#1F1D1A', 0.67, { label: 'Date line' }),
    Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#7A7A7A', { ls: 0.25, cx: 713 })] },
  { id: 'deco', name: 'Art Deco', tag: 'Awards · Gold', bg: '#FFFFFF', font: 'Cinzel', size: 30, color: '#1B1B1D', ink: '#1B1B1D', build: () => [
    Sh('Thin frame', 27, 27, 788, 541, { stroke: '#B08D57', sw: 0.8 }),
    Sh('Corner top left', 20, 20, 76, 77, { stroke: '#B08D57', sw: 2.5, sides: 'tl' }), Sh('Corner top right', 746, 20, 76, 77, { stroke: '#B08D57', sw: 2.5, sides: 'tr' }),
    Sh('Corner bottom left', 20, 498, 76, 77, { stroke: '#B08D57', sw: 2.5, sides: 'bl' }), Sh('Corner bottom right', 746, 498, 76, 77, { stroke: '#B08D57', sw: 2.5, sides: 'br' }),
    Sh('Diamond', 415, 41, 12, 12, { fill: '#B08D57', rot: 45 }),
    Tx('Title', 'CERTIFICATE', 80, 42, 'Cinzel', '#1B1B1D', { bold: true, ls: 0.2 }), Tx('Subtitle', 'OF EXCELLENCE', 148, 9.3, 'Montserrat', '#8A7550', { ls: 0.6 }),
    Tx('Intro', 'awarded to', 211, 12.6, 'PlayfairDisplay', '#5A5A5A', { italic: true }), Nm(257, 30, 'Cinzel', '#1B1B1D', { ls: 0.06 }),
    Ln(236, 307, 168, '#B08D57', 0.8, { label: 'Name line left' }), Ln(438, 307, 168, '#B08D57', 0.8, { label: 'Name line right' }), Sh('Small diamond', 417, 303, 8, 8, { fill: '#B08D57', rot: 45 }),
    Tx('Body text', 'for distinguished achievement in', 321, 11.4, 'PlayfairDisplay', '#5A5A5A'),
    ...sigs('#B08D57', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#8A7550', { ls: 0.3, cx: 647 })), Im('SIES sun', SUN, 391, 449, 61, 61, { opacity: 0.9 })] },
  { id: 'sage', name: 'Sage Workshop', tag: 'Workshops', bg: '#FFFFFF', font: 'DancingScript', size: 38, color: '#2F4A2E', ink: '#2F4A2E', build: () => [
    Sh('Outer frame', 24, 24, 794, 547, { stroke: '#5E7A5A', sw: 1.5, radius: 18 }), Sh('Inner frame', 34, 33, 774, 529, { stroke: '#8FA58A', sw: 0.6, radius: 13 }),
    Im('SIES sun', SUN, 398, 48, 45, 45), Tx('Title', 'Certificate of Completion', 110, 31, 'PlayfairDisplay', '#2F4A2E'),
    Tx('Subtitle', 'WORKSHOP · SIES COMS', 164, 8.4, 'Montserrat', '#6E8A69', { ls: 0.4 }), Tx('Intro', 'AWARDED TO', 211, 9.3, 'Montserrat', '#6E8A69', { ls: 0.35 }),
    Nm(252, 38, 'DancingScript', '#2F4A2E'), Ln(269, 305, 303, '#5E7A5A', 0.8, { label: 'Name line' }),
    Tx('Body text', 'for successfully completing', 320, 11.8, 'PlayfairDisplay', '#4A5E47', { italic: true }),
    ...sigs('#5E7A5A', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#6E8A69', { ls: 0.25, cx: 647 }))] },
  { id: 'campus', name: 'SIES Heritage', tag: 'SIES', bg: '#FFFFFF', font: 'PinyonScript', size: 40, color: '#1F2A44', ink: '#2954A8', build: () => [
    Sh('Frame', 18, 18, 806, 559, { stroke: '#2954A8', sw: 1 }), Lk(351, 37, 140),
    Tx('Title', 'Certificate of Participation', 144, 24.4, 'TimesRoman', '#2954A8', { bold: true, ls: 0.04 }),
    Tx('Intro', 'This is to certify that', 211, 12.6, 'TimesRoman', '#4A4A55', { italic: true }), Nm(252, 39, 'PinyonScript', '#1F2A44'),
    Ln(253, 305, 337, '#2954A8', 0.8, { label: 'Name line' }), Tx('Body text', 'has participated in', 320, 12.2, 'TimesRoman', '#4A4A55'),
    ...sigs('#2954A8', 0.84, Tx('Date caption', 'DATE', 500, 8.4, 'TimesRoman', '#2954A8', { ls: 0.2, cx: 647 }))] },
  { id: 'tech', name: 'MCA 25', tag: 'Department', bg: '#FFFFFF', pattern: 'dots', font: 'Montserrat', size: 30, bold: true, color: '#1C3E80', ink: '#1C3E80', build: () => [
    Sh('Corner bracket', 25, 27, 185, 119, { stroke: '#1C3E80', sw: 2.5, sides: 'tl' }), Sh('Dot', 21, 142, 8, 8, { fill: '#1C3E80', radius: 4 }), Sh('Dot', 206, 23, 8, 8, { fill: '#1C3E80', radius: 4 }),
    Sh('Corner bracket', 632, 449, 185, 119, { stroke: '#FB8D31', sw: 2.5, sides: 'br' }), Sh('Dot', 813, 445, 8, 8, { fill: '#FB8D31', radius: 4 }),
    Im('MCA 25 badge', BADGE, 695, 33, 101, 101, { blend: 'multiply' }), Im('SIES sun', SUN, 47, 51, 50, 50),
    Tx('Title', 'CERTIFICATE', 80, 37, 'Montserrat', '#1C3E80', { bold: true, ls: 0.24 }), Tx('Subtitle', 'DEPARTMENT OF COMPUTER APPLICATIONS', 144, 8.8, 'Montserrat', '#E07A1F', { bold: true, ls: 0.32 }),
    Tx('Intro', 'This certifies that', 211, 10.9, 'Montserrat', '#4F5868'), Nm(258, 29.5, 'Montserrat', '#1C3E80', { bold: true }),
    Ln(261, 306, 320, '#8A9AB8', 0.84, { label: 'Name line', dash: true }), Tx('Body text', 'has successfully participated in', 320, 10.9, 'Montserrat', '#4F5868'),
    ...sigs('#1C3E80', 0.84, Tx('Date caption', 'DATE', 500, 7.2, 'Montserrat', '#1C3E80', { bold: true, ls: 0.25, cx: 647 }))] },
  { id: 'rose', name: 'Rose', tag: 'Cultural', bg: '#FFFFFF', font: 'PinyonScript', size: 40, color: '#5A1F2B', ink: '#5A1F2B', build: () => [
    Sh('Outer frame', 19, 19, 803, 557, { stroke: '#8C3B4A', sw: 4.6, dbl: true }), Sh('Inner frame', 37, 37, 768, 521, { stroke: '#C99AA2', sw: 0.6 }),
    Tx('Title', 'Certificate', 58, 59, 'GreatVibes', '#8C3B4A'), Tx('Subtitle', 'OF HONOUR', 156, 10, 'Cinzel', '#A8626E', { ls: 0.45 }),
    Tx('Intro', 'with warm regards, presented to', 211, 12.6, 'PlayfairDisplay', '#6E4048', { italic: true }), Nm(252, 39, 'PinyonScript', '#5A1F2B'),
    Ln(261, 305, 320, '#B0707A', 0.8, { label: 'Name line' }), Tx('Body text', 'for a memorable performance at', 320, 11.8, 'PlayfairDisplay', '#6E4048'),
    ...sigs('#8C3B4A', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Cinzel', '#A8626E', { ls: 0.3, cx: 647 })), Im('SIES sun', SUN, 396, 452, 50, 50, { opacity: 0.85 })] },
  { id: 'diagonal', name: 'Bold Stripes', tag: 'Competitions', bg: '#FFFFFF', font: 'GreatVibes', size: 40, color: '#2954A8', ink: '#111111', build: () => [
    Sh('Corner stripes', 623, -274, 337, 595, { rot: 38, grad: 'linear-gradient(90deg,#2954A8 0 42%,transparent 42% 52%,#FB8D31 52% 64%,transparent 64% 70%,#C9D6EE 70% 76%,transparent 76%)' }),
    Sh('Corner stripes', -118, 274, 337, 595, { rot: 38, grad: 'linear-gradient(270deg,#2954A8 0 42%,transparent 42% 52%,#FB8D31 52% 64%,transparent 64% 70%,#C9D6EE 70% 76%,transparent 76%)' }),
    Im('SIES sun', SUN, 47, 44, 38, 38), Tx('College name', 'SIES College of Management Studies', 54, 10.5, 'TimesRoman', '#2954A8', { bold: true, align: 'left', x: 92, w: 250 }),
    Tx('Title', 'CERTIFICATE', 89, 45, 'Montserrat', '#111111', { bold: true, ls: 0.08 }), Tx('Subtitle', 'OF ACHIEVEMENT', 155, 10.5, 'Montserrat', '#E07A1F', { bold: true, ls: 0.5 }),
    Tx('Intro', 'This is proudly awarded to', 211, 11.4, 'Montserrat', '#555555'), Nm(252, 40, 'GreatVibes', '#2954A8'),
    Ln(253, 305, 337, '#111111', 1, { label: 'Name line' }), Tx('Body text', 'for winning a place in', 320, 11.4, 'Montserrat', '#555555'),
    ...sigs('#111111', 0.84, Tx('Date caption', 'DATE', 500, 7.2, 'Montserrat', '#111111', { bold: true, ls: 0.25, cx: 647 }))] },
  { id: 'minimal', name: 'Minimal White', tag: 'Clean', bg: '#FFFFFF', font: 'CormorantGaramond', size: 42, italic: true, color: '#1F1D1A', ink: '#1F1D1A', build: () => [
    Sh('Top rule', 0, 0, 842, 4, { fill: '#2954A8' }), Im('SIES sun', SUN, 401, 42, 40, 40),
    Tx('Title', 'CERTIFICATE OF PARTICIPATION', 106, 15, 'Montserrat', '#1F1D1A', { bold: true, ls: 0.4 }), Sh('Short rule', 401, 142, 40, 1.5, { fill: '#2954A8' }),
    Tx('Intro', 'Presented to', 211, 11, 'Montserrat', '#7A756B', { ls: 0.1 }), Nm(248, 42, 'CormorantGaramond', '#1F1D1A', { italic: true }),
    Tx('Body text', 'for taking part in', 320, 11.4, 'Montserrat', '#55514A'),
    ...sigs('#BDB7AC', 0.67, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#7A756B', { ls: 0.25, cx: 647 }))] },
  { id: 'ivory', name: 'Ivory Merit', tag: 'Academic', bg: '#FFFFFF', font: 'EBGaramond', size: 38, italic: true, color: '#2B2620', ink: '#2B2620', build: () => [
    Sh('Outer frame', 22, 22, 798, 551, { stroke: '#2B2620', sw: 0.8 }), Sh('Inner frame', 30, 30, 782, 535, { stroke: '#8A7F6A', sw: 0.6 }), Lk(361, 46, 120),
    Tx('Title', 'Certificate of Merit', 126, 30, 'Marcellus', '#2B2620', { ls: 0.04 }), Tx('Subtitle', 'AWARDED WITH DISTINCTION', 172, 8, 'Montserrat', '#8A7F6A', { ls: 0.4 }),
    Tx('Intro', 'This is to certify that', 213, 12, 'EBGaramond', '#5A5246', { italic: true }), Nm(252, 38, 'EBGaramond', '#2B2620', { italic: true }),
    Ln(261, 305, 320, '#2B2620', 0.6, { label: 'Name line' }), Tx('Body text', 'has achieved merit in', 320, 12, 'EBGaramond', '#5A5246'),
    ...sigs('#2B2620', 0.6, Tx('Date caption', 'DATE', 500, 7.6, 'Marcellus', '#8A7F6A', { ls: 0.3, cx: 647 }))] },
  { id: 'teal', name: 'Teal Header', tag: 'Seminars', bg: '#FFFFFF', font: 'AlexBrush', size: 42, color: '#0F5257', ink: '#1F2A2B', build: () => [
    Sh('Header band', 0, 0, 842, 128, { fill: '#0F5257' }), Sh('Accent line', 0, 128, 842, 3, { fill: '#E9B44C' }), Im('SIES sun', SUN, 52, 36, 56, 56),
    Tx('College name', 'SIES COLLEGE OF MANAGEMENT STUDIES', 44, 8, 'Montserrat', '#BFE0DC', { ls: 0.3, align: 'left', x: 124, w: 340 }),
    Tx('Title', 'Certificate of Participation', 64, 22, 'PlayfairDisplay', '#FFFFFF', { align: 'left', x: 124, w: 500 }),
    Tx('Intro', 'This certificate is presented to', 205, 11.4, 'Montserrat', '#5C6B6C'), Nm(248, 42, 'AlexBrush', '#0F5257'),
    Ln(261, 305, 320, '#E9B44C', 1, { label: 'Name line' }), Tx('Body text', 'for participating in', 320, 11.4, 'Montserrat', '#5C6B6C'),
    ...sigs('#0F5257', 0.67, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#5C6B6C', { ls: 0.25, cx: 647 }))] },
  { id: 'graphite', name: 'Graphite', tag: 'Modern', bg: '#FFFFFF', font: 'Raleway', size: 32, color: '#1F2228', ink: '#1F2228', build: () => [
    Sh('Frame', 24, 24, 794, 547, { stroke: '#3A3D44', sw: 0.8 }), Sh('Accent bar', 391, 60, 60, 3, { fill: '#FB8D31' }),
    Tx('Title', 'CERTIFICATE', 82, 34, 'Raleway', '#1F2228', { bold: true, ls: 0.3 }), Tx('Subtitle', 'OF ACHIEVEMENT', 138, 9, 'Raleway', '#FB8D31', { bold: true, ls: 0.6 }),
    Tx('Intro', 'AWARDED TO', 208, 9.5, 'Raleway', '#5A5E66', { ls: 0.35 }), Nm(254, 32, 'Raleway', '#1F2228', { ls: 0.04 }),
    Ln(261, 305, 320, '#3A3D44', 0.8, { label: 'Name line' }), Tx('Body text', 'for outstanding work in', 320, 11, 'Raleway', '#5A5E66'),
    ...sigs('#3A3D44', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Raleway', '#FB8D31', { ls: 0.3, cx: 647 })), Im('SIES sun', SUN, 396, 452, 50, 50, { opacity: 0.9 })] },
  { id: 'lavender', name: 'Lavender', tag: 'Lectures', bg: '#FFFFFF', font: 'Parisienne', size: 38, color: '#3E2F5B', ink: '#3E2F5B', build: () => [
    Sh('Frame', 30, 30, 782, 535, { stroke: '#9C8FBF', sw: 1.2, radius: 24 }), Im('SIES sun', SUN, 398, 52, 46, 46, { opacity: 0.9 }),
    Tx('Title', 'Certificate of Attendance', 114, 28, 'JosefinSans', '#3E2F5B'), Tx('Subtitle', 'GUEST LECTURE SERIES', 160, 8, 'JosefinSans', '#7E6FA8', { ls: 0.45 }),
    Tx('Intro', 'This is to certify that', 211, 12, 'JosefinSans', '#5E537A'), Nm(252, 38, 'Parisienne', '#3E2F5B'),
    Ln(261, 305, 320, '#9C8FBF', 0.8, { label: 'Name line' }), Tx('Body text', 'attended', 320, 12, 'JosefinSans', '#5E537A'),
    ...sigs('#9C8FBF', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'JosefinSans', '#7E6FA8', { ls: 0.3, cx: 647 }))] },
  { id: 'crimson', name: 'Crimson Scholar', tag: 'Academic', bg: '#FFFFFF', font: 'AlexBrush', size: 42, color: '#7A1F2B', ink: '#2A2224', build: () => [
    Sh('Top bar', 0, 0, 842, 14, { fill: '#7A1F2B' }), Sh('Top hairline', 0, 18, 842, 1.5, { fill: '#C9A46A' }), Sh('Bottom hairline', 0, 576, 842, 1.5, { fill: '#C9A46A' }), Sh('Bottom bar', 0, 581, 842, 14, { fill: '#7A1F2B' }),
    Lk(47, 46, 150), Im('MCA 25 badge', BADGE, 714, 42, 84, 84, { blend: 'multiply' }),
    Tx('Title', 'Certificate', 108, 40, 'LibreBaskerville', '#7A1F2B'), Tx('Subtitle', 'OF ACADEMIC EXCELLENCE', 168, 9, 'Montserrat', '#A8805A', { ls: 0.45 }),
    Tx('Intro', 'is hereby awarded to', 213, 12, 'LibreBaskerville', '#5A4C4E', { italic: true }), Nm(250, 42, 'AlexBrush', '#7A1F2B'),
    Ln(253, 305, 337, '#C9A46A', 0.84, { label: 'Name line' }), Tx('Body text', 'in recognition of excellence in', 320, 11.6, 'LibreBaskerville', '#5A4C4E'),
    ...sigs('#7A1F2B', 0.67, Tx('Date caption', 'DATE', 500, 7.6, 'LibreBaskerville', '#A8805A', { ls: 0.3, cx: 647 }))] },
  { id: 'royal', name: 'Royal Blue Clean', tag: 'Formal · Blue', bg: '#FFFFFF', font: 'Allura', size: 46, color: '#1F4E9E', ink: '#1F4E9E', build: () => [
    Sh('Outer frame', 18, 18, 806, 559, { stroke: '#1F4E9E', sw: 1.6 }),
    Sh('Inner frame', 26, 26, 790, 543, { stroke: '#A9BEDF', sw: 0.7 }),
    Lk(48, 42, 150),
    Tx('Title', 'Certificate', 98, 40, 'Cinzel', '#1F4E9E', { ls: 0.1 }),
    Tx('Subtitle', 'OF ACHIEVEMENT', 150, 10, 'Montserrat', '#5B6577', { ls: 0.4 }),
    Ln(381, 168, 80, '#1F4E9E', 1.2),
    Tx('Intro', 'This certificate is proudly presented to', 210, 13, 'PlayfairDisplay', '#5B6577', { italic: true }),
    Nm(256, 46, 'Allura', '#1F4E9E'),
    Ln(241, 305, 360, '#1F4E9E', 0.8, { label: 'Name line' }),
    Tx('Body text', 'in recognition of outstanding participation in', 320, 12.5, 'PlayfairDisplay', '#2B3445'),
    ...sigs('#1F4E9E', 0.8, Tx('Date caption', 'DATE OF ISSUE', 500, 7.8, 'Montserrat', '#5B6577', { ls: 0.2, cx: 647 })),
    Tx('Footer', 'SIES COLLEGE OF MANAGEMENT STUDIES · NERUL, NAVI MUMBAI', 548, 7, 'Montserrat', '#1F4E9E', { ls: 0.3 })] },
  { id: 'emerald', name: 'Emerald & Gold', tag: 'Formal · Green', bg: '#FFFFFF', font: 'PinyonScript', size: 42, color: '#0E6B4F', ink: '#26332E', build: () => [
    Sh('Outer frame', 20, 20, 802, 555, { stroke: '#0E6B4F', sw: 2 }),
    Sh('Inner frame', 30, 30, 782, 535, { stroke: '#B8975A', sw: 0.7 }),
    Sh('Corner diamond TL', 26, 26, 8, 8, { fill: '#B8975A', rot: 45 }),
    Sh('Corner diamond TR', 808, 26, 8, 8, { fill: '#B8975A', rot: 45 }),
    Sh('Corner diamond BL', 26, 561, 8, 8, { fill: '#B8975A', rot: 45 }),
    Sh('Corner diamond BR', 808, 561, 8, 8, { fill: '#B8975A', rot: 45 }),
    Lk(50, 46, 150),
    Tx('Title', 'Certificate', 100, 38, 'CinzelDecorative', '#0E6B4F', { ls: 0.06 }),
    Tx('Subtitle', 'OF EXCELLENCE', 150, 9.5, 'Montserrat', '#B8975A', { ls: 0.5 }),
    Ln(361, 170, 50, '#B8975A', 0.8),
    Sh('Divider diamond', 417, 166, 8, 8, { fill: '#B8975A', rot: 45 }),
    Ln(431, 170, 50, '#B8975A', 0.8),
    Tx('Intro', 'is hereby awarded to', 212, 13, 'PlayfairDisplay', '#5E6B66', { italic: true }),
    Nm(258, 42, 'PinyonScript', '#0E6B4F'),
    Ln(251, 306, 340, '#B8975A', 0.9, { label: 'Name line' }),
    Tx('Body text', 'for distinguished achievement in', 321, 12.5, 'PlayfairDisplay', '#26332E'),
    ...sigs('#0E6B4F', 0.8, Tx('Date caption', 'DATE', 500, 7.6, 'Montserrat', '#B8975A', { ls: 0.3, cx: 647 })),
    Tx('Footer', 'SIES COLLEGE OF MANAGEMENT STUDIES', 548, 7, 'Montserrat', '#0E6B4F', { ls: 0.3 })] },
  { id: 'copper', name: 'Charcoal & Copper', tag: 'Formal · Modern', bg: '#FFFFFF', font: 'CormorantGaramond', size: 46, italic: true, color: '#2B2F36', ink: '#2B2F36', build: () => [
    Sh('Thin frame', 24, 24, 794, 547, { stroke: '#D5D7DB', sw: 0.6 }),
    Sh('Corner bracket TL', 24, 24, 90, 70, { stroke: '#B5693A', sw: 2.2, sides: 'tl' }),
    Sh('Corner bracket BR', 728, 501, 90, 70, { stroke: '#B5693A', sw: 2.2, sides: 'br' }),
    Lk(54, 48, 150),
    Tx('Title', 'CERTIFICATE', 96, 30, 'Raleway', '#2B2F36', { bold: true, ls: 0.32 }),
    Tx('Subtitle', 'OF EXCELLENCE', 140, 9.5, 'Raleway', '#B5693A', { bold: true, ls: 0.6 }),
    Sh('Copper rule', 391, 158, 60, 2.5, { fill: '#B5693A' }),
    Tx('Intro', 'PRESENTED TO', 208, 9, 'Raleway', '#6A6F78', { ls: 0.35 }),
    Nm(256, 46, 'CormorantGaramond', '#2B2F36', { italic: true }),
    Ln(251, 306, 340, '#B5693A', 0.9, { label: 'Name line' }),
    Tx('Body text', 'in recognition of exceptional contribution to', 321, 11, 'Raleway', '#6A6F78'),
    ...sigs('#2B2F36', 0.7, Tx('Date caption', 'DATE', 500, 7.6, 'Raleway', '#B5693A', { bold: true, ls: 0.3, cx: 647 })),
    Tx('Footer', 'SIES COLLEGE OF MANAGEMENT STUDIES', 556, 7, 'Raleway', '#6A6F78', { ls: 0.35 })] },
  { id: 'slate', name: 'Slate & Sky', tag: 'Formal · Airy', bg: '#FFFFFF', font: 'Italianno', size: 54, color: '#1E2D4A', ink: '#1E2D4A', build: () => [
    Sh('Top rule sky', 48, 26, 746, 2, { fill: '#3F8FD8' }),
    Sh('Top rule silver', 48, 32, 746, 0.7, { fill: '#B8C2D1' }),
    Sh('Bottom rule silver', 48, 563, 746, 0.7, { fill: '#B8C2D1' }),
    Sh('Bottom rule sky', 48, 567, 746, 2, { fill: '#3F8FD8' }),
    Lk(48, 46, 150),
    Tx('Title', 'Certificate of Completion', 98, 28, 'PlayfairDisplay', '#1E2D4A'),
    Tx('Subtitle', 'SIES COLLEGE OF MANAGEMENT STUDIES', 140, 8, 'Raleway', '#3F8FD8', { ls: 0.4 }),
    Sh('Square silver', 405, 157, 6, 6, { fill: '#B8C2D1' }),
    Sh('Square sky', 418, 157, 6, 6, { fill: '#3F8FD8' }),
    Sh('Square slate', 431, 157, 6, 6, { fill: '#1E2D4A' }),
    Tx('Intro', 'This is to certify that', 210, 12, 'JosefinSans', '#5F6B80'),
    Nm(260, 54, 'Italianno', '#1E2D4A'),
    Ln(241, 306, 360, '#B8C2D1', 1, { label: 'Name line' }),
    Tx('Body text', 'has successfully completed', 321, 12, 'JosefinSans', '#5F6B80'),
    ...sigs('#1E2D4A', 0.7, Tx('Date caption', 'DATE', 500, 7.6, 'JosefinSans', '#3F8FD8', { ls: 0.3, cx: 647 }))] },
];

export const templateById = (id: string): TemplateDef => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

/** The faint SIES campus sketch along the bottom of the page. */
export const campusItem = (t: { dark?: boolean }, page = A4): ImageItem =>
  Im('Campus illustration', CAMPUS, 0, page.h - 216, page.w, 216, { campus: true, dark: !!t.dark, opacity: t.dark ? 0.3 : 0.32, blend: t.dark ? 'screen' : 'multiply' });

/** A fresh design from a built-in template. */
export function designFromTemplate(id: string, campus: boolean, name = 'Untitled certificate'): Design {
  const t = templateById(id);
  const items = t.build();
  return {
    name, templateId: t.id, page: { ...A4 }, bg: t.bg, pattern: t.pattern || '', dark: !!t.dark,
    background: null, detected: null, items: campus ? [campusItem(t), ...items] : items,
  };
}

/** Lettering defaults for added details, taken from the template (or neutral ones for uploads). */
export interface Lettering { font: FontKey; size: number; bold?: boolean; italic?: boolean; color: string; ink: string; dark?: boolean }
export const UPLOAD_LETTERING: Lettering = { font: 'GreatVibes', size: 36, color: '#1F1D1A', ink: '#1F1D1A' };
export const letteringFor = (d: Pick<Design, 'templateId'>): Lettering => (d.templateId === 'upload' ? UPLOAD_LETTERING : templateById(d.templateId));

interface FieldPreset { label: string; sample: string; font?: FontKey; size?: number; w: number; h: number; bold?: boolean; align?: 'left' | 'center' | 'right'; fixed?: boolean; img?: string }
export const FIELD_PRESETS: Record<FieldType | 'signature_image' | 'logo_image', FieldPreset> = {
  recipient_name: { label: 'Recipient Name', sample: 'Aarav Sharma', w: 420, h: 54 },
  event_name: { label: 'Event Name', sample: 'Annual Tech Symposium 2026', font: 'PlayfairDisplay', size: 17, w: 380, h: 28, bold: true },
  issue_date: { label: 'Issue Date', sample: '4 November 2026', font: 'Montserrat', size: 11, w: 170, h: 22 },
  roll_number: { label: 'Roll Number / ID', sample: 'MCA-2026-014', font: 'Montserrat', size: 9, w: 150, h: 18, align: 'right' },
  authority_name: { label: 'Authority Name', sample: 'Dr. Meera Iyer', font: 'PlayfairDisplay', size: 12, w: 170, h: 20, fixed: true },
  authority_designation: { label: 'Designation', sample: 'Head of Department', font: 'Montserrat', size: 8, w: 170, h: 16, fixed: true },
  custom_text: { label: 'Custom Text', sample: 'Custom text', font: 'Montserrat', size: 12, w: 220, h: 22, fixed: true },
  signature_image: { label: 'Signature', sample: '', img: SIG, w: 130, h: 46 },
  logo_image: { label: 'Seal / Logo', sample: '', img: SUN, w: 64, h: 64 },
};
export const POS: Record<string, [number, number]> = {
  event_name: [231, 334], issue_date: [562, 466], authority_name: [110, 494], authority_designation: [110, 514],
  signature_image: [130, 442], roll_number: [646, 40], logo_image: [389, 449], custom_text: [311, 380],
};
export const LONG_NAME = 'Venkataraghavan Subramaniam Iyer';

/** A new detail (text field or image) styled to suit the current design. */
export function makeField(type: keyof typeof FIELD_PRESETS, x: number, y: number, L: Lettering): FieldItem | ImageItem {
  const t = FIELD_PRESETS[type];
  if (t.img) {
    const sig = type === 'signature_image';
    return { id: newId(), kind: 'image', type: type as ImageItem['type'], label: t.label, src: t.img, x, y, w: t.w, h: t.h, opacity: 1, blend: sig && !L.dark ? 'multiply' : '', dark: sig && !!L.dark, rot: 0 };
  }
  const nm = type === 'recipient_name';
  return {
    id: newId(), kind: 'field', type: type as FieldType, label: t.label, key: type, isDynamic: !t.fixed,
    sampleValue: t.fixed ? '' : t.sample, defaultValue: t.fixed ? t.sample : '', x, y, w: t.w, h: t.h, rot: 0,
    style: {
      fontFamily: nm ? L.font : t.font!, fontSize: nm ? L.size : t.size!, isBold: nm ? !!L.bold : !!t.bold, isItalic: nm ? !!L.italic : false,
      color: nm ? L.color : L.ink, alignment: t.align || 'center', autoShrink: true, minFontSize: nm ? 12 : 7, letterSpacing: 0,
    },
  };
}

export const makePatch = (x: number, y: number, w: number, h: number, fill: string): PatchItem =>
  ({ id: newId(), kind: 'patch', label: 'Cover patch', x, y, w, h, fill, opacity: 1, rot: 0 });
