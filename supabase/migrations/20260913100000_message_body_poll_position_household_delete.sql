-- Resserre trois contraintes laissees ouvertes depuis le schema initial.
--
-- 1. messages.body est nullable sans lien avec is_system. Le client ecrit toujours une chaine,
--    meme vide pour le message porteur d un sondage, mais rien au niveau base n empeche un
--    message utilisateur avec body = null : le fil de discussion afficherait alors une bulle
--    vide impossible a editer ou a comprendre. Seuls les messages systeme, generes par la base
--    et rendus a partir d un libelle traduit, ont une raison de ne pas porter de texte.
--
-- 2. poll_options n a pas d unicite sur (poll_id, position). Les positions viennent de l index
--    du tableau a la creation, donc elles sont distinctes en pratique, mais deux clients hors
--    ligne qui rejouent leur file peuvent aboutir a deux options de meme rang dans un meme
--    sondage. L ordre affiche devient alors dependant du hasard du tri, et la liste des options
--    peut changer d ordre a chaque rechargement.
--
-- 3. households n a aucune policy delete : la seule suppression possible passe par redeem_invite,
--    en security definer, lors d un transfert de foyer. Un proprietaire ne peut donc pas
--    dissoudre son foyer. On ouvre le cas minimal et sans effet de bord : le proprietaire d un
--    foyer dont il est le dernier membre. Supprimer un foyer encore habite ferait disparaitre en
--    cascade les listes et les messages des autres membres, ce qui n est pas une decision qui
--    revient au seul proprietaire. redeem_invite continue de passer outre, security definer
--    n etant pas soumis aux policies.

alter table public.messages
  add constraint messages_body_required check (is_system or body is not null);

alter table public.poll_options
  add constraint poll_options_poll_position_key unique (poll_id, position);

create or replace function public.is_household_sole_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id <> (select auth.uid())
  )
$$;

comment on function public.is_household_sole_member(uuid) is
  'Vrai si l appelant est le seul membre du foyer. Security definer pour ne pas dependre de ce que la policy de lecture de household_members laisse voir.';

create policy households_delete on public.households for delete
  using (public.is_household_owner(id) and public.is_household_sole_member(id));
