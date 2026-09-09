-- Compte fixe pour les tests E2E et le développement local.
--
-- Créé directement dans les tables d'auth plutôt que par une inscription, parce qu'une inscription
-- laisserait le compte en attente : ici, il doit exister confirmé et approuvé dès `supabase start`,
-- sans clé de service ni appel réseau. Le mot de passe est un mot de passe de test connu de tous,
-- jamais utilisé hors de cette pile locale.
--
-- Rejoué à chaque `db reset` : idempotent, comme le reste de ce fichier.

do $$
declare
  fixture_id uuid := '11111111-1111-1111-1111-111111111111';
  fixture_email text := 'e2e@familist.test';
  fixture_password text := 'familist-e2e-test';
begin
  if exists (select 1 from auth.users where id = fixture_id) then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', fixture_id, 'authenticated', 'authenticated',
    fixture_email, crypt(fixture_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', 'E2E'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), fixture_id::text, fixture_id,
    jsonb_build_object('sub', fixture_id::text, 'email', fixture_email),
    'email', now(), now(), now()
  );

  -- Le trigger d'inscription a déjà posé la ligne `profiles` : on ne fait qu'approuver.
  update public.profiles set status = 'approved' where id = fixture_id;
end $$;
