-- Comptes fixes pour les tests E2E et le développement local.
--
-- Créés directement dans les tables d'auth plutôt que par une inscription, parce qu'une inscription
-- laisserait le compte en attente : ici, ils doivent exister confirmés et approuvés dès
-- `supabase start`, sans clé de service ni appel réseau. Le mot de passe est un mot de passe de
-- test connu de tous, jamais utilisé hors de cette pile locale.
--
-- Deux comptes, parce que l'application se joue à plusieurs : rejoindre un foyer, partager une
-- liste ou voter demandent quelqu'un d'autre. Le premier créé devient administrateur — c'est la
-- règle du premier compte — et reste celui que la plupart des tests utilisent.
--
-- Rejoué à chaque `db reset` : idempotent, comme le reste de ce fichier.

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

    -- Le trigger d'inscription a déjà posé la ligne `profiles` : on ne fait qu'approuver.
    update public.profiles set status = 'approved' where id = fixture.id;
  end loop;
end $$;
