import { db } from '$db/schema';
import type { SecretStore } from '$domain/offline-secret';

export const deviceSecrets: SecretStore = {
	getVault: () => db.deviceVault.get('device'),
	putVault: async (vault) => {
		await db.deviceVault.put(vault);
	},
	getSecret: (cardId) => db.cardSecrets.get(cardId),
	putSecret: async (secret) => {
		await db.cardSecrets.put(secret);
	},
	deleteSecret: (cardId) => db.cardSecrets.delete(cardId),
	clearSecrets: () => db.cardSecrets.clear()
};
