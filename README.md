# KHALED HANY — Next-Generation Digital Identity

A bilingual Arabic/English personal website built from the supplied original `index.html`, enhanced with a portrait hero image, and paired with an optional Supabase CMS/owner console.

## What is included

- Preserved personal identity and original useful content: Al-Azhar AI student, interests in programming/software engineering/content creation, education, current learning goals and journey.
- Arabic RTL and English LTR, responsive navigation, dark/light themes, reduced-motion support and keyboard-visible focus.
- Portrait hero image (`assets/images/me.jpg` or the `site_brand.hero_image_url` setting) with a styled “KH” fallback, plus theme, language and reduced-motion controls.
- Optional authenticated `/owner/` control center with role verification, bilingual content editing, projects, skills, education, journey milestones, goals, content/media items, uploads, contact inbox with archive/read/delete, role invitations, settings, activity history and revision rollback.
- `/account/` self-service user account for signup/login and editing only the signed-in user’s profile; ordinary visitors cannot grant themselves roles.
- Supabase SQL migration with tables, triggers, Row Level Security (RLS), single-primary-owner constraint, a protected owner role RPC, storage bucket policies and contact rate limiting.
- Edge Functions for contact submission, provider-backed asset discovery, owner invitations and optional AI-assisted editing.
- SEO basics, social preview SVG, favicon, PWA manifest, robots.txt, sitemap placeholder, static hosting headers and redirects.

## Honest implementation boundaries

This ZIP is a complete source package, not a deployed production service. No Supabase project, account, domain, API keys, email sender, or external provider credentials were supplied, so those services cannot be live from inside this archive. The `config.js` values are intentionally blank. No owner password is generated or embedded.

The hero portrait is a normal image: put `me.jpg` (or `.jpeg`, `.png`, `.webp`) in `assets/images/`, or upload one from the owner console, and it appears automatically. If no image is found the page shows a styled “KH” placeholder instead of a broken frame. A configured Supabase instance is still required before production acceptance.

Provider search works through documented APIs only: Wikimedia Commons is searched directly by the owner UI; Unsplash, Pexels and Pixabay are optional server-side integrations and return a missing-credential message until their secrets are configured. Imported source references retain the provider, source URL, creator and license label. A reference being saved is not a substitute for reviewing the asset's exact license and attribution obligations. The UI does not silently download arbitrary third-party media or assert that every API result is cleared for every use.

No professional history, project outcomes, certificates, follower counts, social links, email address, or other unverified personal facts were invented. The initial projects list is empty on purpose. The original site remains in `original-source/index.original.html` for comparison; do not deploy that audit copy.

## 1. Local preview

Requirements: Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:4173`.

The owner console is available at `http://localhost:4173/owner/`, and the registered-user account page is at `http://localhost:4173/account/`. Without a configured Supabase project, it intentionally displays the setup/login state and does not accept a fake local admin password.

## 2. Supabase setup

1. Create a Supabase project.
2. Copy `config.js.example` to `config.js` and set only:
   - `supabaseUrl`: your project URL.
   - `supabaseAnonKey`: the publishable/anon key intended for browser use.
3. Never put the service-role key, Resend key, AI key, or media-provider keys in `config.js`.
4. Apply `supabase/migrations/202611060001_initial_schema.sql` using the Supabase SQL Editor or Supabase CLI.
5. In Supabase Auth, create the owner's account yourself. Use the exact email you control; enable email confirmation and MFA where available.
6. Run `supabase/bootstrap/primary-owner.sql` once after replacing its placeholder with the verified owner email. Do not expose passwords or service-role keys.
7. Configure Auth redirect URLs to include your deployed domain and the local preview URL while testing.
8. Confirm RLS is enabled and run the access checks in `docs/SECURITY.md` before inviting editors or administrators.

### First owner bootstrap

The SQL migration does not create a default owner, password, or reusable credential. After applying the migration, create and email-verify the account in Supabase Auth, then open `supabase/bootstrap/primary-owner.sql`, replace `REPLACE_WITH_YOUR_VERIFIED_EMAIL` with that exact email, and run it once from the Supabase SQL Editor. It checks that the Auth user is verified, refuses to replace an existing owner, and assigns the single owner role. The database audit trigger records the role change. It never creates a password. Verify the result with the SELECT statement included at the end of that file.

The ordinary role RPC cannot grant a second owner. Direct browser writes to `user_roles` are disabled; role changes go through the owner RPC and the owner-verified invite Edge Function.

## 3. Supabase Edge Functions

Install the Supabase CLI and authenticate it, then link the project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy contact --no-verify-jwt
supabase functions deploy asset-search
supabase functions deploy invite-user
supabase functions deploy ai-assist
```

Use `supabase/config.toml` for function JWT settings. Set server-side secrets (never commit them):

```bash
supabase secrets set SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="YOUR_PUBLIC_ANON_KEY"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_SECRET"
supabase secrets set SITE_ORIGIN="https://YOUR-DOMAIN.example"
supabase secrets set RATE_LIMIT_SALT="A_LONG_RANDOM_SECRET"
```

Optional email notifications (verified sending domain required):

```bash
supabase secrets set RESEND_API_KEY="..." OWNER_NOTIFICATION_EMAIL="you@example.com" RESEND_FROM_EMAIL="Website <noreply@YOUR-DOMAIN.example>"
```

Optional visual asset APIs:

```bash
supabase secrets set UNSPLASH_ACCESS_KEY="..." PEXELS_API_KEY="..." PIXABAY_API_KEY="..."
```

Optional OpenAI-compatible AI provider:

```bash
supabase secrets set AI_API_URL="https://api.openai.com/v1/chat/completions" AI_API_KEY="..." AI_MODEL="YOUR_AVAILABLE_MODEL"
```

Only set credentials for providers you have actually enabled and reviewed. The functions return explicit missing-configuration errors when secrets are absent.

## 4. Build and deploy the public website

Build a clean static deployment directory:

```bash
npm run build
```

The command writes the public site to `dist/`. It deliberately excludes the original audit copy, SQL migrations, Edge Function source, documentation and development tools. Deploy the contents of `dist/` to Cloudflare Pages, Netlify, GitHub Pages or another static host. The included `_headers` and `_redirects` files are recognized by compatible hosts; other hosts may need equivalent configuration. The backend in `supabase/` is deployed separately using the Supabase CLI instructions above.

Before launch, replace `YOUR-DOMAIN.example` in `robots.txt` and `sitemap.xml` with the real canonical domain. Add the exact domain to the `SITE_ORIGIN` secret and Supabase Auth redirect allow-list. Add a real custom domain and HTTPS.

## 5. Owner console guide

- **Content sections:** edit Arabic and English section titles, descriptions, long-form text, visibility and order.
- **Structured content:** manage skills/interests, education, journey milestones and goals.
- **Projects:** add only completed/real projects, set live and GitHub URLs, and explicitly publish them.
- **Content/media:** manage videos, articles, resources and social links. Public items are opened at their source URL.
- **Media library:** upload files to the public `site-media` bucket or save a sourced asset reference with its creator/license metadata. Uploads are limited to 50 MB; SVG script/event-handler content is rejected by the client UI, but production uploads should also be scanned server-side.
- **Messages:** search, mark read/unread, archive/unarchive and delete contact messages directly from the owner inbox.
- **Users:** invite users by email and assign `registered_user`, `editor` or `administrator`; owner role cannot be granted through the ordinary UI.
- **Settings:** store public website JSON settings such as `site_brand`, `appearance`, `seo` and `social_links`. Keep API secrets exclusively in Edge Function secrets, never in this table.
- **Revision history:** previous versions are captured for sections, projects, content items, skills, education entries, journey milestones and personal goals. Administrators/owner can inspect and restore supported versions; each restore itself creates a new revision.

## 6. Testing

```bash
npm run verify
```

This runs required-file checks, JavaScript syntax/source smoke tests and creates a checked static `dist/` build. It does not replace:
- a browser test on real Android hardware and a desktop browser,
- a Supabase auth/RLS integration test with the project configured,
- live Edge Function tests with provider secrets,
- a production Lighthouse / Core Web Vitals run,
- a full upload malware/content scan.

A test report and checklist are in `docs/TESTING.md`.

## 7. Backups and recovery

Use the backup/export features available in your Supabase plan for database recovery. For manual schema/data export, use the Supabase CLI with your own authenticated project connection; keep dumps encrypted and outside GitHub. Back up Storage objects separately: database metadata alone does not contain the underlying files. Test a restore into a separate staging project before relying on any backup plan.

## Project structure

```text
.
├── index.html
├── owner/index.html
├── account/                   # self-service signup, login and profile management
├── config.js                 # blank public config template; edit locally
├── config.js.example
├── assets/
│   ├── css/                  # public site and owner console styles
│   ├── js/                   # public app, Supabase and owner app
│   ├── images/               # hero photo (me.jpg) and social preview artwork
│   └── icons/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── config.toml
├── docs/
├── tools/
│   ├── build.mjs
├── original-source/          # audit-only original HTML, not deployed
├── .env.example
├── .gitignore
└── package.json
```

## License and source notes

- Site code and project-generated SVG artwork: project-specific original assets, authored for this delivery.
- Supabase JS is loaded locally from `assets/vendor/`; its license remains with the upstream project.
- Wikimedia Commons licensing varies per file. Review each individual file page and attribution requirements.
- Unsplash, Pexels and Pixabay are optional providers. Their own terms and API requirements apply; the returned `license` field is a reminder to verify, not an independent legal clearance.
- No binary font files from the system were copied into the archive. Typography uses a system font stack; see `fonts/README.md` before adding licensed local fonts.
