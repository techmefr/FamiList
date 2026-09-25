import { deviceText, type DeviceLabel } from './device';

/**
 * The phone's own unlock — fingerprint, face or device PIN — as a second factor (#328).
 *
 * It is a WebAuthn factor enrolled with Supabase, not a local "biometric ok" answer: the server checks a
 * signature from a key that never leaves the phone, and only then raises the session to aal2. The rules on
 * the database side (`is_approved()`, `assert_card_secret_access()`) do not change and do not need to.
 */

export type FactorType = 'totp' | 'webauthn';

export interface KnownFactor {
	id: string;
	type: FactorType;
	friendlyName: string;
	createdAt: string;
}

/**
 * Supabase requires friendly names to be unique per account, and a person adding their phone twice (after
 * a reset, say) must not hit a refusal they cannot understand. The minute keeps two of them apart.
 */
export function deviceFactorName(label: DeviceLabel, on: string, unknown: string, at: Date): string {
	const stamp = at.toISOString().slice(0, 16).replace('T', ' ');
	return `${deviceText(label, on, unknown)} · ${stamp}`;
}

export const factorsOfType = (factors: readonly KnownFactor[], type: FactorType) =>
	factors.filter((factor) => factor.type === type);

/**
 * Which passkey factor to ask this device for. Asking for another device's credential opens a system sheet
 * that can only fail, so the one enrolled here comes first; with a single one there is nothing to choose.
 * With several and none remembered, `null`: the screen lists them by name instead of guessing.
 */
export function pickDeviceFactor(
	factors: readonly KnownFactor[],
	rememberedId: string | null
): KnownFactor | null {
	const passkeys = factorsOfType(factors, 'webauthn');
	return (
		passkeys.find((factor) => factor.id === rememberedId) ??
		(passkeys.length === 1 ? passkeys[0] : null)
	);
}

/**
 * Whether revealing asks the phone first. Only when a passkey of this device is known and usable: a TOTP
 * account keeps the flow it had, and the database checks aal2 on every read whatever the answer here.
 */
export const revealNeedsDevice = (factor: KnownFactor | null, supported: boolean) =>
	supported && factor !== null;
