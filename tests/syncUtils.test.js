import { describe, expect, it, vi } from 'vitest';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertAllowedUrl,
  assertCatalogIntegrity,
  assertSourceEntryCount,
  commitCatalogSnapshot,
  detectImageType,
  fetchImageResource,
  fetchJsonResource,
  mapWithConcurrency,
  readResponseBytes,
} from '../scripts/syncUtils.mjs';

const ALLOWED_ORIGINS = new Set(['https://assets.example.com']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('sync URL policy', () => {
  it('accepts only credential-free HTTPS URLs on an exact allowlisted origin', () => {
    expect(
      assertAllowedUrl('https://assets.example.com/file.json', ALLOWED_ORIGINS).hostname
    ).toBe('assets.example.com');
    expect(
      assertAllowedUrl('https://assets.example.com/file.json', ['https://assets.example.com'])
        .pathname
    ).toBe('/file.json');
    expect(() =>
      assertAllowedUrl('http://assets.example.com/file.json', ALLOWED_ORIGINS)
    ).toThrow(/HTTPS/);
    expect(() =>
      assertAllowedUrl('https://user:pass@assets.example.com/file.json', ALLOWED_ORIGINS)
    ).toThrow(/credentials/);
    expect(() =>
      assertAllowedUrl('https://evil.example.com/file.json', ALLOWED_ORIGINS)
    ).toThrow(/not allowlisted/);
  });

  it('validates every redirect target before following it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/next.json' },
        })
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          headers: { 'content-type': 'application/json' },
        })
      );

    await expect(
      fetchJsonResource('https://assets.example.com/start.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl,
      })
    ).resolves.toEqual({ ok: true });
    expect(String(fetchImpl.mock.calls[1][0])).toBe('https://assets.example.com/next.json');

    await expect(
      fetchJsonResource('https://assets.example.com/start.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(null, {
            status: 302,
            headers: { location: 'https://evil.example.com/payload.json' },
          })
        ),
      })
    ).rejects.toThrow(/not allowlisted/);
  });

  it('rejects malformed and excessive redirect chains', async () => {
    await expect(
      fetchJsonResource('https://assets.example.com/start.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
      })
    ).rejects.toThrow(/no location/);

    await expect(
      fetchJsonResource('https://assets.example.com/start.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        maxRedirects: 0,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(null, {
            status: 302,
            headers: { location: '/again.json' },
          })
        ),
      })
    ).rejects.toThrow(/too many redirects/);
  });
});

describe('sync response validation', () => {
  it('parses bounded JSON with an explicit JSON MIME type', async () => {
    await expect(
      fetchJsonResource('https://assets.example.com/data.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response('{"items":[1,2]}', {
            headers: { 'content-type': 'application/vnd.api+json' },
          })
        ),
      })
    ).resolves.toEqual({ items: [1, 2] });
  });

  it('rejects HTTP errors, bad MIME, invalid JSON, and oversized responses', async () => {
    const request = (response, options = {}) =>
      fetchJsonResource('https://assets.example.com/data.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(response),
        ...options,
      });

    await expect(request(new Response(null, { status: 503 }))).rejects.toThrow(/HTTP 503/);
    await expect(
      request(new Response('{}', { headers: { 'content-type': 'text/html' } }))
    ).rejects.toThrow(/MIME/);
    await expect(request(new Response(null))).rejects.toThrow(/MIME type: missing/);
    await expect(
      request(new Response('{', { headers: { 'content-type': 'application/json' } }))
    ).rejects.toThrow(/invalid JSON/);
    await expect(
      request(
        new Response('123456', {
          headers: { 'content-type': 'application/json', 'content-length': '6' },
        }),
        { maxBytes: 5 }
      )
    ).rejects.toThrow(/size limit/);
  });

  it('enforces the streamed size even when content-length is missing', async () => {
    await expect(
      readResponseBytes(new Response('123456'), 5, 'test stream')
    ).rejects.toThrow(/size limit/);
    await expect(
      readResponseBytes({ headers: new Headers(), body: null }, 5, 'empty stream')
    ).resolves.toEqual(Buffer.alloc(0));
  });

  it('aborts a request at the configured deadline', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });

    await expect(
      fetchJsonResource('https://assets.example.com/slow.json', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl,
        timeoutMs: 5,
      })
    ).rejects.toThrow(/Timed out/);
  });
});

describe('sync image validation', () => {
  it('detects supported image signatures', () => {
    expect(detectImageType(PNG_SIGNATURE)).toMatchObject({ extension: '.png' });
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toMatchObject({
      extension: '.jpg',
    });
    expect(detectImageType(Buffer.from('GIF87a'))).toMatchObject({ extension: '.gif' });
    expect(detectImageType(Buffer.from('GIF89a'))).toMatchObject({ extension: '.gif' });
    expect(detectImageType(Buffer.from('RIFF0000WEBP'))).toMatchObject({
      extension: '.webp',
    });
    expect(detectImageType(Buffer.from('not an image'))).toBeNull();
  });

  it('accepts an image only when MIME and magic bytes agree', async () => {
    await expect(
      fetchImageResource('https://assets.example.com/icon.png', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(PNG_SIGNATURE, {
            headers: { 'content-type': 'image/png' },
          })
        ),
      })
    ).resolves.toMatchObject({
      buffer: PNG_SIGNATURE,
      contentType: 'image/png',
      extension: '.png',
    });
  });

  it('rejects non-images, spoofed image MIME, and mismatched signatures', async () => {
    const request = (body, contentType) =>
      fetchImageResource('https://assets.example.com/icon.png', {
        allowedOrigins: ALLOWED_ORIGINS,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(body, {
            headers: { 'content-type': contentType },
          })
        ),
      });

    await expect(request(PNG_SIGNATURE, 'text/plain')).rejects.toThrow(/MIME/);
    await expect(request(Buffer.from('not an image'), 'image/png')).rejects.toThrow(/signature/);
    await expect(request(PNG_SIGNATURE, 'image/jpeg')).rejects.toThrow(/does not match/);
  });
});

describe('sync snapshot reliability', () => {
  it('rejects empty, duplicate, and malformed upstream catalogs before publish', () => {
    expect(() =>
      assertCatalogIntegrity([], { label: 'heroes', minEntries: 1 })
    ).toThrow(/expected at least 1/);
    expect(() =>
      assertCatalogIntegrity(
        [
          { id: 1, key: 'axe', nameEn: 'Axe' },
          { id: 2, key: 'axe', nameEn: 'Other' },
        ],
        { label: 'heroes', minEntries: 2 }
      )
    ).toThrow(/duplicate key/);
    expect(() =>
      assertCatalogIntegrity(
        [{ id: -1, key: 'axe', nameEn: 'Axe' }],
        { label: 'heroes' }
      )
    ).toThrow(/invalid or duplicate ID/);
    expect(
      assertCatalogIntegrity(
        [{ id: null, key: 'new_item', nameEn: 'New Item' }],
        { label: 'items', allowMissingIds: true }
      )
    ).toHaveLength(1);
  });

  it('rejects catalogs with missing ID or asset coverage even when entry counts pass', () => {
    const allMissingIds = Array.from({ length: 100 }, (_, index) => ({
      id: null,
      key: `item_${index}`,
      nameEn: `Item ${index}`,
      icon: `/assets/items/${index}.png`,
    }));
    expect(() =>
      assertCatalogIntegrity(allMissingIds, {
        label: 'items',
        minEntries: 100,
        allowMissingIds: true,
        minValidIds: 80,
        assetField: 'icon',
        minAssetCoverage: 0.8,
      })
    ).toThrow(/0 valid IDs/);

    const allMissingAssets = allMissingIds.map((entry, index) => ({
      ...entry,
      id: index + 1,
      icon: '',
    }));
    expect(() =>
      assertCatalogIntegrity(allMissingAssets, {
        label: 'items',
        minEntries: 100,
        allowMissingIds: true,
        minValidIds: 80,
        assetField: 'icon',
        minAssetCoverage: 0.8,
      })
    ).toThrow(/0\/100 expected entries with icon/);
  });

  it('measures item asset coverage only where upstream definitions expect an asset', () => {
    const officialShape = Array.from({ length: 595 }, (_, index) => {
      const hasDefinition = index < 501;
      return {
        id: index + 1,
        key: `item_${index}`,
        nameEn: `Item ${index}`,
        icon: hasDefinition ? `/assets/items/${index}.png` : '',
        iconSource: hasDefinition
          ? `https://cdn.steamstatic.com/items/${index}.png`
          : '',
      };
    });

    expect(
      assertCatalogIntegrity(officialShape, {
        label: 'items',
        minEntries: 300,
        allowMissingIds: true,
        minValidIds: 482,
        assetField: 'icon',
        assetExpectedField: 'iconSource',
        minExpectedAssets: 482,
        minAssetCoverage: 1,
      })
    ).toHaveLength(595);
  });

  it('rejects excessive snapshot regression and incomplete upstream definitions', () => {
    const previous = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      key: `hero_${index}`,
      nameEn: `Hero ${index}`,
      avatar: `/assets/heroes/${index}.png`,
    }));
    expect(() =>
      assertCatalogIntegrity(previous.slice(0, 80), {
        label: 'heroes',
        previousCatalog: previous,
        maxEntryDropRatio: 0.1,
      })
    ).toThrow(/entry count dropped/);
    expect(() =>
      assertSourceEntryCount([], {
        label: 'localized hero names',
        minEntries: 100,
      })
    ).toThrow(/contains 0 entries/);
  });

  it('preserves input order while enforcing bounded concurrency', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('waits for all workers and summarizes concurrent failures', async () => {
    const visited = [];
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (value) => {
        visited.push(value);
        if (value === 2) {
          throw new Error('broken image');
        }
        return value;
      })
    ).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [expect.objectContaining({ message: 'broken image' })],
    });
    expect(visited.sort()).toEqual([1, 2, 3]);
  });

  it('publishes a staged asset directory and catalog as one snapshot', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dotalens-sync-'));
    const targetDir = path.join(root, 'assets');
    const stagingDir = path.join(root, 'staging');
    const catalogFile = path.join(root, 'catalog.js');

    try {
      await mkdir(targetDir);
      await mkdir(stagingDir);
      await writeFile(path.join(targetDir, 'old.txt'), 'old');
      await writeFile(path.join(stagingDir, 'new.txt'), 'new');
      await writeFile(catalogFile, 'old catalog');

      await commitCatalogSnapshot({
        stagingDir,
        targetDir,
        catalogFile,
        catalogContent: 'new catalog',
      });

      expect(await readFile(path.join(targetDir, 'new.txt'), 'utf8')).toBe('new');
      expect(await readFile(catalogFile, 'utf8')).toBe('new catalog');
      expect((await readdir(root)).sort()).toEqual(['assets', 'catalog.js']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
