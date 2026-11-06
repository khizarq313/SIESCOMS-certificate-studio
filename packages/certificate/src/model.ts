import { z } from 'zod';
import { FONT_KEYS } from './fonts';

// All coordinates are PDF points, measured from the page's top-left corner.

export const FIELD_TYPES = [
  'recipient_name', 'event_name', 'issue_date', 'roll_number',
  'authority_name', 'authority_designation', 'custom_text',
] as const;
export const IMAGE_TYPES = ['signature_image', 'logo_image'] as const;

const color = z.string().max(64);
const num = z.number();

export const TextStyleSchema = z.object({
  fontFamily: z.enum(FONT_KEYS),
  fontSize: num.min(1).max(400),
  isBold: z.boolean(),
  isItalic: z.boolean(),
  color,
  alignment: z.enum(['left', 'center', 'right']),
  autoShrink: z.boolean(),
  minFontSize: num.min(1).max(400),
  letterSpacing: num,
});

const base = {
  id: z.string().min(1).max(64),
  label: z.string().max(200),
  x: num, y: num, w: num.min(0), h: num.min(0),
  rot: num.optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

export const FieldItemSchema = z.object({
  ...base,
  kind: z.literal('field'),
  type: z.enum(FIELD_TYPES),
  /** Placeholder key, e.g. "recipient_name" or "authority_name_2". */
  key: z.string().min(1).max(80).regex(/^\w+$/),
  isDynamic: z.boolean(),
  sampleValue: z.string().max(500),
  defaultValue: z.string().max(500),
  /** The "Jane Sample" text in a built-in design, offered for swapping with the recipient name. */
  sample: z.boolean().optional(),
  style: TextStyleSchema,
});

export const ShapeItemSchema = z.object({
  ...base,
  kind: z.literal('shape'),
  fill: color, stroke: color, sw: num, radius: num,
  sides: z.string().max(8),
  dbl: z.boolean(), dash: z.boolean(),
  opacity: num.min(0).max(1),
  /** A CSS linear-gradient(), used by a couple of the built-in designs. */
  grad: z.string().max(400).regex(/^(linear-gradient\([#%\w\s,.()-]*\))?$/),
});

export const LineItemSchema = z.object({
  ...base,
  kind: z.literal('line'),
  color, thick: num.min(0), dash: z.boolean(),
});

/** "asset:<name>" for built-in art, "upload:<key>" for user uploads. */
export const ImageRefSchema = z.string().regex(/^(asset:[a-z]+|upload:[\w.-]+)$/);

export const ImageItemSchema = z.object({
  ...base,
  kind: z.literal('image'),
  type: z.enum(IMAGE_TYPES).optional(),
  src: ImageRefSchema,
  opacity: num.min(0).max(1),
  blend: z.enum(['', 'multiply', 'screen']),
  campus: z.boolean().optional(),
  dark: z.boolean().optional(),
});

export const LockupItemSchema = z.object({ ...base, kind: z.literal('lockup') });

export const PatchItemSchema = z.object({
  ...base,
  kind: z.literal('patch'),
  fill: color,
  opacity: num.min(0).max(1),
});

export const ItemSchema = z.discriminatedUnion('kind', [
  FieldItemSchema, ShapeItemSchema, LineItemSchema, ImageItemSchema, LockupItemSchema, PatchItemSchema,
]);

export const BackgroundSchema = z.object({
  fileKey: z.string().regex(/^[\w.-]+$/),
  fileType: z.enum(['pdf', 'png', 'jpg']),
  /** 0-based page of a PDF. */
  pageIndex: z.number().int().min(0),
  pages: z.number().int().min(1),
  fileName: z.string().max(300),
});

export const DetectedNameSchema = z.object({
  text: z.string().max(300),
  x: num, y: num, w: num, h: num,
  fontSize: num,
});

export const DesignSchema = z.object({
  name: z.string().max(200),
  /** Built-in template id, or "upload". */
  templateId: z.string().max(40),
  page: z.object({ w: num.min(72).max(5000), h: num.min(72).max(5000) }),
  bg: color,
  pattern: z.enum(['', 'dots']),
  dark: z.boolean(),
  background: BackgroundSchema.nullable(),
  detected: DetectedNameSchema.nullable(),
  items: z.array(ItemSchema).max(500),
});

export type TextStyle = z.infer<typeof TextStyleSchema>;
export type FieldType = (typeof FIELD_TYPES)[number];
export type FieldItem = z.infer<typeof FieldItemSchema>;
export type ShapeItem = z.infer<typeof ShapeItemSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type ImageItem = z.infer<typeof ImageItemSchema>;
export type LockupItem = z.infer<typeof LockupItemSchema>;
export type PatchItem = z.infer<typeof PatchItemSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type DetectedName = z.infer<typeof DetectedNameSchema>;
export type Design = z.infer<typeof DesignSchema>;

/** Field key → text shown on one certificate. */
export type Values = Record<string, string>;
