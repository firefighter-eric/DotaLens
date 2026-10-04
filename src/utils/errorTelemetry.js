const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'ChunkLoadError']);

// Arbitrary error messages, stacks, URLs and custom properties can contain user data.
// Send only a fixed classification and the operator-supplied release identifier.
export const createErrorReport = (error, release = 'development') => ({
  event: 'render_failure',
  errorType: ERROR_NAMES.has(error?.name) ? error.name : 'Error',
  release: String(release).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'development',
});
