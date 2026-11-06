/** @jsxRuntime automatic */
/** @jsxImportSource react */
// One renderer for every place a certificate appears: gallery thumbnails, the
// editor, previews, and the server-side PDF. Sizes use container query units,
// so the same markup scales from a 230px thumbnail to a printed page.
import type { CSSProperties, ReactNode } from 'react';
import { fontCss } from './fonts';
import { displaySize } from './metrics';
import type { Design, FieldItem, Item, Values } from './model';
import { fieldText } from './values';

export type ResolveSrc = (ref: string) => string;

export interface PageSize { w: number; h: number }

export const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
/** Points → cqw for a page `pageW` points wide. */
export const cqw = (pt: number, pageW: number) => `${((pt / pageW) * 100).toFixed(4)}cqw`;

/** Position and size of an item's box; shared with the editor's selection layer. */
export function itemBox(it: Item, page: PageSize): CSSProperties {
  return {
    position: 'absolute',
    left: pct(it.x, page.w), top: pct(it.y, page.h), width: pct(it.w, page.w), height: pct(it.h, page.h),
    boxSizing: 'border-box',
    transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
  };
}

export function pageStyle(d: Pick<Design, 'bg' | 'pattern' | 'page'>, transparent = false): CSSProperties {
  return {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: transparent ? 'transparent' : d.bg,
    backgroundImage: d.pattern === 'dots' ? `radial-gradient(#C7D1E4 ${cqw(0.76, 842)}, transparent ${cqw(0.84, 842)})` : undefined,
    backgroundSize: d.pattern === 'dots' ? `${cqw(18.5, 842)} ${cqw(18.5, 842)}` : undefined,
  };
}

/** The SIES College of Management Studies logo lockup. */
export function SiesLockup({ width, page, sun }: { width: number; page: PageSize; sun: string }) {
  const T = "Tinos,'Times New Roman',serif";
  return (
    <div style={{ fontSize: cqw(width / 46, page.w), display: 'grid', gridTemplateColumns: 'auto auto', columnGap: '1.5em', rowGap: '1.4em', alignItems: 'end', width: 'max-content', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sun} alt="" style={{ width: '14em', height: '14em', marginBottom: '1.2em' }} />
        <span style={{ font: `400 6.9em/.7 ${T}`, color: '#2C5AA8' }}>SIES</span>
      </div>
      <div style={{ background: '#2954A8', width: '29.7em', height: '11.6em', padding: '1.1em 1em 0 5em', boxSizing: 'border-box' }}>
        <div style={{ color: '#fff', font: `700 3.45em/.98 ${T}`, whiteSpace: 'nowrap' }}>College of<br />Management<br />Studies</div>
      </div>
      <div style={{ gridColumn: '1/-1', font: `400 2.1em/1 ${T}`, letterSpacing: '.56em', color: '#444', whiteSpace: 'nowrap' }}>RISE WITH EDUCATION</div>
    </div>
  );
}

function FieldText({ it, text, page }: { it: FieldItem; text: string; page: PageSize }) {
  const st = it.style;
  const processedText = st.uppercase ? text.toUpperCase() : text;
  return (
    <div style={{
      fontFamily: fontCss(st.fontFamily), fontSize: cqw(displaySize(it, text), page.w),
      fontWeight: st.isBold ? 700 : 400, fontStyle: st.isItalic ? 'italic' : 'normal', color: st.color,
      letterSpacing: cqw(st.letterSpacing || 0, page.w),
      whiteSpace: st.wrap ? 'pre-wrap' : 'nowrap',
      overflowWrap: st.wrap ? 'break-word' : undefined,
      lineHeight: st.lineHeight ?? 1.15,
      width: '100%',
      textAlign: st.alignment,
      textDecoration: st.underline ? 'underline' : undefined,
      textUnderlineOffset: st.underline ? '0.14em' : undefined,
      textDecorationThickness: st.underline ? '0.06em' : undefined,
      textShadow: st.shadow ? '0 0.04em 0.08em rgba(0,0,0,0.28)' : undefined,
    }}>{processedText}</div>
  );
}

export function CertItem({ it, values, page, resolveSrc }: { it: Item; values: Values; page: PageSize; resolveSrc: ResolveSrc }) {
  if (it.hidden) return null;
  const box: CSSProperties = { ...itemBox(it, page), pointerEvents: 'none' };
  switch (it.kind) {
    case 'field': {
      const al = it.style.alignment || 'center';
      const isWrap = !!it.style.wrap;
      Object.assign(box, {
        display: 'flex',
        alignItems: isWrap ? 'flex-start' : 'center',
        justifyContent: al === 'left' ? 'flex-start' : al === 'right' ? 'flex-end' : 'center',
      });
      return <div style={box} data-item={it.id}><FieldText it={it} text={fieldText(it, values)} page={page} /></div>;
    }
    case 'shape': {
      const b = it.stroke ? `${cqw(it.sw, page.w)} ${it.dbl ? 'double' : it.dash ? 'dashed' : 'solid'} ${it.stroke}` : 'none';
      const inner: CSSProperties = { position: 'absolute', inset: 0, boxSizing: 'border-box', background: it.grad || it.fill || 'transparent', borderRadius: cqw(it.radius, page.w), opacity: it.opacity };
      if (it.sides === 'all') inner.border = b;
      else {
        inner.borderTop = it.sides.includes('t') ? b : 'none';
        inner.borderBottom = it.sides.includes('b') ? b : 'none';
        inner.borderLeft = it.sides.includes('l') ? b : 'none';
        inner.borderRight = it.sides.includes('r') ? b : 'none';
      }
      return <div style={box} data-item={it.id}><div style={inner} /></div>;
    }
    case 'line':
      return (
        <div style={box} data-item={it.id}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 0, borderTop: `${cqw(it.thick, page.w)} ${it.dash ? 'dashed' : 'solid'} ${it.color}`, transform: 'translateY(-50%)' }} />
        </div>
      );
    case 'patch':
      return <div style={{ ...box, background: it.fill, opacity: it.opacity }} data-item={it.id} />;
    case 'image': {
      const img: CSSProperties = {
        width: '100%', height: '100%', backgroundImage: `url("${resolveSrc(it.src)}")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        backgroundSize: it.campus ? '100% 100%' : 'contain', opacity: it.opacity, mixBlendMode: it.blend || undefined, filter: it.dark ? 'invert(1)' : undefined,
      };
      if (it.campus) { img.WebkitMaskImage = 'linear-gradient(transparent,#000 50%)'; img.maskImage = 'linear-gradient(transparent,#000 50%)'; }
      return <div style={box} data-item={it.id}><div style={img} /></div>;
    }
    case 'lockup':
      return <div style={box} data-item={it.id}><SiesLockup width={it.w} page={page} sun={resolveSrc('asset:sun')} /></div>;
  }
}

export interface CertificateProps {
  design: Pick<Design, 'page' | 'bg' | 'pattern' | 'items'>;
  values: Values;
  resolveSrc: ResolveSrc;
  /** Image of an uploaded certificate, drawn under everything else. */
  backgroundUrl?: string | null;
  /** Leave the page see-through (the server stamps this onto an uploaded PDF). */
  transparent?: boolean;
  style?: CSSProperties;
  className?: string;
  /** Extra layers drawn above the certificate, e.g. the editor's selection handles. */
  children?: ReactNode;
}

export function Certificate({ design, values, resolveSrc, backgroundUrl, transparent, style, className, children }: CertificateProps) {
  const page = design.page;
  return (
    <div className={className} style={{ position: 'relative', width: '100%', aspectRatio: `${page.w}/${page.h}`, containerType: 'inline-size', ...style }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
        <div style={pageStyle(design, transparent)} />
        {backgroundUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        ) : null}
        {design.items.map((it) => <CertItem key={it.id} it={it} values={values} page={page} resolveSrc={resolveSrc} />)}
      </div>
      {children}
    </div>
  );
}
