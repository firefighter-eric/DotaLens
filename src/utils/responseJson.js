export const MAX_API_RESPONSE_BYTES = 8 * 1024 * 1024;

export async function readBoundedJson(response, maxBytes = MAX_API_RESPONSE_BYTES) {
  const declaredLength = Number(response.headers?.get('content-length'));
  if (declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new RangeError('Response exceeds the byte limit');
  }
  // Legacy/test adapters may expose only json(); browser Response has a stream.
  if (!response.body?.getReader) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RangeError('Response exceeds the byte limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
