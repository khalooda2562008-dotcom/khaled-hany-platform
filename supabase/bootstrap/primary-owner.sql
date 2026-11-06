-- One-time primary owner bootstrap.
-- 1) Create and email-verify your own account in Supabase Auth first.
-- 2) Replace the address below with the exact address of that account.
-- 3) Run this file once in the Supabase SQL Editor as the project database owner.
-- This script never creates a password or a second owner. It intentionally fails
-- when the address is unchanged, the user is missing/ambiguous, or an owner exists.

do $$
declare
  owner_email text := 'REPLACE_WITH_YOUR_VERIFIED_EMAIL';
  matching_users integer;
  owner_user_id uuid;
  existing_owners integer;
begin
  perform pg_advisory_xact_lock(hashtext('khaled-hany-primary-owner-bootstrap'));

  if owner_email = 'REPLACE_WITH_YOUR_VERIFIED_EMAIL'
     or owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Set owner_email to the exact verified email address before running this script.';
  end if;

  select count(*) into matching_users
  from auth.users
  where lower(email) = lower(owner_email) and email_confirmed_at is not null;

  if matching_users <> 1 then
    raise exception 'Expected exactly one email-verified Auth user for %, found %.', owner_email, matching_users;
  end if;

  select id into owner_user_id
  from auth.users
  where lower(email) = lower(owner_email) and email_confirmed_at is not null;

  select count(*) into existing_owners
  from public.user_roles
  where role = 'owner';

  if existing_owners <> 0 then
    raise exception 'A primary owner already exists. This bootstrap is one-time and will not replace it.';
  end if;

  update public.user_roles
  set role = 'owner', granted_by = owner_user_id, updated_at = now()
  where user_id = owner_user_id;

  if not found then
    insert into public.user_roles(user_id, role, granted_by)
    values(owner_user_id, 'owner', owner_user_id);
  end if;

end $$;

-- Verify exactly one primary owner after execution:
select user_id, role, created_at
from public.user_roles
where role = 'owner';
