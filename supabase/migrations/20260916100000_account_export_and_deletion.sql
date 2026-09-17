-- Leaving with your data, and leaving altogether.
--
-- The app runs with real people and today offers neither: deleting an account takes a psql session on
-- production, and getting your data back has no path at all. Two functions here, and nothing else — no Edge
-- Function. The `notify-admins` pattern exists because an email needs an SMTP relay, that is, something
-- Postgres cannot do. Reading your own rows and erasing your own account, Postgres can do: going through a
-- Deno function would only add a service key to protect and a floor to debug.
--
--
-- WHAT DELETION CANNOT BE
--
-- The data is shared. A household, its lists, its messages, its recorded prices belong to several people at
-- once. "Delete my account" therefore cannot mean "delete everything I have touched": that would empty other
-- people's lists in the name of my own right.
-- The rule kept fits in one sentence: what exists only for me disappears, what exists for others stays but
-- stops carrying my name.
--
-- What really disappears:
--   * the `auth.users` account and, by cascade, `profiles`, `household_members`, `list_members`,
--     `shop_layouts`, `shop_item_orders`, `mfa_backup_codes`, `invite_attempts`, `poll_votes`;
--   * the households where I was the last member, with all their content — nobody else will ever open them,
--     and keeping them would amount to keeping data with no holder;
--   * my bug reports. It is the only content "addressed to somebody" that I delete: a report is a support
--     exchange between a person and the administrator, it often describes what they were doing on screen and
--     may carry a capture of their own lists. Anonymising it would not clean it — the text stays talkative.
--   * my poll votes (`poll_votes` already cascades). A vote is an opinion attached to an identity and to
--     nothing else: with no name it means nothing any more, and removing it only lowers a counter. Nothing
--     has been built on it.
--
-- What stays, anonymised — all these columns are already `on delete set null`, so the schema had already
-- decided; this file only owns the choice:
--   * `messages.user_id`. A discussion thread is a common work. Removing a message three people have replied
--     to leaves a hole in their conversation, and that is their data, not mine. The text stays, the link to
--     the account goes: the chat screen then shows `chat.unknownAuthor`, exactly as for a message whose
--     author is unknown — no client code to change. Keeping the message with the name would not be a
--     deletion; removing it would be erasing from other people.
--   * `item_prices.recorded_by`. The price of a product in a shop is a fact about the shop. Only the
--     attribution is personal.
--   * `recipes.created_by`. The recipe has entered the household's kitchen, and it stays there.
--   * `items.assigned_to` and `poll_options.claimed_by`: the task is no longer assigned to anybody, the dish
--     is no longer brought by anybody. That is accurate, and it is what should be shown.
--
--
-- THE FOUR REFUSALS
--
-- 1. The second factor. Deletion is irreversible: it asks for the authentication level the account has
--    imposed on itself, like everything else in the app. A pending or refused account can however delete
--    itself — that is even the case where the right is most obvious, so `is_approved()` would be a bad guard
--    here.
-- 2. The demonstration account. It is shared and reset by `reset_demo`; it belongs to nobody and represents
--    nobody.
-- 3. The last valid administrator. `profiles_keep_one_admin` only watches `update` — and its own
--    documentation says why: preventing the deletion of the profile would make an account impossible to
--    delete. So that refusal lives here, in the function, and not in yet another trigger: the way out
--    exists, it is called `promote_admin`, and it is named in the message. We bypass nothing, we complete at
--    the only place that could.
-- 4. Nothing about the last member of a household. `leave_household` refuses that departure because it would
--    leave a household alive and empty, invisible to everybody. Here the household is not left empty: it is
--    deleted with the person. `leave_household`'s rule is honoured, not bypassed — and that function is not
--    called, precisely so as not to have to make it lie.
--
--
-- THE CASE OF THE OWNER WHO LEAVES
--
-- `households.created_by` is `on delete restrict`: with no handover, deleting the account would fail on a
-- constraint, which is exactly the right default behaviour — better a refusal than an orphan household. So
-- the handover is explicit: the household passes to the oldest remaining member, preferring an owner already
-- in place, and that member becomes `owner` if the household had none left. A household with no owner is a
-- household where nobody can invite or remove any more: the handover is not a courtesy, it is what stops the
-- others being blocked.

/*
 * The export.
 *
 * `returns jsonb` rather than a file: the app is a static bundle, and it is the browser that makes the file
 * to download. Nothing passes through intermediate storage, so nothing has to be purged afterwards.
 *
 * The scope rule, single and deliberately readable: a household's content is exported in full only if I am
 * its only member. Everywhere else I receive only the rows carrying my identifier. My messages are my
 * personal data — they designate me, the GDPR owes them to me — but the others' replies around them are not,
 * and an export is not a back door into the household's conversation.
 *
 * The backup codes' hashes are not exported: they are authentication secrets, not personal data to be
 * returned, and making them readable would help nobody.
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
          -- Non-null only for a household where I am the only member. Elsewhere, the key stays at `null`
          -- rather than being absent: absence would read as an omission from the export.
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
    -- What I have written outside my own place. The context is limited to the list name: without it the
    -- export is a string of sentences with no thread, with more than it it becomes the others' archive.
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
      -- The aisle arrangement shop by shop: it is a learning of my habits, and therefore data about me, even
      -- if none of its columns looks like content.
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
 * The deletion.
 *
 * Everything is in one transaction: if handing a household over fails, nothing is deleted, and the person
 * tries again instead of ending up half gone.
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

  -- The same lock as `redeem_invite`: without it, somebody joining one of my households while I am deleting
  -- it ends up a member of a household that no longer exists.
  perform public.lock_household_membership();

  for membership in
    select m.household_id, m.role from public.household_members m where m.user_id = me
  loop
    if not exists (
      select 1 from public.household_members o
      where o.household_id = membership.household_id and o.user_id <> me
    ) then
      -- Last member: the household goes with me, by cascade. No other person has access to it.
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

    -- The departure triggers do the rest: shared lists left, arrangements erased.
    delete from public.household_members
    where household_id = membership.household_id and user_id = me;
  end loop;

  -- The households I created and have since left. `created_by` is `on delete restrict`: without this
  -- handover, the deletion would fail on a household I cannot even see any more.
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

  -- The rest follows the foreign keys set by the schema: cascade for what existed only for me, `set null`
  -- for what I leave to the others.
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

comment on function public.delete_account() is
  'Supprime le compte de l appelant. Les foyers dont il etait le dernier membre partent avec lui ; ailleurs le foyer est repris par le plus ancien membre restant et le contenu partage reste, sans nom.';
