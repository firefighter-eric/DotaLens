import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENDOTA_API_BASE,
  normalizeOpenDotaApiBase,
} from './openDotaApiBase.js';

describe('OpenDota API base configuration', () => {
  it('accepts the CSP-authorized official API and same-origin proxy paths', () => {
    expect(normalizeOpenDotaApiBase()).toBe(DEFAULT_OPENDOTA_API_BASE);
    expect(normalizeOpenDotaApiBase('https://api.opendota.com/api/')).toBe(
      DEFAULT_OPENDOTA_API_BASE
    );
    expect(normalizeOpenDotaApiBase('/api/opendota/')).toBe('/api/opendota');
  });

  it('rejects origins and URL forms that the production CSP cannot authorize', () => {
    expect(() =>
      normalizeOpenDotaApiBase('https://proxy.example/api')
    ).toThrow(/production CSP/);
    expect(() => normalizeOpenDotaApiBase('//proxy.example/api')).toThrow();
    expect(() => normalizeOpenDotaApiBase('/api/opendota?token=secret')).toThrow(
      /query string/
    );
  });
});
