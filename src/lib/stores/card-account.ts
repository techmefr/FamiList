import { supabase } from '$db/supabase';
import { sync } from '$sync/index.svelte';
import type { CardShareDecision } from '$domain/card-share';

/**
 * The online half of a loyalty card: its account, and the share requests. Nothing here goes through the
 * outbox or Dexie — the password in particular is fetched when asked for, handed to the caller, and never
 * written anywhere on the device.
 */

export interface CardAccount {
	email: string;
	hasPassword: boolean;
}

export interface PendingCardShare {
	cardId: string;
	householdId: string;
	cardName: string;
	sharedByName: string;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

const failure = (error: { message: string }): Outcome<never> => ({ ok: false, error: error.message });

export async function readCardAccount(cardId: string): Promise<Outcome<CardAccount | null>> {
	const { data, error } = await supabase
		.from('loyalty_card_accounts')
		.select('email, has_password')
		.eq('card_id', cardId)
		.maybeSingle();

	if (error) return failure(error);
	return {
		ok: true,
		value: data ? { email: data.email ?? '', hasPassword: data.has_password } : null
	};
}

export async function revealCardPassword(cardId: string): Promise<Outcome<string>> {
	const { data, error } = await supabase.rpc('read_loyalty_card_password', { card: cardId });
	if (error) return failure(error);
	return { ok: true, value: data ?? '' };
}

/** `password` null keeps the stored one, an empty string removes it. */
export async function saveCardAccount(
	cardId: string,
	email: string,
	password: string | null
): Promise<Outcome<null>> {
	const { error } = await supabase.rpc('set_loyalty_card_account', {
		card: cardId,
		account_email: email,
		password
	});
	if (error) return failure(error);
	return { ok: true, value: null };
}

export async function requestCardShare(cardId: string, householdId: string): Promise<Outcome<null>> {
	const { error } = await supabase.rpc('request_loyalty_card_share', {
		card: cardId,
		target_household: householdId
	});
	if (error) return failure(error);
	void sync.pullFresh();
	return { ok: true, value: null };
}

export async function withdrawCardShare(cardId: string, householdId: string): Promise<Outcome<null>> {
	const { error } = await supabase
		.from('loyalty_card_shares')
		.delete()
		.eq('card_id', cardId)
		.eq('household_id', householdId);
	if (error) return failure(error);
	void sync.pullFresh();
	return { ok: true, value: null };
}

export async function decideCardShare(
	cardId: string,
	householdId: string,
	decision: CardShareDecision
): Promise<Outcome<null>> {
	const { error } = await supabase.rpc('decide_loyalty_card_share', {
		card: cardId,
		target_household: householdId,
		decision
	});
	if (error) return failure(error);
	void sync.pullFresh();
	return { ok: true, value: null };
}

export async function pendingCardShares(): Promise<Outcome<PendingCardShare[]>> {
	const { data, error } = await supabase.rpc('pending_loyalty_card_shares');
	if (error) return failure(error);
	return {
		ok: true,
		value: (data ?? []).map((row) => ({
			cardId: row.card_id,
			householdId: row.household_id,
			cardName: row.card_name,
			sharedByName: row.shared_by_name ?? ''
		}))
	};
}
