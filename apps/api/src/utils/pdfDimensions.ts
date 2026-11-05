import { PDFDocument } from 'pdf-lib';

export interface DocumentInfo { page: { w: number; h: number }; pages: number }

/** Page size in points (images: pixels treated as points, capped to a sensible page). */
export async function extractDocumentInfo(bytes: Buffer, fileType: 'pdf' | 'png' | 'jpg', pageIndex = 0): Promise<DocumentInfo> {
  if (fileType === 'pdf') {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPageCount();
    const p = doc.getPage(Math.min(Math.max(0, pageIndex), pages - 1));
    const { width, height } = p.getSize();
    const rotated = (p.getRotation().angle / 90) % 2 !== 0;
    return { page: { w: Math.round(rotated ? height : width), h: Math.round(rotated ? width : height) }, pages };
  }
  const doc = await PDFDocument.create();
  const img = fileType === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  // Fit the long side to A4 (842 pt) so text sizes stay familiar.
  const k = 842 / Math.max(img.width, img.height);
  return { page: { w: Math.round(img.width * k), h: Math.round(img.height * k) }, pages: 1 };
}
