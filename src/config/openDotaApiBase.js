export const DEFAULT_OPENDOTA_API_BASE = 'https://api.opendota.com/api';

const OFFICIAL_OPENDOTA_ORIGIN = 'https://api.opendota.com';

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');

export const normalizeOpenDotaApiBase = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return DEFAULT_OPENDOTA_API_BASE;
  }

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    if (raw.includes('\\')) {
      throw new Error('VITE_OPENDOTA_API_BASE must not contain backslashes.');
    }
    const url = new URL(raw, 'https://dotalens.invalid');
    if (url.search || url.hash) {
      throw new Error('VITE_OPENDOTA_API_BASE must not include a query string or fragment.');
    }
    const pathname = trimTrailingSlashes(url.pathname);
    if (!pathname) {
      throw new Error('VITE_OPENDOTA_API_BASE must point to a non-root proxy path.');
    }
    return pathname;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      'VITE_OPENDOTA_API_BASE must be an absolute same-origin path or the official OpenDota HTTPS origin.'
    );
  }

  if (
    url.protocol !== 'https:' ||
    url.origin !== OFFICIAL_OPENDOTA_ORIGIN ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'VITE_OPENDOTA_API_BASE is blocked by the production CSP; use a same-origin path or https://api.opendota.com.'
    );
  }

  return `${url.origin}${trimTrailingSlashes(url.pathname)}`;
};
