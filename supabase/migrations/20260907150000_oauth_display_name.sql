-- Naming an account arriving from an external provider correctly.
--
-- The application's form puts display_name in the metadata, but Google, Microsoft and Apple know nothing
-- about it: they return full_name or name. Without those two keys, a Google sign-up was called by the start
-- of its address, which gives members named "first.last42" in a household where everybody knows each other.
--
-- Apple may also return no address at all when the person hides theirs and we do not ask for the private
-- relay. split_part on null gives null, and display_name is not null: the account was then refused at
-- creation. Hence the last hard-coded fallback.
--
-- nullif everywhere: a metadata key present but empty is more common than absent, and coalesce alone would
-- have accepted it as a name.
--
-- The rest does not move: the first account is still an administrator and already valid.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_account boolean;
  name text;
begin
  perform pg_advisory_xact_lock(hashtext('familist:first_account'));
  select not exists (select 1 from public.profiles) into first_account;

  name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Membre'
  );

  insert into public.profiles (id, display_name, initial, role, status, reviewed_at)
  values (
    new.id,
    name,
    upper(left(name, 1)),
    case when first_account then 'admin' else 'user' end,
    case when first_account then 'approved' else 'pending' end,
    case when first_account then now() end
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cree le profil d un nouveau compte, quel que soit le fournisseur. Le tout premier est administrateur et valide, pour qu une base neuve ne soit pas un cul-de-sac.';
