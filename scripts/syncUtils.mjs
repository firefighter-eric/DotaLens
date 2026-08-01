import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export const OPEN_DOTA_API_ORIGINS = new Set(['https://api.opendota.com']);
export const DOTA2_DATA_ORIGINS = new Set(['https://www.dota2.com']);
export const STEAM_CDN_ORIGINS = new Set(['https://cdn.steamstatic.com']);

const normalizeContentType = (value) =>
  String(value ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

export const assertAllowedUrl = (value, allowedOrigins, label = 'resource') => {
  const url = value instanceof URL ? new URL(value) : new URL(String(value));
  const origins = allowedOrigins instanceof Set ? allowedOrigins : new Set(allowedOrigins);

  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} URL must not contain credentials`);
  }
  if (!origins.has(url.origin)) {
    throw new Error(`${label} host is not allowlisted: ${url.origin}`);
  }

  return url;
};

const fetchFollowingRedirects = async (
  value,
  { allowedOrigins, signal, maxRedirects, fetchImpl, label, accept }
) => {
  let currentUrl = assertAllowedUrl(value, allowedOrigins, label);

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetchImpl(currentUrl, {
      redirect: 'manual',
      signal,
      headers: {
        Accept: accept,
        'User-Agent': 'DotaLens catalog sync',
      },
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Failed to fetch ${label}, HTTP ${response.status}`);
      }
      return response;
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) {
      throw new Error(`Failed to fetch ${label}: redirect has no location`);
    }
    if (redirects === maxRedirects) {
      throw new Error(`Failed to fetch ${label}: too many redirects`);
    }

    currentUrl = assertAllowedUrl(new URL(location, currentUrl), allowedOrigins, `${label} redirect`);
  }
};

const withTimeout = async (operation, timeoutMs, label) => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Timed out fetching ${label} after ${timeoutMs} ms`)),
    timeoutMs
  );

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const readResponseBytes = async (response, maxBytes, label = 'resource') => {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error(`${label} exceeds the ${maxBytes}-byte size limit`);
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`${label} exceeds the ${maxBytes}-byte size limit`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
};

export const fetchJsonResource = async (
  value,
  {
    allowedOrigins,
    timeoutMs = 15_000,
    maxBytes = 10 * 1024 * 1024,
    maxRedirects = 3,
    fetchImpl = globalThis.fetch,
    label = 'JSON resource',
  }
) =>
  withTimeout(async (signal) => {
    const response = await fetchFollowingRedirects(value, {
      allowedOrigins,
      signal,
      maxRedirects,
      fetchImpl,
      label,
      accept: 'application/json',
    });
    const contentType = normalizeContentType(response.headers.get('content-type'));
    if (contentType !== 'application/json' && !contentType.endsWith('+json')) {
      await response.body?.cancel();
      throw new Error(`${label} returned an unexpected MIME type: ${contentType || 'missing'}`);
    }

    const buffer = await readResponseBytes(response, maxBytes, label);
    try {
      return JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new Error(`${label} returned invalid JSON`);
    }
  }, timeoutMs, label);

export const detectImageType = (buffer) => {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: '.jpg' };
  }
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return { contentType: 'image/gif', extension: '.gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: '.webp' };
  }
  return null;
};

const IMAGE_MIME_ALIASES = new Map([
  ['image/jpg', 'image/jpeg'],
  ['image/x-png', 'image/png'],
]);

export const fetchImageResource = async (
  value,
  {
    allowedOrigins,
    timeoutMs = 15_000,
    maxBytes = 5 * 1024 * 1024,
    maxRedirects = 3,
    fetchImpl = globalThis.fetch,
    label = 'image resource',
  }
) =>
  withTimeout(async (signal) => {
    const response = await fetchFollowingRedirects(value, {
      allowedOrigins,
      signal,
      maxRedirects,
      fetchImpl,
      label,
      accept: 'image/png,image/jpeg,image/webp,image/gif',
    });
    const headerType = normalizeContentType(response.headers.get('content-type'));
    const normalizedHeaderType = IMAGE_MIME_ALIASES.get(headerType) ?? headerType;
    if (!normalizedHeaderType.startsWith('image/')) {
      await response.body?.cancel();
      throw new Error(`${label} returned an unexpected MIME type: ${headerType || 'missing'}`);
    }

    const buffer = await readResponseBytes(response, maxBytes, label);
    const detectedType = detectImageType(buffer);
    if (!detectedType) {
      throw new Error(`${label} does not contain a supported image signature`);
    }
    if (normalizedHeaderType !== detectedType.contentType) {
      throw new Error(
        `${label} MIME type ${headerType} does not match detected ${detectedType.contentType}`
      );
    }

    return {
      buffer,
      contentType: detectedType.contentType,
      extension: detectedType.extension,
      finalUrl: response.url || String(value),
    };
  }, timeoutMs, label);

export const mapWithConcurrency = async (values, concurrency, mapper) => {
  const items = Array.from(values ?? []);
  const workerCount = Math.max(
    1,
    Math.min(items.length || 1, Math.trunc(Number(concurrency)) || 1)
  );
  const results = new Array(items.length);
  const failures = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        failures.push({ index, error });
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failures.length > 0) {
    failures.sort((left, right) => left.index - right.index);
    throw new AggregateError(
      failures.map((failure) => failure.error),
      `${failures.length} sync operation(s) failed`
    );
  }

  return results;
};

export const assertCatalogIntegrity = (
  catalog,
  {
    label = 'catalog',
    minEntries = 1,
    allowMissingIds = false,
    minValidIds = allowMissingIds ? 0 : minEntries,
    assetField = null,
    assetExpectedField = null,
    minExpectedAssets = 0,
    minAssetCoverage = 0,
    previousCatalog = null,
    maxEntryDropRatio = null,
    maxValidIdDropRatio = null,
    maxAssetDropRatio = null,
  } = {}
) => {
  if (!Array.isArray(catalog) || catalog.length < minEntries) {
    throw new Error(
      `${label} contains ${Array.isArray(catalog) ? catalog.length : 0} entries; expected at least ${minEntries}`
    );
  }

  const ids = new Set();
  const keys = new Set();
  catalog.forEach((entry, index) => {
    const key = typeof entry?.key === 'string' ? entry.key.trim() : '';
    if (!key || keys.has(key)) {
      throw new Error(`${label} has a missing or duplicate key at index ${index}`);
    }
    keys.add(key);

    if (entry?.id == null && allowMissingIds) {
      // Some OpenDota definitions are not present in item_ids.
    } else {
      const id = Number(entry?.id);
      if (!Number.isInteger(id) || id <= 0 || ids.has(id)) {
        throw new Error(`${label} has an invalid or duplicate ID at index ${index}`);
      }
      ids.add(id);
    }

    const name = [entry?.nameEn, entry?.nameZh].find(
      (value) => typeof value === 'string' && value.trim()
    );
    if (!name) {
      throw new Error(`${label} has no display name at index ${index}`);
    }
  });

  if (ids.size < minValidIds) {
    throw new Error(
      `${label} contains ${ids.size} valid IDs; expected at least ${minValidIds}`
    );
  }

  const hasPresentField = (entry, field) =>
    typeof entry?.[field] === 'string' && entry[field].trim();
  const getAssetEligibleEntries = (entries) =>
    assetExpectedField
      ? entries.filter((entry) => hasPresentField(entry, assetExpectedField))
      : entries;
  const countPresentAssets = (entries) =>
    assetField
      ? getAssetEligibleEntries(entries).filter((entry) =>
          hasPresentField(entry, assetField)
        ).length
      : 0;
  const expectedAssetCount = assetField
    ? getAssetEligibleEntries(catalog).length
    : 0;
  const assetCount = countPresentAssets(catalog);
  if (assetField && expectedAssetCount < minExpectedAssets) {
    throw new Error(
      `${label} contains ${expectedAssetCount} entries expected to have ${assetField}; expected at least ${minExpectedAssets}`
    );
  }
  if (
    assetField &&
    expectedAssetCount > 0 &&
    assetCount / expectedAssetCount < minAssetCoverage
  ) {
    throw new Error(
      `${label} has ${assetCount}/${expectedAssetCount} expected entries with ${assetField}; expected at least ${(minAssetCoverage * 100).toFixed(1)}% coverage`
    );
  }

  if (Array.isArray(previousCatalog) && previousCatalog.length > 0) {
    const assertNoExcessiveDrop = (current, previous, ratio, metric) => {
      if (ratio == null) {
        return;
      }
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
        throw new Error(`${label} has an invalid maximum drop ratio for ${metric}`);
      }
      const minimum = Math.ceil(previous * (1 - ratio));
      if (current < minimum) {
        throw new Error(
          `${label} ${metric} dropped from ${previous} to ${current}; minimum allowed is ${minimum}`
        );
      }
    };
    const previousValidIds = previousCatalog.filter((entry) => {
      const id = Number(entry?.id);
      return Number.isInteger(id) && id > 0;
    }).length;

    assertNoExcessiveDrop(
      catalog.length,
      previousCatalog.length,
      maxEntryDropRatio,
      'entry count'
    );
    assertNoExcessiveDrop(
      ids.size,
      previousValidIds,
      maxValidIdDropRatio,
      'valid ID count'
    );
    if (assetField) {
      assertNoExcessiveDrop(
        assetCount,
        countPresentAssets(previousCatalog),
        maxAssetDropRatio,
        `${assetField} count`
      );
    }
  }

  return catalog;
};

export const assertSourceEntryCount = (
  source,
  { label = 'upstream source', minEntries = 1 } = {}
) => {
  const count =
    source instanceof Map || source instanceof Set
      ? source.size
      : Array.isArray(source)
        ? source.length
        : source && typeof source === 'object'
          ? Object.keys(source).length
          : 0;
  if (count < minEntries) {
    throw new Error(
      `${label} contains ${count} entries; expected at least ${minEntries}`
    );
  }
  return source;
};

export const commitCatalogSnapshot = async ({
  stagingDir,
  targetDir,
  catalogFile,
  catalogContent,
}) => {
  const token = `${process.pid}-${randomUUID()}`;
  const backupDir = `${targetDir}.backup-${token}`;
  const temporaryCatalog = `${catalogFile}.tmp-${token}`;
  let previousDirectoryMoved = false;
  let stagingInstalled = false;

  await writeFile(temporaryCatalog, catalogContent);

  try {
    try {
      await rename(targetDir, backupDir);
      previousDirectoryMoved = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await rename(stagingDir, targetDir);
    stagingInstalled = true;
    await rename(temporaryCatalog, catalogFile);
  } catch (error) {
    if (stagingInstalled) {
      await rm(targetDir, { recursive: true, force: true });
    } else {
      await rm(stagingDir, { recursive: true, force: true });
    }
    if (previousDirectoryMoved) {
      await rename(backupDir, targetDir);
    }
    await rm(temporaryCatalog, { force: true });
    throw error;
  }

  if (previousDirectoryMoved) {
    await rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return {
    targetDir: path.resolve(targetDir),
    catalogFile: path.resolve(catalogFile),
  };
};
