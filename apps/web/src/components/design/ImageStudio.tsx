'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  autoTrimBounds,
  cropRaster,
  hasTransparency,
  processLogo,
  processSignature,
  SIGNATURE_INK,
  type InkChoice,
  type Raster,
} from '@siescoms/certificate';

interface ImageStudioProps {
  file: File;
  kind: 'signature' | 'logo';
  onCancel(): void;
  onApply(out: { blob: Blob; width: number; height: number; transparent: boolean }): Promise<void>;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ImageStudio({ file, kind, onCancel, onApply }: ImageStudioProps) {
  const [mounted, setMounted] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Source image state
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [workingRaster, setWorkingRaster] = useState<Raster | null>(null);
  const [fastRaster, setFastRaster] = useState<Raster | null>(null);

  // Settings
  const [removeBg, setRemoveBg] = useState(true);
  const [sensitivity, setSensitivity] = useState(50);
  const [boldness, setBoldness] = useState(50);
  const [ink, setInk] = useState<InkChoice>('original');
  const [previewPaper, setPreviewPaper] = useState(false); // false = transparent, true = white paper

  // Crop state in workingRaster coordinates
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 });
  const [userCropped, setUserCropped] = useState(false);

  // DOM Refs
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<Element | null>(null);

  // Dragging crop state
  const dragRef = useRef<{
    handle: string | null; // 'move' or handle name
    startX: number;
    startY: number;
    startCrop: CropBox;
    scale: number;
  } | null>(null);

  // Store trigger element on mount to restore focus on unmount
  useEffect(() => {
    setMounted(true);
    triggerElementRef.current = document.activeElement;
    return () => {
      if (triggerElementRef.current && 'focus' in triggerElementRef.current) {
        (triggerElementRef.current as HTMLElement).focus();
      }
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  // Decode file to working raster
  const decodeFile = useCallback(async () => {
    if (file.size > 15 * 1024 * 1024) {
      setErr('File exceeds the 15 MB limit. Please use a smaller picture.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr('');

    try {
      let bmp: ImageBitmap;
      try {
        bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        setErr("This picture format isn't supported. Please use a PNG, JPG or WebP file.");
        setLoading(false);
        return;
      }

      // Render to working canvas no larger than 1600px
      const maxDim = 1600;
      let w = bmp.width;
      let h = bmp.height;
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();

      const imgData = ctx.getImageData(0, 0, w, h);
      const full: Raster = { data: imgData.data, width: w, height: h };
      setWorkingRaster(full);

      // Fast preview copy (max 700px)
      const fastDim = 700;
      let fw = w;
      let fh = h;
      if (fw > fastDim || fh > fastDim) {
        if (fw >= fh) {
          fh = Math.round((fh * fastDim) / fw);
          fw = fastDim;
        } else {
          fw = Math.round((fw * fastDim) / fh);
          fh = fastDim;
        }
      }
      const fc = document.createElement('canvas');
      fc.width = fw;
      fc.height = fh;
      const fctx = fc.getContext('2d');
      if (fctx) {
        fctx.drawImage(c, 0, 0, fw, fh);
        const fData = fctx.getImageData(0, 0, fw, fh);
        setFastRaster({ data: fData.data, width: fw, height: fh });
      }

      // Initial crop = full image
      const initialCrop = { x: 0, y: 0, w, h };
      setCrop(initialCrop);

      // Auto-trim once automatically
      const testProcessed = kind === 'signature'
        ? processSignature(full, { removeBackground: true, sensitivity: 50, boldness: 50, ink: 'original' })
        : processLogo(full, { removeBackground: true, tolerance: 35 });
      const bounds = autoTrimBounds(testProcessed);
      if (bounds) {
        setCrop(bounds);
      }
      setUserCropped(false);
      setLoading(false);
    } catch (e: any) {
      setErr(e.message || 'Failed to decode image.');
      setLoading(false);
    }
  }, [file, kind]);

  useEffect(() => {
    decodeFile();
  }, [decodeFile]);

  // Handle Rotation
  const rotate = (angleDeg: number) => {
    if (!workingRaster) return;
    const { width: w, height: h, data } = workingRaster;

    // Create canvas to rotate
    const srcC = document.createElement('canvas');
    srcC.width = w;
    srcC.height = h;
    const sctx = srcC.getContext('2d')!;
    const sImg = sctx.createImageData(w, h);
    sImg.data.set(data);
    sctx.putImageData(sImg, 0, 0);

    const rad = (angleDeg * Math.PI) / 180;
    const swap = Math.abs(angleDeg) === 90;
    const nw = swap ? h : w;
    const nh = swap ? w : h;

    const rotC = document.createElement('canvas');
    rotC.width = nw;
    rotC.height = nh;
    const rctx = rotC.getContext('2d', { willReadFrequently: true })!;
    rctx.translate(nw / 2, nh / 2);
    rctx.rotate(rad);
    rctx.drawImage(srcC, -w / 2, -h / 2);

    const newFullData = rctx.getImageData(0, 0, nw, nh);
    const newFull: Raster = { data: newFullData.data, width: nw, height: nh };
    setWorkingRaster(newFull);
    setRotation((r) => (r + angleDeg + 360) % 360);

    // Fast copy
    const fastDim = 700;
    let fw = nw, fh = nh;
    if (fw > fastDim || fh > fastDim) {
      if (fw >= fh) { fh = Math.round((fh * fastDim) / fw); fw = fastDim; }
      else { fw = Math.round((fw * fastDim) / fh); fh = fastDim; }
    }
    const fc = document.createElement('canvas');
    fc.width = fw; fc.height = fh;
    const fctx = fc.getContext('2d')!;
    fctx.drawImage(rotC, 0, 0, fw, fh);
    const fData = fctx.getImageData(0, 0, fw, fh);
    setFastRaster({ data: fData.data, width: fw, height: fh });

    // Reset crop to new boundaries
    const newCrop = { x: 0, y: 0, w: nw, h: nh };
    setCrop(newCrop);
    setUserCropped(false);
  };

  // Re-render preview canvas with debouncing
  useEffect(() => {
    if (!workingRaster) return;

    const timer = setTimeout(() => {
      const srcRaster = fastRaster || workingRaster;
      const isScaleDown = srcRaster !== workingRaster;
      const scale = isScaleDown ? srcRaster.width / workingRaster.width : 1;

      // Process whole preview raster
      let processed: Raster;
      if (kind === 'signature') {
        processed = processSignature(srcRaster, {
          removeBackground: removeBg,
          sensitivity,
          boldness,
          ink,
        });
      } else {
        processed = processLogo(srcRaster, {
          removeBackground: removeBg,
          tolerance: sensitivity,
        });
      }

      // Draw onto canvasRef
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = processed.width;
      canvas.height = processed.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imgData = ctx.createImageData(processed.width, processed.height);
      imgData.data.set(processed.data);
      ctx.putImageData(imgData, 0, 0);
    }, 60);

    return () => clearTimeout(timer);
  }, [workingRaster, fastRaster, removeBg, sensitivity, boldness, ink, kind]);

  // Auto-trim button action
  const handleAutoTrim = () => {
    if (!workingRaster) return;
    const processed = kind === 'signature'
      ? processSignature(workingRaster, { removeBackground: removeBg, sensitivity, boldness, ink })
      : processLogo(workingRaster, { removeBackground: removeBg, tolerance: sensitivity });
    const bounds = autoTrimBounds(processed);
    if (bounds) {
      setCrop(bounds);
      setUserCropped(true);
    }
  };

  // Reset crop action
  const handleResetCrop = () => {
    if (!workingRaster) return;
    setCrop({ x: 0, y: 0, w: workingRaster.width, h: workingRaster.height });
    setUserCropped(true);
  };

  // Pointer events for interactive 8-handle crop overlay
  const onPointerDownCrop = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const canvas = canvasRef.current;
    if (!canvas || !workingRaster) return;
    const rect = canvas.getBoundingClientRect();
    const scale = workingRaster.width / rect.width;

    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      scale,
    };
  };

  const onPointerMoveCrop = (e: React.PointerEvent) => {
    if (!dragRef.current || !workingRaster) return;
    e.preventDefault();
    const { handle, startX, startY, startCrop, scale } = dragRef.current;
    const dx = (e.clientX - startX) * scale;
    const dy = (e.clientY - startY) * scale;

    setUserCropped(true);
    const W = workingRaster.width;
    const H = workingRaster.height;
    let { x, y, w, h } = startCrop;

    if (handle === 'move') {
      x = Math.max(0, Math.min(W - w, Math.round(startCrop.x + dx)));
      y = Math.max(0, Math.min(H - h, Math.round(startCrop.y + dy)));
    } else {
      if (handle?.includes('w')) {
        const newX = Math.max(0, Math.min(startCrop.x + startCrop.w - 20, Math.round(startCrop.x + dx)));
        w = startCrop.w + (startCrop.x - newX);
        x = newX;
      }
      if (handle?.includes('e')) {
        w = Math.max(20, Math.min(W - startCrop.x, Math.round(startCrop.w + dx)));
      }
      if (handle?.includes('n')) {
        const newY = Math.max(0, Math.min(startCrop.y + startCrop.h - 20, Math.round(startCrop.y + dy)));
        h = startCrop.h + (startCrop.y - newY);
        y = newY;
      }
      if (handle?.includes('s')) {
        h = Math.max(20, Math.min(H - startCrop.y, Math.round(startCrop.h + dy)));
      }
    }

    setCrop({ x, y, w, h });
  };

  const onPointerUpCrop = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
    }
  };

  // Execute Apply
  const handleApply = async () => {
    if (!workingRaster) return;
    setSaving(true);
    setErr('');

    try {
      // 1. Process full-size raster
      const fullProcessed = kind === 'signature'
        ? processSignature(workingRaster, { removeBackground: removeBg, sensitivity, boldness, ink })
        : processLogo(workingRaster, { removeBackground: removeBg, tolerance: sensitivity });

      // 2. Crop to rectangle
      let finalCrop = { ...crop };
      if (!userCropped) {
        const bounds = autoTrimBounds(fullProcessed);
        if (bounds) finalCrop = bounds;
      }
      let cropped = cropRaster(fullProcessed, finalCrop);

      // 3. Scale so width is at most 1200px
      const maxW = 1200;
      let outW = cropped.width;
      let outH = cropped.height;
      if (outW > maxW) {
        outH = Math.round((outH * maxW) / outW);
        outW = maxW;
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext('2d')!;

      // Draw cropped raster to canvas
      const tmpC = document.createElement('canvas');
      tmpC.width = cropped.width;
      tmpC.height = cropped.height;
      const tmpCtx = tmpC.getContext('2d')!;
      const tmpData = tmpCtx.createImageData(cropped.width, cropped.height);
      tmpData.data.set(cropped.data);
      tmpCtx.putImageData(tmpData, 0, 0);

      outCtx.drawImage(tmpC, 0, 0, outW, outH);

      // 4. Convert to PNG blob under 3.5 MB
      let blob: Blob | null = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode PNG image.');

      while (blob.size > 3.5 * 1024 * 1024 && outW > 200) {
        outW = Math.round(outW * 0.85);
        outH = Math.round(outH * 0.85);
        outCanvas.width = outW;
        outCanvas.height = outH;
        outCtx.drawImage(tmpC, 0, 0, outW, outH);
        blob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not encode PNG image.');
      }

      const transparent = hasTransparency(cropped);
      await onApply({ blob, width: outW, height: outH, transparent });
    } catch (e: any) {
      setErr(e.message || 'Failed to save processed image.');
      setSaving(false);
    }
  };

  if (!mounted) return null;

  // Compute crop box style relative to preview canvas
  const canvasW = canvasRef.current?.width || workingRaster?.width || 1;
  const canvasH = canvasRef.current?.height || workingRaster?.height || 1;
  const cropLeftPct = ((crop.x / (workingRaster?.width || 1)) * 100);
  const cropTopPct = ((crop.y / (workingRaster?.height || 1)) * 100);
  const cropWidthPct = ((crop.w / (workingRaster?.width || 1)) * 100);
  const cropHeightPct = ((crop.h / (workingRaster?.height || 1)) * 100);

  const estSizeKb = Math.round((crop.w * crop.h * 4) / 1024 * 0.15); // rough estimate

  return createPortal(
    <div
      className="img-studio-backdrop"
      onPointerDown={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="img-studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-title"
      >
        <div className="img-studio-head">
          <h2 id="image-studio-title">
            {kind === 'signature' ? 'Signature Studio' : 'Logo & Seal Studio'}
          </h2>
          <button
            type="button"
            className="round-btn"
            aria-label="Close"
            onClick={onCancel}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {err && <div className="img-studio-err">{err}</div>}

        <div className="img-studio-body">
          {/* Left Side: Preview Canvas + Interactive Crop Overlay */}
          <div className="img-studio-preview-col">
            <div className="img-studio-toolbar">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => rotate(-90)}
                disabled={loading || saving}
                title="Rotate 90° Left"
              >
                ↺ Rotate Left
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => rotate(90)}
                disabled={loading || saving}
                title="Rotate 90° Right"
              >
                ↻ Rotate Right
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleAutoTrim}
                disabled={loading || saving}
                title="Auto-crop to content"
              >
                Auto-trim
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetCrop}
                disabled={loading || saving}
              >
                Reset crop
              </button>
            </div>

            <div
              ref={containerRef}
              className={`img-studio-canvas-wrap ${previewPaper ? 'paper-bg' : 'checker-bg'}`}
              onPointerMove={onPointerMoveCrop}
              onPointerUp={onPointerUpCrop}
              onPointerCancel={onPointerUpCrop}
            >
              <canvas ref={canvasRef} className="img-studio-canvas" />

              {/* Crop Rect Overlay */}
              {!loading && workingRaster && (
                <div
                  className="crop-overlay"
                  style={{
                    left: `${cropLeftPct}%`,
                    top: `${cropTopPct}%`,
                    width: `${cropWidthPct}%`,
                    height: `${cropHeightPct}%`,
                  }}
                  onPointerDown={(e) => onPointerDownCrop(e, 'move')}
                >
                  <div className="crop-box-border" />
                  {/* 8 Handles */}
                  <div className="crop-handle nw" onPointerDown={(e) => onPointerDownCrop(e, 'nw')} />
                  <div className="crop-handle n" onPointerDown={(e) => onPointerDownCrop(e, 'n')} />
                  <div className="crop-handle ne" onPointerDown={(e) => onPointerDownCrop(e, 'ne')} />
                  <div className="crop-handle e" onPointerDown={(e) => onPointerDownCrop(e, 'e')} />
                  <div className="crop-handle se" onPointerDown={(e) => onPointerDownCrop(e, 'se')} />
                  <div className="crop-handle s" onPointerDown={(e) => onPointerDownCrop(e, 's')} />
                  <div className="crop-handle sw" onPointerDown={(e) => onPointerDownCrop(e, 'sw')} />
                  <div className="crop-handle w" onPointerDown={(e) => onPointerDownCrop(e, 'w')} />
                </div>
              )}
            </div>

            <div className="img-studio-meta">
              <span>{Math.round(crop.w)} × {Math.round(crop.h)} px · ~{estSizeKb} KB</span>
            </div>
          </div>

          {/* Right Side: Adjustment Controls */}
          <div className="img-studio-controls-col">
            <div className="switch-row">
              <label htmlFor="chk-remove-bg">Remove background</label>
              <input
                id="chk-remove-bg"
                type="checkbox"
                checked={removeBg}
                onChange={(e) => setRemoveBg(e.target.checked)}
                disabled={saving}
              />
            </div>

            <div className="field">
              <div className="row-between">
                <span>{kind === 'signature' ? 'Detail' : 'Edge tolerance'}</span>
                <span className="hint">{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                disabled={!removeBg || saving}
              />
              <div className="row-between text-xs" style={{ color: 'var(--ink-2)' }}>
                <span>Cleaner</span>
                <span>More detail</span>
              </div>
            </div>

            {kind === 'signature' && (
              <>
                <div className="field">
                  <span>Ink colour</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {(['original', 'blue', 'black'] as InkChoice[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`toggle-chip grow ${ink === c ? 'on' : ''}`}
                        onClick={() => setInk(c)}
                        disabled={!removeBg || saving}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            marginRight: 6,
                            background:
                              c === 'blue'
                                ? SIGNATURE_INK.blue
                                : c === 'black'
                                ? SIGNATURE_INK.black
                                : 'linear-gradient(135deg, #2954A8, #FB8D31)',
                          }}
                        />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                  {!removeBg && (
                    <span className="hint">Turn on Remove background to change the ink colour</span>
                  )}
                </div>

                <div className="field">
                  <div className="row-between">
                    <span>Ink boldness</span>
                    <span className="hint">{boldness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={boldness}
                    onChange={(e) => setBoldness(Number(e.target.value))}
                    disabled={!removeBg || saving}
                  />
                </div>
              </>
            )}

            <div className="field">
              <span>Preview on</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  className={`chip ${!previewPaper ? 'on' : ''}`}
                  onClick={() => setPreviewPaper(false)}
                >
                  Transparent
                </button>
                <button
                  type="button"
                  className={`chip ${previewPaper ? 'on' : ''}`}
                  onClick={() => setPreviewPaper(true)}
                >
                  White paper
                </button>
              </div>
            </div>

            <div className="img-studio-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApply}
                disabled={loading || saving}
              >
                {saving
                  ? 'Saving…'
                  : kind === 'signature'
                  ? 'Use this signature'
                  : 'Use this image'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
