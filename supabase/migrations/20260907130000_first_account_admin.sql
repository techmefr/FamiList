-- Le premier compte cree est administrateur, et deja valide.
--
-- Sans lui, une base neuve est un cul-de-sac : chaque inscription arrive en attente, et personne
-- n a le droit de valider qui que ce soit. Le deblocage demandait d ouvrir un editeur SQL sur la
-- production, ce qui n est pas une etape qu on veut dans la mise en ligne.
--
-- Le verrou consultatif serialise le comptage pour la duree de la transaction : sans lui, deux
-- inscriptions simultanees sur une base vide verraient chacune zero profil et se declareraient
-- toutes les deux administratrices. Il n est pris qu a l inscription, jamais sur un chemin chaud.
--
-- Les comptes suivants ne changent pas : en attente, role utilisateur, valides depuis /admin.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_account boolean;
begin
  perform pg_advisory_xact_lock(hashtext('familist:first_account'));
  select not exists (select 1 from public.profiles) into first_account;

  insert into public.profiles (id, display_name, initial, role, status, reviewed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 1)),
    case when first_account then 'admin' else 'user' end,
    case when first_account then 'approved' else 'pending' end,
    case when first_account then now() end
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cree le profil d un nouveau compte. Le tout premier est administrateur et valide, pour qu une base neuve ne soit pas un cul-de-sac.';
