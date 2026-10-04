import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkSecurityHeaders } from '../scripts/checkDeployment.mjs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const security = config.headers.find((rule) => rule.source === '/(.*)').headers;
const headers = new Headers(security.map(({ key, value }) => [key, value]));

describe('production header configuration', () => {
  it('enforces the same security policy on Vercel and _headers hosts', () => {
    const portable = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split('\n\n')[0].split('\n').slice(1).map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    });
    expect(Object.fromEntries(headers)).toEqual(Object.fromEntries(new Headers(portable)));
    expect(checkSecurityHeaders(headers)).toEqual([]);
  });
  it('fails for absent headers and unsafe script execution allowances', () => {
    expect(checkSecurityHeaders(new Headers()).length).toBeGreaterThan(5);
    const unsafe = new Headers(headers);
    unsafe.set('content-security-policy', headers.get('content-security-policy').replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
    expect(checkSecurityHeaders(unsafe)).toContain('Unsafe or missing CSP script-src');
  });
});
