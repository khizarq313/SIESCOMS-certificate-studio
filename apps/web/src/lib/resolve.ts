import { ASSET_FILES } from '@siescoms/certificate';
import { resolveApiUrl } from './api';

/** Image refs in a design → URLs the browser can load. */
export const resolveSrc = (ref: string): string => {
  if (ref.startsWith('asset:')) return resolveApiUrl(`/api/static/assets/${ASSET_FILES[ref.slice(6)] || 'sun.svg'}`);
  if (ref.startsWith('upload:')) return resolveApiUrl(`/api/files/${ref.slice(7)}`);
  return '';
};
