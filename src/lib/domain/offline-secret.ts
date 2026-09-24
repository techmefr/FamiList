/**
 * The device copy of a loyalty account password, readable offline behind an unlock code.
 *
 * Two layers. The outer one uses a non-extractable AES-GCM key generated on the device: a copied IndexedDB
 * file is useless elsewhere. The inner one is RSA-OAEP: the public key lets a fresh online read refresh the
 * copy without asking for anything, the private key is only kept wrapped by a PBKDF2 key derived from the
 * unlock code. Script running in the page can therefore not decrypt without the code either.
 */

export interface DeviceVault {
	id: 'device';
	deviceKey: CryptoKey;
	publicKey?: CryptoKey;
	wrappedPrivateKey?: ArrayBuffer;
	salt?: Uint8Array<ArrayBuffer>;
	wrapIv?: Uint8Array<ArrayBuffer>;
	iterations?: number;
	failures: number;
}

export interface StoredSecret {
	cardId: string;
	iv: Uint8Array<ArrayBuffer>;
	data: ArrayBuffer;
}

export interface SecretStore {
	getVault(): Promise<DeviceVault | undefined>;
	putVault(vault: DeviceVault): Promise<void>;
	getSecret(cardId: string): Promise<StoredSecret | undefined>;
	putSecret(secret: StoredSecret): Promise<void>;
	deleteSecret(cardId: string): Promise<void>;
	clearSecrets(): Promise<void>;
}

export type RevealOutcome =
	| { ok: true; value: string }
	| { ok: false; reason: 'missing' | 'wrong-code' | 'wiped' };

export const MIN_UNLOCK_CODE_LENGTH = 6;
export const MAX_UNLOCK_FAILURES = 5;
export const DEFAULT_ITERATIONS = 600_000;

const RSA: RsaHashedKeyGenParams = {
	name: 'RSA-OAEP',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256'
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));

export const isUnlockCodeValid = (code: string) => code.trim().length >= MIN_UNLOCK_CODE_LENGTH;

async function codeKey(code: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
	const material = await crypto.subtle.importKey('raw', encoder.encode(code.trim()), 'PBKDF2', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['wrapKey', 'unwrapKey']
	);
}

async function deviceVault(store: SecretStore): Promise<DeviceVault> {
	const existing = await store.getVault();
	if (existing) return existing;

	const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
	const vault: DeviceVault = { id: 'device', deviceKey, failures: 0 };
	await store.putVault(vault);
	return vault;
}

export async function hasUnlockCode(store: SecretStore) {
	return Boolean((await store.getVault())?.wrappedPrivateKey);
}

/** Setting a new code forgets the copies made under the previous one: they could not be opened anymore. */
export async function setUnlockCode(
	store: SecretStore,
	code: string,
	iterations = DEFAULT_ITERATIONS
): Promise<boolean> {
	if (!isUnlockCodeValid(code)) return false;

	const vault = await deviceVault(store);
	const pair = await crypto.subtle.generateKey(RSA, true, ['encrypt', 'decrypt']);
	const salt = randomBytes(16);
	const wrapIv = randomBytes(12);
	const wrapping = await codeKey(code, salt, iterations);
	const wrappedPrivateKey = await crypto.subtle.wrapKey('pkcs8', pair.privateKey, wrapping, {
		name: 'AES-GCM',
		iv: wrapIv
	});

	await store.clearSecrets();
	await store.putVault({
		...vault,
		publicKey: pair.publicKey,
		wrappedPrivateKey,
		salt,
		wrapIv,
		iterations,
		failures: 0
	});
	return true;
}

/** Refreshes the device copy after a successful online read. Does nothing until an unlock code exists. */
export async function storeSecret(store: SecretStore, cardId: string, password: string) {
	const vault = await store.getVault();
	if (!vault?.publicKey) return false;

	const contentKey = randomBytes(32);
	const contentIv = randomBytes(12);
	const aes = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
	const body = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: contentIv }, aes, encoder.encode(password));
	const sealedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, vault.publicKey, contentKey);
	contentKey.fill(0);

	const inner = new Uint8Array(2 + sealedKey.byteLength + contentIv.byteLength + body.byteLength);
	new DataView(inner.buffer).setUint16(0, sealedKey.byteLength);
	inner.set(new Uint8Array(sealedKey), 2);
	inner.set(contentIv, 2 + sealedKey.byteLength);
	inner.set(new Uint8Array(body), 2 + sealedKey.byteLength + contentIv.byteLength);

	const iv = randomBytes(12);
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.deviceKey, inner);
	await store.putSecret({ cardId, iv, data });
	return true;
}

/**
 * Opens the device copy with the unlock code. After `MAX_UNLOCK_FAILURES` wrong codes in a row, every copy
 * and the code itself are erased: the next reveal has to go through the server and its second factor again.
 */
export async function revealSecret(store: SecretStore, cardId: string, code: string): Promise<RevealOutcome> {
	const vault = await store.getVault();
	const secret = await store.getSecret(cardId);
	if (!vault?.wrappedPrivateKey || !vault.salt || !vault.wrapIv || !secret) {
		return { ok: false, reason: 'missing' };
	}

	let privateKey: CryptoKey;
	try {
		const wrapping = await codeKey(code, vault.salt, vault.iterations ?? DEFAULT_ITERATIONS);
		privateKey = await crypto.subtle.unwrapKey(
			'pkcs8',
			vault.wrappedPrivateKey,
			wrapping,
			{ name: 'AES-GCM', iv: vault.wrapIv },
			RSA,
			false,
			['decrypt']
		);
	} catch {
		const failures = vault.failures + 1;
		if (failures >= MAX_UNLOCK_FAILURES) {
			await forgetDeviceSecrets(store);
			return { ok: false, reason: 'wiped' };
		}
		await store.putVault({ ...vault, failures });
		return { ok: false, reason: 'wrong-code' };
	}

	const inner = new Uint8Array(
		await crypto.subtle.decrypt({ name: 'AES-GCM', iv: secret.iv }, vault.deviceKey, secret.data)
	);
	const keyLength = new DataView(inner.buffer).getUint16(0);
	const sealedKey = inner.slice(2, 2 + keyLength);
	const contentIv = inner.slice(2 + keyLength, 2 + keyLength + 12);
	const body = inner.slice(2 + keyLength + 12);

	const contentKey = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, sealedKey));
	const aes = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt']);
	contentKey.fill(0);
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: contentIv }, aes, body);

	if (vault.failures > 0) await store.putVault({ ...vault, failures: 0 });
	return { ok: true, value: decoder.decode(plain) };
}

export async function forgetDeviceSecrets(store: SecretStore) {
	await store.clearSecrets();
	const vault = await store.getVault();
	if (vault) await store.putVault({ id: 'device', deviceKey: vault.deviceKey, failures: 0 });
}
