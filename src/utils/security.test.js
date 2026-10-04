import { describe, expect, it, vi } from 'vitest';
import { normalizeAvatarUrl } from './avatarUrl.js';
import { createErrorReport } from './errorTelemetry.js';
import { readBoundedJson } from './responseJson.js';

describe('external data boundaries', () => {
  it('accepts only credential-free HTTPS Steam image hosts', () => {
    expect(normalizeAvatarUrl(' https://avatars.steamstatic.com/a.jpg ')).toBe('https://avatars.steamstatic.com/a.jpg');
    expect(normalizeAvatarUrl('https://steamcdn-a.akamaihd.net/a.jpg')).toContain('/a.jpg');
    for (const url of [null, 'data:image/svg+xml,abc', 'javascript:alert(1)', 'http://avatars.steamstatic.com/a', 'https://steamstatic.com.evil.example/a', 'https://steamstatic.com@evil.example/a', 'https://user:secret@avatars.steamstatic.com/a', 'https://avatars.steamstatic.com:8443/a', 'https://example.com/a', 'x'.repeat(2049)]) {
      expect(normalizeAvatarUrl(url)).toBe('');
    }
  });

  it('does not expose error messages, stack traces or custom properties to telemetry', () => {
    const error = Object.assign(new TypeError('Player 42 token=private'), { accountId: 42, url: 'https://private.example' });
    expect(createErrorReport(error, 'v1.2.3')).toEqual({ event: 'render_failure', errorType: 'TypeError', release: 'v1.2.3' });
    expect(createErrorReport({ name: 'Player 42 private' }, '<>')).toEqual({ event: 'render_failure', errorType: 'Error', release: 'development' });
    expect(createErrorReport(error, 'x'.repeat(100)).release).toHaveLength(80);
  });

  it('decodes a JSON response even when UTF-8 characters cross stream chunks', async () => {
    const bytes = new TextEncoder().encode('{"name":"玩家"}');
    const body = new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } });
    await expect(readBoundedJson(new Response(body), 100)).resolves.toEqual({ name: '玩家' });
  });

  it('cancels responses larger than either the declared or actual byte limit', async () => {
    const declaredCancel = vi.fn();
    const declared = new Response(new ReadableStream({ cancel: declaredCancel }), { headers: { 'content-length': '1000' } });
    await expect(readBoundedJson(declared, 10)).rejects.toThrow(RangeError);
    expect(declaredCancel).toHaveBeenCalledOnce();
    const streamedCancel = vi.fn();
    const streamed = new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel: streamedCancel,
    }));
    await expect(readBoundedJson(streamed, 10)).rejects.toThrow(RangeError);
    expect(streamedCancel).toHaveBeenCalledOnce();
    await expect(readBoundedJson(new Response('invalid JSON'))).rejects.toThrow(SyntaxError);
  });
});
