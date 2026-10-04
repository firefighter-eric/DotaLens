# Deployment and release guide

## Runtime contract

- Node.js: `24.x` LTS (see `.nvmrc`)
- npm: `11.x` (the exact development version is in `package.json`)
- Build command: `npm ci && npm run build`
- Publish directory: `dist/`

The current app assumes it is served from the site root. A subpath deployment such as `/DotaLens/` requires a coordinated Vite `base` setting and asset-path changes; do not change only one side.

## Release gate

Run the same checks as CI:

```bash
npm run lint
npm run test:coverage
npm run build
npm run check:budget
npm run audit:all
```

Deploy an immutable build artifact produced from a reviewed commit. Record the commit SHA, host configuration, and release time. Keep the previous artifact available for rollback.

## Hosting and headers

The production site is https://dota-lens-ruddy.vercel.app/. Vercel reads the root `vercel.json` header rules. `public/_headers` carries the same security policy for Netlify/Cloudflare Pages; Vercel does not apply that file. A regression test keeps both security policies aligned.

After deploying, check the actual public response (the command exits nonzero if the policy is absent):

```bash
npm run check:deployment -- https://dota-lens-ruddy.vercel.app/
```

Header configuration follows [Vercel's headers reference](https://vercel.com/docs/project-configuration/vercel-json#headers). A successful local test verifies the configuration only; the public response check verifies deployment activation.

Recommended caching:

- `index.html`, `_headers`, and `site.webmanifest`: revalidate on every request.
- Fingerprinted `/assets/*.js` and `/assets/*.css`: `public, max-age=31536000, immutable`.
- Catalog artwork: a moderate cache such as `public, max-age=604800`.

The content security policy permits the app's current OpenDota calls and approved image origins. The UI uses a local system-font stack and does not require Google Fonts. Update the policy deliberately whenever a new remote origin is introduced.

Optional build-time variables:

- `VITE_OPENDOTA_API_BASE`: optional same-origin reverse-proxy path such as `/api/opendota`; leave unset for the official API. Arbitrary compatible origins are intentionally rejected at build time because `public/_headers` only authorizes same-origin requests and `https://api.opendota.com`.
- `VITE_APP_RELEASE`: immutable release identifier passed to the optional host error reporter.

The optional `window.__DOTALENS_REPORT_ERROR__` callback receives only `{ event: 'render_failure', errorType, release }`. Error types are allowlisted; the release identifier is character-filtered and limited to 80 characters. Error messages, stacks, component stacks, player IDs, URLs, and custom error properties are not sent. Detailed error logging runs only in development.

## Smoke test

After deployment:

1. Load the root URL with the browser console open.
2. Confirm the app shell, favicon, manifest, and both languages load.
3. Query a numeric Steam32 ID and confirm cancellation/error states remain usable.
4. Exercise one recent-match detail, one catalog view, and the 30/365-day switch.
5. Check mobile layouts around 980 px and 640 px.
6. Verify HTTPS, CSP, HSTS, referrer policy, and MIME-sniffing protection.
7. Verify effective cache headers for fingerprinted bundles and the seven-day hero/item artwork policy.

## Rollback

If the smoke test fails, restore the previous immutable artifact first. Diagnose using the commit SHA and captured console/network evidence. Do not overwrite generated catalogs or dependency locks outside a reviewed change.
