# Security policy

## Supported versions

Security fixes are applied to the current `main` branch. Older snapshots are not maintained.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/firefighter-eric/DotaLens/security/advisories/new). Do not open a public issue before a fix is available.

Include affected paths, reproduction steps, impact, and a minimal proof of concept. Do not include real Steam account IDs, access tokens, private browser traces, or other personal data. You should receive an acknowledgement within seven days.

## Data and trust boundaries

DotaLens is a client-side application. Saved accounts remain in browser storage, while queries are sent to OpenDota. Catalog sync scripts accept data only from explicitly allowlisted HTTPS origins and validate redirects, response size, MIME type, and image signatures.

Deployment operators are responsible for HTTPS, security headers, dependency updates, and any host-specific logging or analytics they add.
