-- The first account created is an administrator, and already valid.
--
-- Without it, a fresh database is a dead end: every sign-up arrives pending, and nobody has the right to
-- validate anyone. Unblocking it required opening a SQL editor on production, which is not a step we want in
-- going live.
--
-- The advisory lock serialises the count for the duration of the transaction: without it, two simultaneous
-- sign-ups on an empty database would each see zero profiles and both declare themselves administrators. It
-- is only taken at sign-up, never on a hot path.
--
-- The following accounts do not change: pending, user role, validated from /admin.

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
