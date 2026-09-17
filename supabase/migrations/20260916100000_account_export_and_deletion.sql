-- Partir avec ses donnees, et partir tout court.
--
-- L app tourne avec de vraies personnes et n offre aujourd hui ni l un ni l autre : supprimer un
-- compte demande une session psql sur la production, et recuperer ses donnees n a aucun chemin du
-- tout. Deux fonctions ici, et rien d autre — pas d Edge Function. Le patron `notify-admins` existe
-- parce qu un courriel demande un relais SMTP, c est-a-dire quelque chose que Postgres ne sait pas
-- faire. Lire ses propres lignes et effacer son propre compte, Postgres sait faire : passer par une
-- fonction Deno n ajouterait qu une cle de service a proteger et un etage a debugger.
--
--
-- CE QUE LA SUPPRESSION NE PEUT PAS ETRE
--
-- Les donnees sont partagees. Un foyer, ses listes, ses messages, ses prix releves appartiennent a
-- plusieurs personnes a la fois. « Supprimer mon compte » ne peut donc pas vouloir dire « supprimer
-- tout ce que j ai touche » : ce serait vider les listes des autres au nom de mon droit a moi.
-- La regle retenue tient en une phrase : ce qui n existe que pour moi disparait, ce qui existe pour
-- les autres reste mais cesse de porter mon nom.
--
-- Ce qui disparait vraiment :
--   * le compte `auth.users` et, par cascade, `profiles`, `household_members`, `list_members`,
--     `shop_layouts`, `shop_item_orders`, `mfa_backup_codes`, `invite_attempts`, `poll_votes` ;
--   * les foyers dont j etais le dernier membre, avec tout leur contenu — personne d autre ne les
--     ouvrira jamais, les garder reviendrait a conserver des donnees sans titulaire ;
--   * mes signalements de bogue. C est le seul contenu « adresse a quelqu un » que je supprime :
--     un signalement est un echange de support entre une personne et l administrateur, il decrit
--     souvent ce qu elle faisait a l ecran et peut porter une capture de ses propres listes.
--     L anonymiser ne le nettoierait pas — le texte, lui, reste bavard.
--   * mes votes de sondage (`poll_votes` casse deja en cascade). Un vote est une opinion attachee a
--     une identite et a rien d autre : sans nom il ne veut plus rien dire, et le retirer ne fait
--     que baisser un compteur. Rien ne s est construit dessus.
--
-- Ce qui reste, anonymise — toutes ces colonnes sont deja en `on delete set null`, le schema avait
-- donc deja tranche ; ce fichier ne fait qu assumer le choix :
--   * `messages.user_id`. Un fil de discussion est une oeuvre commune. Retirer un message auquel
--     trois personnes ont repondu laisse un trou dans leur conversation a elles, et c est leur
--     donnee, pas la mienne. Le texte reste, le lien vers le compte part : l ecran de discussion
--     affiche alors `chat.unknownAuthor`, exactement comme pour un message dont l auteur est
--     inconnu — aucun code client a changer. Garder le message avec le nom ne serait pas une
--     suppression ; le retirer serait effacer chez les autres.
--   * `item_prices.recorded_by`. Le prix d un produit dans un magasin est un fait sur le magasin.
--     Seule l attribution est personnelle.
--   * `recipes.created_by`. La recette est entree dans la cuisine du foyer, elle y reste.
--   * `items.assigned_to` et `poll_options.claimed_by` : la tache n est plus assignee a personne,
--     le plat n est plus apporte par personne. C est exact, et c est ce qu il faut afficher.
--
--
-- LES QUATRE REFUS
--
-- 1. Le deuxieme facteur. La suppression est irreversible : elle demande le niveau
--    d authentification que le compte s est lui-meme impose, comme tout le reste de l app. Un
--    compte en attente ou refuse peut en revanche se supprimer — c est meme le cas ou le droit est
--    le plus evident, `is_approved()` serait donc une mauvaise garde ici.
-- 2. Le compte de demonstration. Il est partage et remis a zero par `reset_demo` ; il n appartient
--    a personne et ne represente personne.
-- 3. Le dernier administrateur valide. `profiles_keep_one_admin` ne surveille que `update` — et sa
--    propre documentation dit pourquoi : empecher la suppression du profil rendrait un compte
--    impossible a supprimer. Ce refus-la vit donc ici, dans la fonction, et pas dans un declencheur
--    de plus : la sortie existe, elle s appelle `promote_admin`, et elle est nommee dans le
--    message. On ne contourne rien, on complete au seul endroit qui pouvait le faire.
-- 4. Rien au sujet du dernier membre d un foyer. `leave_household` refuse ce depart parce qu il
--    laisserait un foyer vivant et vide, invisible a tous. Ici le foyer n est pas laisse vide : il
--    est supprime avec la personne. La regle de `leave_household` est respectee, pas contournee —
--    et cette fonction n est pas appelee, justement pour ne pas avoir a la faire mentir.
--
--
-- LE CAS DU PROPRIETAIRE QUI PART
--
-- `households.created_by` est en `on delete restrict` : sans reprise, la suppression du compte
-- echouerait sur une contrainte, ce qui est exactement le bon comportement par defaut — mieux vaut
-- un refus qu un foyer orphelin. La reprise est donc explicite : le foyer passe au plus ancien
-- membre restant, en preferant un proprietaire deja en place, et ce membre devient `owner` si le
-- foyer n en avait plus. Un foyer sans proprietaire est un foyer ou plus personne ne peut inviter
-- ni exclure : la reprise n est pas une politesse, c est ce qui empeche de bloquer les autres.

/*
 * L export.
 *
 * `returns jsonb` plutot qu un fichier : l app est un bundle statique, c est le navigateur qui
 * fabrique le fichier a telecharger. Rien ne transite par un stockage intermediaire, donc rien
 * n est a purger ensuite.
 *
 * La regle de perimetre, unique et volontairement lisible : le contenu d un foyer n est exporte en
 * entier que si j en suis le seul membre. Partout ailleurs je ne recois que les lignes qui portent
 * mon identifiant. Mes messages sont mes donnees personnelles — ils me designent, le RGPD me les
 * doit — mais les reponses des autres autour ne le sont pas, et un export n est pas une porte
 * derobee vers la conversation du foyer.
 *
 * Les condensats des codes de secours ne sont pas exportes : ce sont des secrets d authentification,
 * pas des donnees personnelles a restituer, et les rendre lisibles n aiderait personne.
 */
create or replace function public.export_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  sole uuid[];
begin
  if me is null then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.household_id), '{}')
  into sole
  from public.household_members m
  where m.user_id = me
    and not exists (
      select 1 from public.household_members o
      where o.household_id = m.household_id and o.user_id <> me
    );

  return jsonb_build_object(
    'exportedAt', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email::text,
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at
      )
      from auth.users u where u.id = me
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = me),
    'households', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'name', h.name,
          'role', m.role,
          'tint', m.tint,
          'joinedAt', m.joined_at,
          'createdByMe', h.created_by = me,
          'soleMember', h.id = any(sole),
          -- Non nul seulement pour un foyer dont je suis le seul membre. Ailleurs, la cle reste a
          -- `null` plutot que d etre absente : l absence se lirait comme un oubli de l export.
          'content', case when h.id = any(sole) then jsonb_build_object(
            'shops', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                      from public.shops s where s.household_id = h.id),
            'aisles', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
                       from public.aisles a where a.household_id = h.id),
            'lists', (select coalesce(jsonb_agg(
                        to_jsonb(l) || jsonb_build_object(
                          'items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
                                    from public.items i where i.list_id = l.id),
                          'messages', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
                                       from public.messages g where g.list_id = l.id)
                        )
                      ), '[]'::jsonb)
                      from public.lists l where l.household_id = h.id),
            'loyaltyCards', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                             from public.loyalty_cards c where c.household_id = h.id),
            'recipes', (select coalesce(jsonb_agg(
                          to_jsonb(r) || jsonb_build_object(
                            'ingredients', (select coalesce(jsonb_agg(to_jsonb(ri)), '[]'::jsonb)
                                            from public.recipe_ingredients ri where ri.recipe_id = r.id),
                            'steps', (select coalesce(jsonb_agg(to_jsonb(rs)), '[]'::jsonb)
                                      from public.recipe_steps rs where rs.recipe_id = r.id)
                          )
                        ), '[]'::jsonb)
                        from public.recipes r where r.household_id = h.id),
            'prices', (select coalesce(jsonb_agg(to_jsonb(ip)), '[]'::jsonb)
                       from public.item_prices ip where ip.household_id = h.id)
          ) else null end
        ) order by m.joined_at
      ), '[]'::jsonb)
      from public.household_members m
      join public.households h on h.id = m.household_id
      where m.user_id = me
    ),
    -- Ce que j ai ecrit ailleurs que chez moi. Le contexte se limite au nom de la liste : sans lui
    -- l export est une suite de phrases sans fil, avec plus que lui il devient l archive des autres.
    'authored', jsonb_build_object(
      'messages', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', g.id, 'listId', g.list_id, 'listName', l.name,
            'body', g.body, 'createdAt', g.created_at
          ) order by g.created_at
        ), '[]'::jsonb)
        from public.messages g
        join public.lists l on l.id = g.list_id
        where g.user_id = me and not (l.household_id = any(sole))
      ),
      'pollVotes', (
        select coalesce(jsonb_agg(
          jsonb_build_object('optionId', v.option_id, 'label', o.label, 'question', pl.question)
        ), '[]'::jsonb)
        from public.poll_votes v
        join public.poll_options o on o.id = v.option_id
        join public.polls pl on pl.id = o.poll_id
        where v.user_id = me
      ),
      'pollClaims', (
        select coalesce(jsonb_agg(
          jsonb_build_object('optionId', o.id, 'label', o.label, 'question', pl.question)
        ), '[]'::jsonb)
        from public.poll_options o
        join public.polls pl on pl.id = o.poll_id
        where o.claimed_by = me
      ),
      'assignedItems', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', i.id, 'name', i.name, 'listId', i.list_id, 'listName', l.name)
        ), '[]'::jsonb)
        from public.items i
        join public.lists l on l.id = i.list_id
        where i.assigned_to = me and not (l.household_id = any(sole))
      ),
      'prices', (
        select coalesce(jsonb_agg(to_jsonb(ip)), '[]'::jsonb)
        from public.item_prices ip
        where ip.recorded_by = me and not (ip.household_id = any(sole))
      ),
      'recipes', (
        select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
        from public.recipes r
        where r.created_by = me and not (r.household_id = any(sole))
      ),
      'listAccess', (
        select coalesce(jsonb_agg(jsonb_build_object('listId', lm.list_id, 'name', l.name)), '[]'::jsonb)
        from public.list_members lm
        join public.lists l on l.id = lm.list_id
        where lm.user_id = me
      ),
      'invitesCreated', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'householdId', iv.household_id, 'createdAt', iv.created_at,
          'expiresAt', iv.expires_at, 'usedAt', iv.used_at
        )), '[]'::jsonb)
        from public.household_invites iv
        where iv.created_by = me
      ),
      -- Le rangement des rayons magasin par magasin : c est un apprentissage de mes habitudes, donc
      -- une donnee sur moi, meme si aucune de ses colonnes ne ressemble a un contenu.
      'shopLayouts', (
        select coalesce(jsonb_agg(to_jsonb(sl)), '[]'::jsonb)
        from public.shop_layouts sl where sl.user_id = me
      ),
      'shopItemOrders', (
        select coalesce(jsonb_agg(to_jsonb(so)), '[]'::jsonb)
        from public.shop_item_orders so where so.user_id = me
      )
    ),
    'bugReports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'description', b.description, 'path', b.path,
        'status', b.status, 'createdAt', b.created_at
      ) order by b.created_at), '[]'::jsonb)
      from public.bug_reports b where b.user_id = me
    )
  );
end;
$$;

revoke all on function public.export_account() from public, anon;
grant execute on function public.export_account() to authenticated;

comment on function public.export_account() is
  'Rend en JSON tout ce que l app retient de l appelant. Le contenu d un foyer n est entier que si l appelant en est le seul membre ; ailleurs, seules les lignes qui portent son identifiant sortent.';

/*
 * La suppression.
 *
 * Tout tient dans une transaction : si la reprise d un foyer echoue, rien n est supprime, et la
 * personne reessaie au lieu de se retrouver a moitie partie.
 */
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  membership record;
  orphan record;
  successor uuid;
begin
  if me is null then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  if exists (
    select 1 from auth.mfa_factors f where f.user_id = me and f.status = 'verified'
  ) and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'deuxieme facteur requis' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = me and p.is_demo) then
    raise exception 'le compte de demonstration ne se supprime pas' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = me and p.role = 'admin' and p.status = 'approved'
  ) and not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and p.status = 'approved' and p.id <> me
  ) then
    raise exception 'nommez un autre administrateur avant de partir' using errcode = '23514';
  end if;

  -- Le meme verrou que `redeem_invite` : sans lui, quelqu un qui rejoint un de mes foyers pendant
  -- que je le supprime se retrouve membre d un foyer qui n existe plus.
  perform public.lock_household_membership();

  for membership in
    select m.household_id, m.role from public.household_members m where m.user_id = me
  loop
    if not exists (
      select 1 from public.household_members o
      where o.household_id = membership.household_id and o.user_id <> me
    ) then
      -- Dernier membre : le foyer part avec moi, en cascade. Aucune autre personne n y a d acces.
      delete from public.households where id = membership.household_id;
      continue;
    end if;

    select o.user_id
    into successor
    from public.household_members o
    where o.household_id = membership.household_id and o.user_id <> me
    order by (o.role = 'owner') desc, o.joined_at, o.user_id
    limit 1;

    if membership.role = 'owner' and not exists (
      select 1 from public.household_members o
      where o.household_id = membership.household_id and o.user_id <> me and o.role = 'owner'
    ) then
      update public.household_members
      set role = 'owner'
      where household_id = membership.household_id and user_id = successor;
    end if;

    update public.households
    set created_by = successor
    where id = membership.household_id and created_by = me;

    -- Les declencheurs de depart font le reste : listes partagees quittees, rangements effaces.
    delete from public.household_members
    where household_id = membership.household_id and user_id = me;
  end loop;

  -- Les foyers que j ai crees et quittes depuis. `created_by` est en `on delete restrict` : sans
  -- cette reprise, la suppression echouerait sur un foyer que je ne vois meme plus.
  for orphan in select h.id from public.households h where h.created_by = me
  loop
    select o.user_id
    into successor
    from public.household_members o
    where o.household_id = orphan.id
    order by (o.role = 'owner') desc, o.joined_at, o.user_id
    limit 1;

    if successor is null then
      delete from public.households where id = orphan.id;
    else
      update public.households set created_by = successor where id = orphan.id;
    end if;
  end loop;

  delete from public.bug_reports where user_id = me;

  -- Le reste suit les cles etrangeres posees par le schema : cascade pour ce qui n existait que
  -- pour moi, `set null` pour ce que je laisse aux autres.
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

comment on function public.delete_account() is
  'Supprime le compte de l appelant. Les foyers dont il etait le dernier membre partent avec lui ; ailleurs le foyer est repris par le plus ancien membre restant et le contenu partage reste, sans nom.';
