import { ASSET_FILES } from '@siescoms/certificate';

/** Image refs in a design → URLs the browser can load. */
export const resolveSrc = (ref: string): string => {
  if (ref.startsWith('asset:')) return `/api/static/assets/${ASSET_FILES[ref.slice(6)] || 'sun.svg'}`;
  if (ref.startsWith('upload:')) return `/api/files/${ref.slice(7)}`;
  return '';
};
