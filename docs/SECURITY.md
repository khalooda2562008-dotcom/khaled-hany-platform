# Security model and deployment checklist

## Trust boundaries

- Browser code contains only the Supabase project URL and public anon/publishable key. A public anon key is not an authorization mechanism; RLS is mandatory.
- Service-role credentials and provider API keys are stored only as Supabase Edge Function secrets.
- All privileged actions use authenticated server-side checks plus database RLS. Hiding `/owner/` in the navigation is not access control.
- Owner bootstrap is a one-time database operation after the owner creates their own Auth account. No default password exists in the repository.

## Role boundaries

| Role | Intended capability | Restrictions |
|---|---|---|
| Visitor | Read published pages/projects/content; submit contact form | No private database reads or CMS access |
| Registered user | Read/update own profile; use enabled public features | Cannot write global content or change roles |
| Editor | Create/update own draft or review projects and manage own media | Cannot publish, change global profile/education/skills/journey, access inbox/history or grant roles |
| Administrator | Manage content, delete content, review messages, invite users only if owner authorizes | Cannot grant ownership, change owner role, or manage owner security configuration |
| Owner | Full website content and platform controls | Primary owner row is protected; ownership transfer is not shipped |

The initial database policy grants `owner_set_role` only to the primary owner. The `invite-user` Edge Function also checks the caller's role on the server before using the service role.

## Required production hardening

1. Set `SITE_ORIGIN` to the one exact production HTTPS origin. All four Edge Functions reject missing or mismatched Origin headers; no wildcard CORS fallback is used.
2. Enable MFA for the owner, email confirmation, strong password policy and Auth rate limits.
3. Review Supabase Auth redirect URLs; do not allow wildcard redirects.
4. Keep database and Storage RLS enabled. Test requests as anon, registered_user, editor, administrator and owner separately. All role changes must use owner RPC / server-side invite operation.
5. Add CAPTCHA/Turnstile to the contact form before exposing it to high-volume traffic. The included honeypot and atomic per-IP rate limit reduce basic abuse but are not a full bot-defense system.
6. Add server-side malware scanning/content validation for public uploads. The UI validates extensions, MIME and basic SVG script/event-handler patterns; client validation alone is not a security boundary.
7. Use a dedicated, verified sending domain for Resend; review message retention and delete/archive policy.
8. Configure backups and test a restore. Store database dumps and media backups encrypted and outside version control.
9. Review CSP and third-party CDN allowances for your final hosting setup. The static `_headers` file sets baseline headers but does not replace an explicit, tested Content-Security-Policy.
10. Run dependency/security audits when upgrading Three.js, Supabase JS, Deno functions or the host runtime.

## Database policies to test

- Anonymous `select` from `projects` returns only `published=true` rows.
- Anonymous `select` from `site_sections` returns only `is_visible=true` rows.
- An authenticated user can update only their own `profiles` row.
- A registered user cannot `insert`, `update` or `delete` rows in `projects`, `site_sections`, `media_assets`, `user_roles` or `site_settings`.
- An editor can create/update only their own unpublished projects/content items and own media. They cannot publish, delete projects, edit global sections/skills/education/journey/goals, inspect revision history, manage users or read contact messages.
- An administrator can manage/delete content and messages, but cannot write `user_roles` or change owner settings.
- Only the owner can call `owner_set_role`; administrator/owner can call `restore_content_revision`. Browser writes to `user_roles` are denied so role changes cannot bypass the audited RPC or the verified invite Edge Function.
- `owner_set_role` refuses `new_role='owner'`, self-role changes and a missing target user.
- The unique partial index prevents a second owner row. `supabase/bootstrap/primary-owner.sql` also refuses to replace an existing primary owner.
- Contact messages are created only by the Edge Function's service-role context, after server validation and rate limiting.

## Data privacy

Contact messages store the sender's submitted name, email, message, a one-way IP digest and user agent for abuse prevention. Do not collect more data than needed. Define retention periods and communicate them on the public site before production use.

## Owner bootstrap safeguards

The separate `supabase/bootstrap/primary-owner.sql` requires an existing email-verified Auth user, locks the bootstrap operation, verifies that no owner exists, and refuses to run with the placeholder email. It does not generate or reset passwords. Do not paste real credentials into GitHub or browser configuration.
