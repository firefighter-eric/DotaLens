# Contributing to DotaLens

Thanks for helping improve DotaLens. Keep changes focused, bilingual, and easy to verify.

## Local setup

Use Node.js 24 and the npm version declared in `package.json`.

```bash
nvm use
npm ci
npm run dev
```

Do not commit local environment files, browser traces, account IDs, or tokens.

## Development rules

- Keep API access in `src/services/`; presentational components must not fetch directly.
- Put reusable calculations in `src/utils/` and add Vitest coverage.
- Update both `zh` and `en` copy for every user-visible wording change.
- Preserve request cancellation, explicit HTTP error mapping, and useful empty states.
- Test the `<=980px` and `<=640px` layouts when changing UI.
- Treat remote catalog data as untrusted. Keep the allowlist, timeout, size, MIME, and signature checks in sync scripts.

## Before opening a pull request

```bash
npm run lint
npm run test:coverage
npm run build
npm run check:budget
npm run audit:all
```

Describe the user-visible impact, test evidence, screenshots for rendered changes, and any rollback or migration concern in the pull request.
