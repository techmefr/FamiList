import { describe, expect, it } from 'vitest';
import {
	MAX_UNLOCK_FAILURES,
	forgetDeviceSecrets,
	hasUnlockCode,
	revealSecret,
	setUnlockCode,
	storeSecret,
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
