// Keep the runtime and persisted-profile image policy aligned with public/_headers.
export const normalizeAvatarUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value.trim());
    const allowedHost = url.hostname.endsWith('.steamstatic.com') ||
      url.hostname === 'steamcdn-a.akamaihd.net';
    if (url.protocol !== 'https:' || !allowedHost || url.username || url.password || url.port) return '';
    return url.href;
  } catch {
    return '';
  }
};
