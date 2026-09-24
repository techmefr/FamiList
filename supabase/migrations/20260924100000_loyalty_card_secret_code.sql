-- A card-specific secret code, distinct from the barcode/QR already in `code`.
--
-- Some loyalty cards carry a second, shorter code on top of their scannable one — a PIN printed on the
-- back, a code asked for at the till instead of the barcode. It has nothing to do with an online account
-- (still out of scope, still local-only per the table's own comment): it belongs to the physical card
-- itself, the same as `code` does, just kept apart on screen behind its own reveal toggle.

alter table public.loyalty_cards add column secret_code text;

comment on column public.loyalty_cards.secret_code is
  'Code secondaire propre a la carte (PIN, code de caisse...), distinct du code-barres/QR. Pas un identifiant de compte en ligne.';
