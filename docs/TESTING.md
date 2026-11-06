# Verification checklist

## Automated checks included

Run `npm run verify` from the project root. The source checks validate:

- required project files exist;
- the public page declares Arabic RTL as the default;
- all primary public section IDs exist;
- the 3D module contains a Three.js `WebGLRenderer`, perspective camera and render loop;
- the animation loop starts only after scheduling correctly;
- the public contact form contains a honeypot field;
- the owner route contains a login form and calls Supabase `signInWithPassword`;
- the owner module reads the role from `user_roles`;
- the account page signs up/logs in through Supabase Auth and updates only the current user profile;
- the one-time owner bootstrap requires a verified email and refuses to replace an existing owner;
- Edge Functions validate the exact `SITE_ORIGIN`, and no wildcard CORS fallback is present;
- editor policies limit writes to their own unpublished draft/review work and own media;
- project/content publication flags must match their publication status;
- inbox supports read/unread and archive/unarchive;
- the SQL migration enables RLS, enforces the single-owner invariant, and declares the protected owner role RPC and Storage bucket;
- no service-role or provider API secrets appear in `config.js`;
- contact, invite and AI UI code invoke their Edge Functions.

## Required external integration tests (not executable without your credentials)

- Auth login/session refresh/logout with a real Supabase Auth user.
- Bootstrap exactly one owner using `supabase/bootstrap/primary-owner.sql`, then test all five role classes.
- Attempt direct REST API calls that bypass the owner UI and verify RLS denies them.
- Verify invitation email delivery and that a newly invited role is correct.
- Send a contact message; confirm database insertion, per-IP rate limit and email notification result.
- Upload allowed image/GLB files; reject oversize and disallowed content; verify Storage ownership and delete behavior.
- Run provider searches using configured API keys; open each asset source and review the exact license.
- Update content, reload in a fresh session and verify persistence.
- Modify a section/project/goal twice; restore a prior revision and verify a new revision is recorded.
- Verify keyboard-only navigation, NVDA/TalkBack labels, Arabic/English layouts and no horizontal overflow on Android.

## Browser and performance tests before launch

- Test current Chrome Android, Chrome desktop, Firefox and Safari/iOS.
- Confirm WebGL2 and model loading from the deployed CDN; verify fallback on WebGL-disabled devices.
- Use Lighthouse/WebPageTest on the deployed domain and record LCP, INP and CLS. Do not report target scores as achieved until measured.
- Profile GPU frame rate, battery/thermal impact and scroll behavior on a mid-range Android device.
- Review network requests and CSP, and confirm no secret credentials appear in the browser bundle or logs.

## Additional checks completed in source

- JavaScript syntax checks cover the public app, Three.js scene, owner console and registered-user account page.
- Source smoke tests check the owner bootstrap script, strict Origin validation imports, editor draft-only policy, archive controls and CI workflow presence.
- The local Chromium attempt could not initialize its EGL/GPU context in this environment. No screenshot or real browser/WebGL acceptance result is claimed.
