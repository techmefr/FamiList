-- A loyalty card must never be permanently lost to a client bug, a stray sync push or an operator mistake:
-- deleting one now only marks it, it never erases the row. Nothing reads a marked card back (the two select
-- policies below both gain a restrictive companion), but the data itself, and its history in
-- loyalty_card_shares and loyalty_card_accounts, stays recoverable by an operator until someone purges it on
-- purpose.

alter table public.loyalty_cards add column deleted_at timestamptz;

create policy loyalty_cards_hide_deleted on public.loyalty_cards as restrictive for select
  using (deleted_at is null);

-- Hard DELETE stays possible for an operator working directly in Postgres (nobody but the table owner holds
-- that privilege), but the application role only ever reaches this table through PostgREST, which respects
-- RLS, not raw SQL: revoking delete from authenticated makes "remove a card" mean "set deleted_at" from here
-- on, whichever code path asks for it, today or in a future one nobody has written yet.
revoke delete on public.loyalty_cards from authenticated;
