import { describe, expect, it } from 'vitest';
import { movedTooFar, LONGPRESS_TOLERANCE } from './longpress';

describe('movedTooFar', () => {
	const depart = { x: 100, y: 100 };

	it('tolère le tremblement d un doigt posé', () => {
		expect(movedTooFar(depart, { x: 104, y: 96 })).toBe(false);
	});

	it('refuse un défilement vertical', () => {
		expect(movedTooFar(depart, { x: 100, y: 140 })).toBe(true);
	});

	it('refuse un glissement horizontal', () => {
		expect(movedTooFar(depart, { x: 60, y: 100 })).toBe(true);
	});

	it('accepte exactement la tolérance, et refuse un pixel de plus', () => {
		expect(movedTooFar(depart, { x: 100 + LONGPRESS_TOLERANCE, y: 100 })).toBe(false);
		expect(movedTooFar(depart, { x: 100 + LONGPRESS_TOLERANCE + 1, y: 100 })).toBe(true);
	});
});
