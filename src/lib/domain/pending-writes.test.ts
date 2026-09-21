import { describe, expect, it } from 'vitest';
import { PendingWrites } from './pending-writes';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PendingWrites', () => {
	it('starts at zero', () => {
		expect(new PendingWrites().count).toBe(0);
	});

	it('counts a write in flight, then drops back to zero once it settles', async () => {
		const pending = new PendingWrites();
		const write = pending.track(settle());

		expect(pending.count).toBe(1);
		await write;
		expect(pending.count).toBe(0);
	});

	it('decrements even when the write rejects', async () => {
		const pending = new PendingWrites();
		const write = pending.track(Promise.reject(new Error('dexie write failed')));

		expect(pending.count).toBe(1);
		await expect(write).rejects.toThrow('dexie write failed');
		expect(pending.count).toBe(0);
	});

	it('tracks several overlapping writes independently', async () => {
		const pending = new PendingWrites();
		const first = pending.track(settle());
		const second = pending.track(settle());

		expect(pending.count).toBe(2);
		await first;
		expect(pending.count).toBe(1);
		await second;
		expect(pending.count).toBe(0);
	});

	it('reflects a card surviving a hydrate-shaped read while its write is still in flight', async () => {
		const pending = new PendingWrites();
		let dexieCards: string[] = [];
		let cachedCards: string[] = ['existing'];

		const delayedWrite = new Promise<void>((resolve) =>
			setTimeout(() => {
				dexieCards = [...dexieCards, 'new-card'];
				resolve();
			}, 5)
		);
		const write = pending.track(delayedWrite);

		// Optimistic update, as addCard does before the Dexie write settles.
		cachedCards = [...cachedCards, 'new-card'];

		// A hydrate cycle races in before the write lands.
		const readFromDexie = [...dexieCards];
		if (pending.count === 0) cachedCards = readFromDexie;

		expect(cachedCards).toContain('new-card');

		await write;
	});
});
