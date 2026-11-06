# Build and verification report

**Build date:** 2026-11-06  
**Source:** the supplied `index.html` (preserved at `original-source/index.original.html`)

## Implemented in this package

- Bilingual Arabic RTL / English LTR public site with the original personal identity and verified biographical information retained.
- A Three.js `WebGLRenderer` hero scene with perspective camera, lights, animated scene elements, touch/pointer response, six visual modes and reduced-motion / low-power behavior.
- A locally bundled generated glTF 2.0 binary centerpiece (`assets/models/khaled-digital-core.glb`) and a 1024×1024 generated texture (`assets/textures/core-surface.png`).
- A separate responsive `/owner/` console with Supabase Auth login, server/database role checks, content CRUD, media library/search interfaces, messages, invitations, settings, activity and supported revision rollback.
- Supabase schema/RLS migration and server-side Edge Function source for contact messages, invitation, media provider search and optional AI assistance.
- `.env.example`, a public-only `config.js` template, documentation, deployment headers/redirects, favicon, social preview and a static deployment build.

## Checks executed

| Check | Result |
|---|---|
| JavaScript syntax (`node --check`) for public app, owner app, Supabase helper and 3D scene | Passed |
| `npm run check` required source files | Passed |
| GLB binary signature and PNG texture signature | Passed |
| Source smoke tests for bilingual shell, Three.js renderer, owner authentication hooks, RLS/owner constraint and secret separation | Passed |
| `npm run build` static `dist/` output and required file checks | Passed |
| Local HTTP requests for `/`, `/owner/`, 3D module, GLB model, `config.js` and `robots.txt` | HTTP 200 |
| GLB parsed as glTF 2.0 scene with one mesh, 2,562 vertices and 5,120 faces | Passed |

## Not tested / requires external setup

- A real browser session with WebGL2 and CDN access. The browser runtime available in the build environment could not complete navigation, so no screenshot or real visual browser sign-off is claimed.
- Supabase project authentication, RLS integration behavior, Edge Function deployment, real persistence, owner bootstrap and multi-role attack tests. No Supabase project credentials were supplied.
- Live contact email, media-provider APIs, or AI calls. Their server-side keys and sender/domain configuration are not supplied.
- Real Android device performance, Lighthouse/Core Web Vitals, upload malware scanning and production deployment.

Run `npm run verify` before changes are published. Follow `README.md`, `docs/SECURITY.md` and `docs/TESTING.md` for setup and the remaining production acceptance tests.


## Continuation update — 2026-11-06

Additional hardening and completion work:

- Added `/account/` self-service signup/login/profile editor. User profile writes are scoped to the authenticated row; the account screen never exposes role mutation.
- Added a one-time verified-email primary-owner bootstrap script; it uses an advisory transaction lock and refuses to replace an existing owner. Removed the old inline SQL snippet from the migration.
- Disabled direct browser mutations on `user_roles`; role changes now go through the owner RPC or owner-verified invite function.
- Enforced exact `SITE_ORIGIN` validation and shared CORS handling on all Edge Functions; requests from missing/mismatched origins are rejected.
- Fixed missing Supabase client import in the media search Edge Function.
- Enforced project/content publication-status consistency in PostgreSQL.
- Completed message archive/unarchive UI and additional revision coverage.
- Restricted editors to their own unpublished draft/review work and own media; global content remains administrator/owner-controlled.
- Added GitHub Actions CI workflow to run `npm run verify` on pushes and pull requests.
- Added a separate account route to the public deployment build.

These additions remain source-verified but not remotely activated: no user Supabase project/keys were provided. No repository was available in the connected GitHub account at the time of this run, so no remote push or deployment was performed.

## Final continuation verification — 2026-11-06

| Check | Result |
|---|---|
| `npm run verify` after the latest changes | Passed: required files, smoke tests and static deployment build |
| `node --check` across all project JavaScript files | Passed |
| Local HTTP smoke test for `/`, `/owner/`, `/account/`, Three.js module, GLB, texture, browser config and robots.txt | All returned HTTP 200 |
| Public deployment output includes `/account/` and its CSS/JS | Passed |
| Public deployment output excludes `original-source/` and `supabase/` private implementation files | Passed |
| Extra source-level checks for revision restore coverage, Wikimedia Commons / Poly Haven discovery, strict Edge Function CORS and secret separation | Passed |

### Outstanding external acceptance tests

- Supabase migration has not been applied to a real project; SQL, triggers, RLS policies and bootstrap were reviewed statically but not executed against PostgreSQL.
- Edge Functions have not been deployed or run under Deno; their TypeScript was source-reviewed, but Deno type-checking/integration tests are still required.
- Chromium headless did not complete in this environment even with software-rendering flags, so there is no verified browser screenshot, real WebGL scene capture, Android device check or visual sign-off.
- No GitHub repository was present in the connected account, and a repository-creation action was unavailable. The package was not pushed to GitHub.
- No live hosting deployment was performed.
- Supabase URL/anon key, verified owner account, actual production domain, email provider, media API credentials and AI provider credentials remain to be supplied by the owner.

The ZIP is a source/build handoff, not a claim that cloud services are already activated. Complete the external setup and execute the production checks in `docs/TESTING.md` before treating the website as production-ready.
