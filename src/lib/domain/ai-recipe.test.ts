import { describe, it, expect } from 'vitest';
import {
	MAX_PRODUCTS,
	parseRecipeSuggestion,
	recipePrompt,
	shoppedProducts,
	type Purchase
} from './ai-recipe';

const achat = (name: string, checked: boolean, createdAt: number): Purchase => ({
	name,
	checked,
	createdAt
});

describe('shoppedProducts', () => {
	it('ne retient que les articles coches', () => {
		const produits = shoppedProducts([
			achat('Tomates', true, 3),
			achat('Whisky', false, 2),
			achat('Pates', true, 1)
		]);

		expect(produits).toEqual(['Tomates', 'Pates']);
	});

	it('rend le plus recent en premier', () => {
		const produits = shoppedProducts([achat('Vieux', true, 1), achat('Recent', true, 9)]);

		expect(produits).toEqual(['Recent', 'Vieux']);
	});

	it('ecarte le meme produit ecrit autrement', () => {
		const produits = shoppedProducts([
			achat('Tomates', true, 3),
			achat('tomates', true, 2),
			achat('TOMATES', true, 1)
		]);

		expect(produits).toEqual(['Tomates']);
	});

	it('ignore les noms vides', () => {
		expect(shoppedProducts([achat('   ', true, 1)])).toEqual([]);
	});

	it('plafonne le nombre de produits pour que la liste reste lisible avant l envoi', () => {
		const beaucoup = Array.from({ length: MAX_PRODUCTS + 20 }, (_, i) =>
			achat(`Produit ${i}`, true, i)
		);

		expect(shoppedProducts(beaucoup)).toHaveLength(MAX_PRODUCTS);
	});

	it('ne modifie pas le tableau qu on lui passe', () => {
		const achats = [achat('A', true, 1), achat('B', true, 2)];
		shoppedProducts(achats);

		expect(achats.map(a => a.name)).toEqual(['A', 'B']);
	});
});

describe('recipePrompt', () => {
	it('contient les produits et la langue demandee', () => {
		const prompt = recipePrompt(['Courgettes', 'Lardons'], { language: 'français', servings: 4 });

		expect(prompt).toContain('Courgettes, Lardons');
		expect(prompt).toContain('français');
		expect(prompt).toContain('4 personnes');
	});

	it('impose les unites que la base accepte', () => {
		const prompt = recipePrompt([], { language: 'français', servings: 4 });

		expect(prompt).toContain('piece');
		expect(prompt).toContain('kg');
	});

	it('ramene un nombre de parts absurde dans les bornes', () => {
		expect(recipePrompt([], { language: 'fr', servings: 0 })).toContain('1 personnes');
		expect(recipePrompt([], { language: 'fr', servings: 5000 })).toContain('99 personnes');
		expect(recipePrompt([], { language: 'fr', servings: Number.NaN })).toContain('4 personnes');
	});

	/**
	 * The screen shows this instruction before sending. If it contained anything other than the products
	 * passed in, what is shown and what leaves would stop being the same thing.
	 */
	it('ne contient rien d autre que ce qu on lui donne', () => {
		const prompt = recipePrompt(['Courgettes'], { language: 'français', servings: 4 });

		expect(prompt).not.toContain('Lardons');
	});
});

describe('parseRecipeSuggestion', () => {
	const valide = JSON.stringify({
		name: 'Gratin de courgettes',
		emoji: '🥒',
		servings: 4,
		ingredients: [
			{ name: 'Courgettes', qty: '800', unit: 'g' },
			{ name: 'Creme', qty: '20', unit: 'ml' }
		],
		steps: ['Couper les courgettes', 'Enfourner']
	});

	it('lit une reponse propre', () => {
		const recette = parseRecipeSuggestion(valide);

		expect(recette?.name).toBe('Gratin de courgettes');
		expect(recette?.emoji).toBe('🥒');
		expect(recette?.servings).toBe(4);
		expect(recette?.ingredients).toHaveLength(2);
		expect(recette?.steps).toEqual(['Couper les courgettes', 'Enfourner']);
	});

	it('trouve le json au milieu d un bavardage et d un bloc de code', () => {
		const recette = parseRecipeSuggestion(`Voici votre recette :\n\`\`\`json\n${valide}\n\`\`\`\nBon appetit !`);

		expect(recette?.name).toBe('Gratin de courgettes');
	});

	it('ramene une unite inventee sur celle par defaut', () => {
		const recette = parseRecipeSuggestion(
			JSON.stringify({
				name: 'Test',
				ingredients: [{ name: 'Sel', qty: '', unit: 'cuilleres a soupe' }]
			})
		);

		expect(recette?.ingredients[0].unit).toBe('piece');
	});

	it('reconnait une unite ecrite en toutes lettres', () => {
		const recette = parseRecipeSuggestion(
			JSON.stringify({ name: 'Test', ingredients: [{ name: 'Farine', qty: '250', unit: 'grammes' }] })
		);

		expect(recette?.ingredients[0].unit).toBe('g');
	});

	/** `recipes.servings` carries a `check (servings between 1 and 99)`: out of bounds, nothing is written. */
	it('ramene un nombre de parts hors bornes, qui ferait echouer l ecriture en base', () => {
		const parts = (servings: unknown) =>
			parseRecipeSuggestion(
				JSON.stringify({ name: 'Test', servings, ingredients: [{ name: 'Sel' }] })
			)?.servings;

		expect(parts(0)).toBe(1);
		expect(parts(-3)).toBe(1);
		expect(parts(5000)).toBe(99);
		expect(parts('beaucoup')).toBe(4);
		expect(parts(undefined)).toBe(4);
	});

	it('pose un emoji de repli et n en garde qu un seul caractere', () => {
		expect(
			parseRecipeSuggestion(JSON.stringify({ name: 'T', ingredients: [{ name: 'Sel' }] }))?.emoji
		).toBe('🍲');

		expect(
			parseRecipeSuggestion(
				JSON.stringify({ name: 'T', emoji: '🥒🍅', ingredients: [{ name: 'Sel' }] })
			)?.emoji
		).toBe('🥒');
	});

	it('ecarte les lignes sans nom', () => {
		const recette = parseRecipeSuggestion(
			JSON.stringify({ name: 'T', ingredients: [{ name: 'Sel' }, { name: '  ' }, {}] })
		);

		expect(recette?.ingredients).toHaveLength(1);
	});

	it('rend null sur tout ce qui n est pas exploitable', () => {
		expect(parseRecipeSuggestion('je ne peux pas repondre')).toBeNull();
		expect(parseRecipeSuggestion('{ pas du json }')).toBeNull();
		expect(parseRecipeSuggestion(JSON.stringify({ ingredients: [{ name: 'Sel' }] }))).toBeNull();
		expect(parseRecipeSuggestion(JSON.stringify({ name: 'T', ingredients: [] }))).toBeNull();
		expect(parseRecipeSuggestion('')).toBeNull();
	});

	it('donne toujours une etape, meme vide, pour que le formulaire ait sa rangee', () => {
		const recette = parseRecipeSuggestion(
			JSON.stringify({ name: 'T', ingredients: [{ name: 'Sel' }] })
		);

		expect(recette?.steps).toEqual(['']);
	});
});
