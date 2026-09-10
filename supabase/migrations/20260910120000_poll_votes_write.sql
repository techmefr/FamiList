-- On ne vote que sur un sondage qu on peut lire.
--
-- poll_votes_write ne verifiait que l identite du votant, jamais l acces au sondage, alors que
-- poll_votes_select remonte jusqu a can_access_list. Un compte approuve pouvait donc voter dans
-- le sondage de n importe quel foyer en devinant un option_id.

drop policy poll_votes_write on public.poll_votes;
create policy poll_votes_write on public.poll_votes for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.poll_options o
      join public.polls p on p.id = o.poll_id
      join public.messages m on m.id = p.message_id
      where o.id = option_id and public.can_access_list(m.list_id)
    )
  );
