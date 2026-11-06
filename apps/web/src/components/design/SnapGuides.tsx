'use client';
import { pct, type PageSize } from '@siescoms/certificate';
import { useApp } from '@/lib/store';

const ptToMm = (pt: number) => `${((pt * 25.4) / 72).toFixed(1)} mm`;

export function SnapGuides({ page }: { page: PageSize }) {
  const snap = useApp((s) => s.snap);
  if (!snap || (!snap.guides.length && !snap.gaps.length && !snap.badge)) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9,
        overflow: 'visible',
      }}
    >
      {/* 1. Alignment & Margin Guides */}
      {snap.guides.map((g, idx) => {
        const isMargin = g.kind === 'margin';
        if (g.axis === 'v') {
          return (
            <div
              key={`g-v-${idx}-${g.pos}`}
              style={{
                position: 'absolute',
                left: pct(g.pos, page.w),
                top: pct(g.from, page.h),
                height: pct(g.to - g.from, page.h),
                width: 0,
                borderLeft: isMargin ? '1px dashed #E0457B' : '1px solid #E0457B',
                opacity: isMargin ? 0.55 : 1,
                transform: 'translateX(-0.5px)',
                pointerEvents: 'none',
              }}
            />
          );
        }
        return (
          <div
            key={`g-h-${idx}-${g.pos}`}
            style={{
              position: 'absolute',
              top: pct(g.pos, page.h),
              left: pct(g.from, page.w),
              width: pct(g.to - g.from, page.w),
              height: 0,
              borderTop: isMargin ? '1px dashed #E0457B' : '1px solid #E0457B',
              opacity: isMargin ? 0.55 : 1,
              transform: 'translateY(-0.5px)',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* 2. Gap Marks & Distance Brackets */}
      {snap.gaps.map((m, idx) => {
        if (m.dir === 'horizontal') {
          return (
            <div
              key={`gap-h-${idx}-${m.a}-${m.b}`}
              style={{
                position: 'absolute',
                left: pct(m.a, page.w),
                top: pct(m.at, page.h),
                width: pct(m.b - m.a, page.w),
                height: 0,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderTop: '1px solid #E0457B',
                  transform: 'translateY(-0.5px)',
                }}
              />
              {/* Left tick */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -4,
                  width: 1,
                  height: 8,
                  background: '#E0457B',
                }}
              />
              {/* Right tick */}
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: -4,
                  width: 1,
                  height: 8,
                  background: '#E0457B',
                }}
              />
              {/* Center pill */}
              <div
                className="snap-pill"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {ptToMm(m.value)}
              </div>
            </div>
          );
        }

        // Vertical bracket
        return (
          <div
            key={`gap-v-${idx}-${m.a}-${m.b}`}
            style={{
              position: 'absolute',
              left: pct(m.at, page.w),
              top: pct(m.a, page.h),
              height: pct(m.b - m.a, page.h),
              width: 0,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderLeft: '1px solid #E0457B',
                transform: 'translateX(-0.5px)',
              }}
            />
            {/* Top tick */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: -4,
                width: 8,
                height: 1,
                background: '#E0457B',
              }}
            />
            {/* Bottom tick */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: -4,
                width: 8,
                height: 1,
                background: '#E0457B',
              }}
            />
            {/* Center pill */}
            <div
              className="snap-pill"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {ptToMm(m.value)}
            </div>
          </div>
        );
      })}

      {/* 3. Resizing Size Badge */}
      {snap.badge && (
        <div
          className="snap-badge"
          style={{
            position: 'absolute',
            left: pct(snap.badge.x, page.w),
            top: pct(snap.badge.y, page.h),
            transform: 'translate(10px, 10px)',
          }}
        >
          {snap.badge.text}
        </div>
      )}
    </div>
  );
}
