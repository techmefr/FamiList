-- Fixed accounts for the E2E tests and local development.
--
-- Created directly in the auth tables rather than by a sign-up, because a sign-up would leave the account
-- pending: here they must exist confirmed and approved from `supabase start`, with no service key and no
-- network call. The password is a test password known to everybody, never used outside this local stack.
--
-- Two accounts, because the application is played with several people: joining a household, sharing a list or
-- voting all need somebody else. The first created becomes an administrator — that is the first-account rule
-- — and stays the one most tests use.
--
-- Replayed on every `db reset`: idempotent, like the rest of this file.

do $$
declare
  fixture_password text := 'familist-e2e-test';
  fixture record;
begin
  for fixture in
    select *
    from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'e2e@familist.test', 'E2E'),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'e2e-second@familist.test', 'E2E Second')
    ) as f(id, email, display_name)
  loop
    if exists (select 1 from auth.users where id = fixture.id) then
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', fixture.id, 'authenticated', 'authenticated',
      fixture.email, crypt(fixture_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', fixture.display_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), fixture.id::text, fixture.id,
      jsonb_build_object('sub', fixture.id::text, 'email', fixture.email),
      'email', now(), now(), now()
    );

    -- The sign-up trigger has already laid down the `profiles` row: we only approve.
    update public.profiles set status = 'approved' where id = fixture.id;
  end loop;
end $$;
