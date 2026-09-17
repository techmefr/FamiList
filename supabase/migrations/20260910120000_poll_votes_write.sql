-- You only vote on a poll you can read.
--
-- poll_votes_write checked only the voter's identity, never access to the poll, whereas poll_votes_select goes
-- all the way up to can_access_list. An approved account could therefore vote in any household's poll by
-- guessing an option_id.

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
