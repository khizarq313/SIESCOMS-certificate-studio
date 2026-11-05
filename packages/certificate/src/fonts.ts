// Certificate fonts. The same files back the editor (fonts.css) and the
// server-side PDF renderer, so what you see is what gets printed.

export const FONT_KEYS = [
  'GreatVibes', 'AlexBrush', 'DancingScript', 'PinyonScript', 'Allura', 'Parisienne', 'Italianno',
  'PlayfairDisplay', 'Cinzel', 'CinzelDecorative', 'CormorantGaramond', 'EBGaramond', 'LibreBaskerville', 'Marcellus', 'TimesRoman',
  'Montserrat', 'Raleway', 'Poppins', 'JosefinSans', 'Helvetica',
  'Courier',
] as const;

export type FontKey = (typeof FONT_KEYS)[number];

export interface FontInfo {
  /** Label shown in the font picker. */
  label: string;
  group: 'Script' | 'Serif' | 'Sans serif' | 'Monospace';
  /** CSS font-family stack. The first family is defined in fonts.css. */
  css: string;
}

export const FONTS: Record<FontKey, FontInfo> = {
  GreatVibes: { label: 'Great Vibes', group: 'Script', css: '"Great Vibes",cursive' },
  AlexBrush: { label: 'Alex Brush', group: 'Script', css: '"Alex Brush",cursive' },
  DancingScript: { label: 'Dancing Script', group: 'Script', css: '"Dancing Script",cursive' },
  PinyonScript: { label: 'Pinyon Script', group: 'Script', css: '"Pinyon Script",cursive' },
  Allura: { label: 'Allura', group: 'Script', css: 'Allura,cursive' },
  Parisienne: { label: 'Parisienne', group: 'Script', css: 'Parisienne,cursive' },
  Italianno: { label: 'Italianno', group: 'Script', css: 'Italianno,cursive' },
  PlayfairDisplay: { label: 'Playfair Display', group: 'Serif', css: '"Playfair Display",serif' },
  Cinzel: { label: 'Cinzel', group: 'Serif', css: 'Cinzel,serif' },
  CinzelDecorative: { label: 'Cinzel Decorative', group: 'Serif', css: '"Cinzel Decorative",serif' },
  CormorantGaramond: { label: 'Cormorant Garamond', group: 'Serif', css: '"Cormorant Garamond",serif' },
  EBGaramond: { label: 'EB Garamond', group: 'Serif', css: '"EB Garamond",serif' },
  LibreBaskerville: { label: 'Libre Baskerville', group: 'Serif', css: '"Libre Baskerville",serif' },
  Marcellus: { label: 'Marcellus', group: 'Serif', css: 'Marcellus,serif' },
  TimesRoman: { label: 'Times New Roman', group: 'Serif', css: 'Tinos,"Times New Roman",serif' },
  Montserrat: { label: 'Montserrat', group: 'Sans serif', css: 'Montserrat,sans-serif' },
  Raleway: { label: 'Raleway', group: 'Sans serif', css: 'Raleway,sans-serif' },
  Poppins: { label: 'Poppins', group: 'Sans serif', css: 'Poppins,sans-serif' },
  JosefinSans: { label: 'Josefin Sans', group: 'Sans serif', css: '"Josefin Sans",sans-serif' },
  Helvetica: { label: 'Helvetica', group: 'Sans serif', css: 'Arimo,Helvetica,Arial,sans-serif' },
  Courier: { label: 'Courier', group: 'Monospace', css: 'Cousine,"Courier New",monospace' },
};

export const FONT_GROUPS = ['Script', 'Serif', 'Sans serif', 'Monospace'] as const;

export function fontCss(key: string): string {
  return (FONTS as Record<string, FontInfo>)[key]?.css ?? FONTS.Helvetica.css;
}

/** The CSS family name (first entry of the stack), used to preload fonts before printing. */
export function fontFamilyName(key: string): string {
  return fontCss(key).split(',')[0].replace(/"/g, '');
}
