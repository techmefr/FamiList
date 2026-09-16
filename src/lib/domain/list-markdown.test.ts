import { describe, expect, it } from 'vitest';
import { listToMarkdown, type MarkdownItem, type MarkdownList } from './list-markdown';

const item = (over: Partial<MarkdownItem> = {}): MarkdownItem => ({
	name: 'Pommes',
	qty: '',
	unit: '',
	checked: false,
	priority: false,
	...over
});

const list = (over: Partial<MarkdownList> = {}): MarkdownList => ({
	name: 'Courses',
	emoji: '🛒',
	aisles: [{ name: 'Fruits et légumes', emoji: '🥕', items: [item()] }],
	...over
});

describe('listToMarkdown', () => {
	it('titre la liste avec son emoji et coiffe chaque rayon', () => {
		expect(listToMarkdown(list())).toBe('# 🛒 Courses\n\n## 🥕 Fruits et légumes\n- [ ] Pommes');
	});

	it('écrit la quantité et son unité après le nom', () => {
		const texte = listToMarkdown(
			list({
				aisles: [
					{ name: 'Fruits', emoji: '🥕', items: [item({ qty: '1', unit: 'kg' })] }
				]
			})
		);

		expect(texte).toContain('- [ ] Pommes — 1 kg');
	});

	it('tait une unité sans quantité, qui ne veut rien dire seule', () => {
		const texte = listToMarkdown(
			list({ aisles: [{ name: 'Fruits', emoji: '🥕', items: [item({ unit: 'kg' })] }] })
		);

		expect(texte).toContain('- [ ] Pommes');
		expect(texte).not.toContain('kg');
	});

	it('donne la quantité sans unité quand il n’y en a pas', () => {
		const texte = listToMarkdown(
			list({ aisles: [{ name: 'Fruits', emoji: '🥕', items: [item({ qty: '3' })] }] })
		);

		expect(texte).toContain('- [ ] Pommes — 3');
	});

	it('garde un article déjà pris, coché et barré', () => {
		const texte = listToMarkdown(
			list({ aisles: [{ name: 'Fruits', emoji: '🥕', items: [item({ checked: true })] }] })
		);

		expect(texte).toContain('- [x] ~~Pommes~~');
	});

	it('ne barre ni n’étoile deux fois un article pris et urgent', () => {
		const texte = listToMarkdown(
			list({
				aisles: [
					{ name: 'Fruits', emoji: '🥕', items: [item({ checked: true, priority: true })] }
				]
			})
		);

		expect(texte).toContain('- [x] ~~Pommes~~');
		expect(texte).not.toContain('⭐');
	});

	it('marque l’urgence d’une étoile', () => {
		const texte = listToMarkdown(
			list({ aisles: [{ name: 'Fruits', emoji: '🥕', items: [item({ priority: true })] }] })
		);

		expect(texte).toContain('- [ ] ⭐ Pommes');
	});

	it('met la note en italique, après la quantité', () => {
		const texte = listToMarkdown(
			list({
				aisles: [
					{
						name: 'Fruits',
						emoji: '🥕',
						items: [item({ qty: '1', unit: 'kg', note: 'bio si possible' })]
					}
				]
			})
		);

		expect(texte).toContain('- [ ] Pommes — 1 kg _(bio si possible)_');
	});

	it('ignore une note vide', () => {
		const texte = listToMarkdown(
			list({ aisles: [{ name: 'Fruits', emoji: '🥕', items: [item({ note: '  ' })] }] })
		);

		expect(texte).toBe('# 🛒 Courses\n\n## 🥕 Fruits\n- [ ] Pommes');
	});

	it('omet les rayons vides plutôt que de laisser un intitulé orphelin', () => {
		const texte = listToMarkdown(
			list({
				aisles: [
					{ name: 'Fruits', emoji: '🥕', items: [] },
					{ name: 'Épicerie', emoji: '🥫', items: [item({ name: 'Riz' })] }
				]
			})
		);

		expect(texte).toBe('# 🛒 Courses\n\n## 🥫 Épicerie\n- [ ] Riz');
	});

	it('rend une liste vide à son seul titre', () => {
		expect(listToMarkdown(list({ aisles: [] }))).toBe('# 🛒 Courses');
	});

	it('sépare les rayons d’une ligne vide et garde leur ordre', () => {
		const texte = listToMarkdown(
			list({
				aisles: [
					{ name: 'Fruits', emoji: '🥕', items: [item()] },
					{ name: 'Épicerie', emoji: '🥫', items: [item({ name: 'Riz' })] }
				]
			})
		);

		expect(texte).toBe(
			'# 🛒 Courses\n\n## 🥕 Fruits\n- [ ] Pommes\n\n## 🥫 Épicerie\n- [ ] Riz'
		);
	});

	it('ne laisse pas d’espace pendant quand un emoji manque', () => {
		const texte = listToMarkdown(
			list({ emoji: '', aisles: [{ name: 'Fruits', emoji: '', items: [item()] }] })
		);

		expect(texte).toBe('# Courses\n\n## Fruits\n- [ ] Pommes');
	});
});
