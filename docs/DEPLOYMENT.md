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

`public/_headers` is copied into the build as a template for hosts that support the Netlify/Cloudflare Pages format. On other platforms, translate the same policies into the host configuration. Verify the effective headers after deployment; a file in `dist/` alone does not configure every server.

Recommended caching:

- `index.html`, `_headers`, and `site.webmanifest`: revalidate on every request.
- Fingerprinted `/assets/*.js` and `/assets/*.css`: `public, max-age=31536000, immutable`.
- Catalog artwork: a moderate cache such as `public, max-age=604800`.

The content security policy permits the app's current OpenDota calls and approved image origins. The UI uses a local system-font stack and does not require Google Fonts. Update the policy deliberately whenever a new remote origin is introduced.

Optional build-time variables:

- `VITE_OPENDOTA_API_BASE`: optional same-origin reverse-proxy path such as `/api/opendota`; leave unset for the official API. Arbitrary compatible origins are intentionally rejected at build time because `public/_headers` only authorizes same-origin requests and `https://api.opendota.com`.
- `VITE_APP_RELEASE`: immutable release identifier passed to the optional host error reporter.

If the host injects `window.__DOTALENS_REPORT_ERROR__`, verify that it receives only the sanitized error-boundary payload expected by the host. Do not put credentials or player-private data in that reporter.

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
