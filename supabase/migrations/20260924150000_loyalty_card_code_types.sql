-- The screen draws and scans seven formats, the column only accepted three. A card scanned as Code 128, the
-- format most retailers print, was refused by this check: the write was dropped as final and the card
-- vanished from the screen at the next re-read.

alter table public.loyalty_cards drop constraint if exists loyalty_cards_code_type_check;

alter table public.loyalty_cards add constraint loyalty_cards_code_type_check
  check (code_type in ('code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'qr_code'));
