import { describe, expect, it } from 'vitest';
import {
	MAX_UNLOCK_FAILURES,
	forgetDeviceSecrets,
	hasUnlockCode,
	newPasskeySalt,
	passkeyUnlockRequest,
	revealSecret,
	revealSecretWithPasskey,
	setPasskeyUnlock,
	setUnlockCode,
	storeSecret,
	unlockMethod,
	type DeviceVault,
	type SecretStore,
	type StoredSecret
} from './offline-secret';

const ITERATIONS = 1_000;
const PASSWORD = 'Mot-de-passe-Carrefour-42!';

function memoryStore() {
	let vault: DeviceVault | undefined;
	const secrets = new Map<string, StoredSecret>();

	const store: SecretStore = {
		getVault: async () => vault,
		putVault: async (next) => {
			vault = next;
		},
		getSecret: async (cardId) => secrets.get(cardId),
		putSecret: async (secret) => {
			secrets.set(secret.cardId, secret);
		},
		deleteSecret: async (cardId) => {
			secrets.delete(cardId);
		},
		clearSecrets: async () => {
			secrets.clear();
		}
	};

	return { store, persisted: () => ({ vault, secrets: [...secrets.values()] }) };
}

function persistedBytes(value: unknown): Uint8Array[] {
	if (value instanceof ArrayBuffer) return [new Uint8Array(value)];
	if (ArrayBuffer.isView(value)) return [new Uint8Array(value.buffer, value.byteOffset, value.byteLength)];
	if (typeof value === 'string') return [new TextEncoder().encode(value)];
	if (Array.isArray(value)) return value.flatMap(persistedBytes);
	if (value && typeof value === 'object' && !(value instanceof CryptoKey)) {
		return Object.values(value).flatMap(persistedBytes);
	}
	return [];
}

const contains = (haystack: Uint8Array, needle: Uint8Array) => {
	outer: for (let start = 0; start + needle.length <= haystack.length; start++) {
		for (let offset = 0; offset < needle.length; offset++) {
			if (haystack[start + offset] !== needle[offset]) continue outer;
		}
		return true;
	}
	return false;
};

describe('offline secret', () => {
	it('ne stocke rien tant qu’aucun code de déverrouillage n’existe', async () => {
		const { store, persisted } = memoryStore();
		expect(await storeSecret(store, 'c1', PASSWORD)).toBe(false);
		expect(persisted().secrets).toEqual([]);
	});

	it('rend le mot de passe avec le bon code', async () => {
		const { store } = memoryStore();
		await setUnlockCode(store, '482913', ITERATIONS);
		await storeSecret(store, 'c1', PASSWORD);

		expect(await hasUnlockCode(store)).toBe(true);
		expect(await revealSecret(store, 'c1', '482913')).toEqual({ ok: true, value: PASSWORD });
	});

	it('ne laisse jamais le mot de passe en clair dans ce qui est persisté', async () => {
		const { store, persisted } = memoryStore();
		await setUnlockCode(store, '482913', ITERATIONS);
		await storeSecret(store, 'c1', PASSWORD);

		const needle = new TextEncoder().encode(PASSWORD);
		const code = new TextEncoder().encode('482913');
		const bytes = persistedBytes(persisted());

		expect(bytes.length).toBeGreaterThan(0);
		for (const chunk of bytes) {
			expect(contains(chunk, needle)).toBe(false);
			expect(contains(chunk, code)).toBe(false);
		}
		expect(persisted().vault?.deviceKey.extractable).toBe(false);
	});

	it('refuse un mauvais code sans rien révéler', async () => {
		const { store } = memoryStore();
		await setUnlockCode(store, '482913', ITERATIONS);
		await storeSecret(store, 'c1', PASSWORD);

		expect(await revealSecret(store, 'c1', '000000')).toEqual({ ok: false, reason: 'wrong-code' });
	});

	it('efface les copies après trop d’échecs', async () => {
		const { store, persisted } = memoryStore();
		await setUnlockCode(store, '482913', ITERATIONS);
		await storeSecret(store, 'c1', PASSWORD);

		for (let attempt = 1; attempt < MAX_UNLOCK_FAILURES; attempt++) {
			expect((await revealSecret(store, 'c1', '000000')).ok).toBe(false);
		}
		expect(await revealSecret(store, 'c1', '000000')).toEqual({ ok: false, reason: 'wiped' });
		expect(persisted().secrets).toEqual([]);
		expect(await hasUnlockCode(store)).toBe(false);
	});

	it('refuse un code trop court', async () => {
		const { store } = memoryStore();
		expect(await setUnlockCode(store, '123', ITERATIONS)).toBe(false);
		expect(await hasUnlockCode(store)).toBe(false);
	});

	it('oublie tout à la déconnexion', async () => {
		const { store, persisted } = memoryStore();
		await setUnlockCode(store, '482913', ITERATIONS);
		await storeSecret(store, 'c1', PASSWORD);
		await forgetDeviceSecrets(store);

		expect(persisted().secrets).toEqual([]);
		expect(await revealSecret(store, 'c1', '482913')).toEqual({ ok: false, reason: 'missing' });
	});
});

const prfOutput = (seed: number) => new Uint8Array(32).fill(seed).buffer;
const credentialId = new Uint8Array([1, 2, 3, 4]).buffer;

describe('offline secret behind the phone unlock', () => {
	it('rend le mot de passe avec la sortie PRF de la clé d’accès', async () => {
		const { store } = memoryStore();
		const salt = newPasskeySalt();
		expect(await setPasskeyUnlock(store, { credentialId, salt }, prfOutput(7))).toBe(true);
		await storeSecret(store, 'c1', PASSWORD);

		expect(await unlockMethod(store)).toBe('device');
		expect(await passkeyUnlockRequest(store)).toEqual({ credentialId, salt });
		expect(await revealSecretWithPasskey(store, 'c1', prfOutput(7))).toEqual({ ok: true, value: PASSWORD });
	});

	it('refuse la sortie d’une autre clé sans rien effacer', async () => {
		const { store, persisted } = memoryStore();
		await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, prfOutput(7));
		await storeSecret(store, 'c1', PASSWORD);

		for (let attempt = 0; attempt <= MAX_UNLOCK_FAILURES; attempt++) {
			expect(await revealSecretWithPasskey(store, 'c1', prfOutput(8))).toEqual({
				ok: false,
				reason: 'wrong-device'
			});
		}
		expect(persisted().secrets).toHaveLength(1);
	});

	it('refuse une sortie PRF tronquée', async () => {
		const { store } = memoryStore();
		expect(await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, new ArrayBuffer(16))).toBe(
			false
		);
		expect(await unlockMethod(store)).toBeNull();
	});

	it('ne persiste ni le mot de passe ni la sortie PRF', async () => {
		const { store, persisted } = memoryStore();
		await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, prfOutput(7));
		await storeSecret(store, 'c1', PASSWORD);

		const needle = new TextEncoder().encode(PASSWORD);
		const output = new Uint8Array(prfOutput(7));
		for (const chunk of persistedBytes(persisted())) {
			expect(contains(chunk, needle)).toBe(false);
			expect(contains(chunk, output)).toBe(false);
		}
	});

	it('passer à un code oublie la clé d’accès et ses copies, et inversement', async () => {
		const { store, persisted } = memoryStore();
		await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, prfOutput(7));
		await storeSecret(store, 'c1', PASSWORD);

		await setUnlockCode(store, '482913', ITERATIONS);
		expect(await unlockMethod(store)).toBe('code');
		expect(await passkeyUnlockRequest(store)).toBeNull();
		expect(persisted().secrets).toEqual([]);

		await storeSecret(store, 'c1', PASSWORD);
		await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, prfOutput(9));
		expect(await hasUnlockCode(store)).toBe(false);
		expect(await revealSecret(store, 'c1', '482913')).toEqual({ ok: false, reason: 'missing' });
	});

	it('oublie la clé d’accès à la déconnexion', async () => {
		const { store } = memoryStore();
		await setPasskeyUnlock(store, { credentialId, salt: newPasskeySalt() }, prfOutput(7));
		await storeSecret(store, 'c1', PASSWORD);
		await forgetDeviceSecrets(store);

		expect(await unlockMethod(store)).toBeNull();
		expect(await revealSecretWithPasskey(store, 'c1', prfOutput(7))).toEqual({ ok: false, reason: 'missing' });
	});
});
