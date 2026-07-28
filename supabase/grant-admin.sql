-- ===========================================================================
-- Grant admin access.
--
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Requires supabase/schema.sql to have been run first (it creates `admins`).
--
-- There is deliberately no way to do this from the app. The `admins` table has
-- no INSERT policy at all, so admin can only ever be granted with the
-- service-role key or from this editor — a compromised member session cannot
-- promote itself.
-- ===========================================================================

-- 1. Grant. Change the email to the account you sign in with.
insert into public.admins (user_id, note)
select id, 'founder'
  from public.profiles
 where email = 'henybusiness657@gmail.com'
on conflict (user_id) do nothing;

-- 2. Confirm it took. Should return one row; zero means the email above has
--    never signed up, so there is no profile to promote yet.
select p.email, a.note, a.created_at
  from public.admins a
  join public.profiles p on p.id = a.user_id;

-- ---------------------------------------------------------------------------
-- To revoke someone later:
--
--   delete from public.admins
--    where user_id = (select id from public.profiles where email = 'them@example.com');
--
-- Revoking is immediate — the next request they make sees a 404 at /admin.
-- ---------------------------------------------------------------------------
