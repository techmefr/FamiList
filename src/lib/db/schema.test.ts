import { describe, expect, it } from 'vitest';
import { db } from './schema';

describe('rejections table', () => {
	it('indexes the refusal date the banner sorts on', () => {
		expect(Object.keys(db.rejections.schema.idxByName)).toContain('at');
	});
});
