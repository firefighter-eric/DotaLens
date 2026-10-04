import { pathToFileURL } from 'node:url';

export function checkSecurityHeaders(headers) {
  const failures = [];
  const csp = headers.get('content-security-policy') || '';
  const directives = new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
  for (const name of ['default-src', 'script-src', 'base-uri']) {
    const sources = directives.get(name) ?? [];
    if (!sources.includes("'self'") || sources.some((value) => ["'unsafe-eval'", "'unsafe-inline'", '*', 'http:', 'https:', 'data:'].includes(value))) failures.push(`Unsafe or missing CSP ${name}`);
  }
  for (const name of ['object-src', 'frame-ancestors']) {
    if (directives.get(name)?.join(' ') !== "'none'") failures.push(`CSP ${name} must be 'none'`);
  }
  if (!directives.has('upgrade-insecure-requests')) failures.push('Missing CSP upgrade-insecure-requests');
  if (!/^nosniff$/i.test(headers.get('x-content-type-options') ?? '')) failures.push('Missing X-Content-Type-Options: nosniff');
  if (!/^DENY$/i.test(headers.get('x-frame-options') ?? '')) failures.push('Missing X-Frame-Options: DENY');
  const maxAge = Number(/max-age=(\d+)/i.exec(headers.get('strict-transport-security') ?? '')?.[1]);
  if (!(maxAge >= 31536000)) failures.push('HSTS max-age must be at least one year');
  if (!['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'].includes(headers.get('referrer-policy'))) failures.push('Missing restrictive Referrer-Policy');
  for (const feature of ['camera', 'microphone', 'geolocation']) {
    if (!(headers.get('permissions-policy') ?? '').includes(`${feature}=()`)) failures.push(`Permissions-Policy must disable ${feature}`);
  }
  return failures;
}

async function main() {
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Pass the canonical public HTTPS URL without credentials.');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Deployment returned HTTP ${response.status}`);
  const failures = checkSecurityHeaders(response.headers);
  await response.body?.cancel();
  console.log(JSON.stringify({ url: url.href, status: failures.length ? 'failed' : 'passed', failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
