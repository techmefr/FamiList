import { describe, it, expect } from 'vitest';
import {
	cleanImagePrompt,
	imagePromptRequest,
	MAX_IMAGE_PROMPT_LENGTH,
	MAX_PRODUCTS,
	parseRecipeSuggestion,
	recipeExtractionPrompt,
	recipeFollowUpPrompt,
	recipeFromPhotoPrompt,
	recipeFromRequestPrompt,
	recipePrompt,
	RECIPE_JSON_SHAPE,
	restrictionsOf,
	shoppedProducts,
	type Purchase
} from './ai-recipe';

const purchase = (name: string, checked: boolean, createdAt: number): Purchase => ({
	name,
	checked,
	createdAt
});

describe('shoppedProducts', () => {
	it('ne retient que les articles coches', () => {
		const products = shoppedProducts([
			purchase('Tomates', true, 3),
			purchase('Whisky', false, 2),
			purchase('Pates', true, 1)
		]);

		expect(products).toEqual(['Tomates', 'Pates']);
	});

	it('rend le plus recent en premier', () => {
		const products = shoppedProducts([purchase('Vieux', true, 1), purchase('Recent', true, 9)]);

		expect(products).toEqual(['Recent', 'Vieux']);
	});

	it('ecarte le meme produit ecrit autrement', () => {
		const products = shoppedProducts([
			purchase('Tomates', true, 3),
			purchase('tomates', true, 2),
			purchase('TOMATES', true, 1)
		]);

		expect(products).toEqual(['Tomates']);
	});

	it('ignore les noms vides', () => {
		expect(shoppedProducts([purchase('   ', true, 1)])).toEqual([]);
	});

	it('plafonne le nombre de produits pour que la liste reste lisible avant l envoi', () => {
		const many = Array.from({ length: MAX_PRODUCTS + 20 }, (_, i) =>
			purchase(`Produit ${i}`, true, i)
		);

		expect(shoppedProducts(many)).toHaveLength(MAX_PRODUCTS);
	});

	it('ne modifie pas le tableau qu on lui passe', () => {
		const purchases = [purchase('A', true, 1), purchase('B', true, 2)];
		shoppedProducts(purchases);

		expect(purchases.map(a => a.name)).toEqual(['A', 'B']);
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

	it('ajoute les restrictions alimentaires quand il y en a', () => {
		const prompt = recipePrompt(['Courgettes'], {
			language: 'français',
			servings: 4,
			restrictions: ['arachides', 'crustaces']
		});

		expect(prompt).toContain('Eviter absolument : arachides, crustaces');
	});

	it('n ajoute aucune instruction quand il n y a pas de restriction', () => {
		expect(recipePrompt(['Courgettes'], { language: 'français', servings: 4 })).not.toContain(
			'Eviter absolument'
		);
		expect(
			recipePrompt(['Courgettes'], { language: 'français', servings: 4, restrictions: [] })
		).not.toContain('Eviter absolument');
		expect(
			recipePrompt(['Courgettes'], {
				language: 'français',
				servings: 4,
				restrictions: ['  ', '']
			})
		).not.toContain('Eviter absolument');
	});
});

describe('restrictionsOf', () => {
	it('garde les notes non vides de toutes les personnes', () => {
		expect(
			restrictionsOf([{ dietaryNotes: 'Arachides' }, { dietaryNotes: '  ' }, { dietaryNotes: undefined }])
		).toEqual(['Arachides']);
	});

	it('rend un tableau vide quand personne n a de note', () => {
		expect(restrictionsOf([{ dietaryNotes: undefined }, {}])).toEqual([]);
	});
});

describe('recipeExtractionPrompt', () => {
	it('contient le texte de la page et la langue demandee', () => {
		const prompt = recipeExtractionPrompt('600 g de courgettes, enfourner 30 minutes', {
			language: 'français',
			servings: 4
		});

		expect(prompt).toContain('600 g de courgettes, enfourner 30 minutes');
		expect(prompt).toContain('français');
	});

	it('impose la meme forme JSON que recipePrompt', () => {
		const prompt = recipeExtractionPrompt('texte', { language: 'français', servings: 4 });

		expect(prompt).toContain(
			RECIPE_JSON_SHAPE
		);
	});

	it('ramene un nombre de parts absurde dans les bornes', () => {
		expect(recipeExtractionPrompt('texte', { language: 'fr', servings: 0 })).toContain('1 personnes');
		expect(recipeExtractionPrompt('texte', { language: 'fr', servings: 5000 })).toContain(
			'99 personnes'
		);
	});

	it('ajoute les restrictions alimentaires quand il y en a, sinon aucune instruction', () => {
		expect(
			recipeExtractionPrompt('texte', { language: 'fr', servings: 4, restrictions: ['gluten'] })
		).toContain('Eviter absolument : gluten');
		expect(recipeExtractionPrompt('texte', { language: 'fr', servings: 4 })).not.toContain(
			'Eviter absolument'
		);
	});
});

describe('recipeFromRequestPrompt', () => {
	it('contient la demande de la personne et la langue demandee', () => {
		const prompt = recipeFromRequestPrompt('un curry de poulet pour 4', {
			language: 'français',
			servings: 4
		});

		expect(prompt).toContain('un curry de poulet pour 4');
		expect(prompt).toContain('français');
	});

	it('impose la meme forme JSON que les autres invites', () => {
		const prompt = recipeFromRequestPrompt('des pancakes', { language: 'français', servings: 4 });

		expect(prompt).toContain(
			RECIPE_JSON_SHAPE
		);
	});

	it('ramene un nombre de parts absurde dans les bornes', () => {
		expect(recipeFromRequestPrompt('texte', { language: 'fr', servings: 0 })).toContain(
			'1 personnes'
		);
		expect(recipeFromRequestPrompt('texte', { language: 'fr', servings: 5000 })).toContain(
			'99 personnes'
		);
	});

	it('ne contient rien d autre que ce qu on lui donne', () => {
		const prompt = recipeFromRequestPrompt('un curry de poulet', {
			language: 'français',
			servings: 4
		});

		expect(prompt).not.toContain('Lardons');
	});

	it('ajoute les restrictions alimentaires quand il y en a, sinon aucune instruction', () => {
		expect(
			recipeFromRequestPrompt('texte', { language: 'fr', servings: 4, restrictions: ['lactose'] })
		).toContain('Eviter absolument : lactose');
		expect(recipeFromRequestPrompt('texte', { language: 'fr', servings: 4 })).not.toContain(
			'Eviter absolument'
		);
	});
});

describe('recipeFollowUpPrompt (#226)', () => {
	it('contient le message de suivi et la langue demandee', () => {
		const prompt = recipeFollowUpPrompt('et si je remplace le poulet par du tofu ?', {
			language: 'français',
			servings: 4
		});

		expect(prompt).toContain('et si je remplace le poulet par du tofu ?');
		expect(prompt).toContain('français');
	});

	it('exige de nouveau la recette complete au meme format JSON', () => {
		const prompt = recipeFollowUpPrompt('plus epice', { language: 'français', servings: 4 });

		expect(prompt).toContain(
			RECIPE_JSON_SHAPE
		);
	});

	it('ramene un nombre de parts absurde dans les bornes', () => {
		expect(recipeFollowUpPrompt('texte', { language: 'fr', servings: 0 })).toContain('1 personnes');
		expect(recipeFollowUpPrompt('texte', { language: 'fr', servings: 5000 })).toContain(
			'99 personnes'
		);
	});
});

describe('parseRecipeSuggestion', () => {
	const validPayload = JSON.stringify({
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
		const recipe = parseRecipeSuggestion(validPayload);

		expect(recipe?.name).toBe('Gratin de courgettes');
		expect(recipe?.emoji).toBe('🥒');
		expect(recipe?.servings).toBe(4);
		expect(recipe?.ingredients).toHaveLength(2);
		expect(recipe?.steps).toEqual(['Couper les courgettes', 'Enfourner']);
	});

	it('trouve le json au milieu d un bavardage et d un bloc de code', () => {
		const recipe = parseRecipeSuggestion(`Voici votre recette :\n\`\`\`json\n${validPayload}\n\`\`\`\nBon appetit !`);

		expect(recipe?.name).toBe('Gratin de courgettes');
	});

	it('ramene une unite inventee sur celle par defaut', () => {
		const recipe = parseRecipeSuggestion(
			JSON.stringify({
				name: 'Test',
				ingredients: [{ name: 'Sel', qty: '', unit: 'cuilleres a soupe' }]
			})
		);

		expect(recipe?.ingredients[0].unit).toBe('piece');
	});

	it('reconnait une unite ecrite en toutes lettres', () => {
		const recipe = parseRecipeSuggestion(
			JSON.stringify({ name: 'Test', ingredients: [{ name: 'Farine', qty: '250', unit: 'grammes' }] })
		);

		expect(recipe?.ingredients[0].unit).toBe('g');
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
		const recipe = parseRecipeSuggestion(
			JSON.stringify({ name: 'T', ingredients: [{ name: 'Sel' }, { name: '  ' }, {}] })
		);

		expect(recipe?.ingredients).toHaveLength(1);
	});

	it('rend null sur tout ce qui n est pas exploitable', () => {
		expect(parseRecipeSuggestion('je ne peux pas repondre')).toBeNull();
		expect(parseRecipeSuggestion('{ pas du json }')).toBeNull();
		expect(parseRecipeSuggestion(JSON.stringify({ ingredients: [{ name: 'Sel' }] }))).toBeNull();
		expect(parseRecipeSuggestion(JSON.stringify({ name: 'T', ingredients: [] }))).toBeNull();
		expect(parseRecipeSuggestion('')).toBeNull();
	});

	it('donne toujours une etape, meme vide, pour que le formulaire ait sa rangee', () => {
		const recipe = parseRecipeSuggestion(
			JSON.stringify({ name: 'T', ingredients: [{ name: 'Sel' }] })
		);

		expect(recipe?.steps).toEqual(['']);
	});
});

describe('recipeFromPhotoPrompt (#266)', () => {
	it('demande de lire la photo et repond dans la langue demandee', () => {
		const prompt = recipeFromPhotoPrompt({ language: 'italien', servings: 4 });

		expect(prompt).toContain('italien');
		expect(prompt).toContain('photo');
	});

	it('reprend le nombre de personnes demande quand la photo n en precise pas', () => {
		const prompt = recipeFromPhotoPrompt({ language: 'français', servings: 6 });

		expect(prompt).toContain('6 personnes');
	});

	it('ajoute la ligne des restrictions alimentaires, comme les autres prompts', () => {
		const prompt = recipeFromPhotoPrompt({
			language: 'français',
			servings: 4,
			restrictions: ['arachides']
		});

		expect(prompt).toContain('arachides');
	});

	it('demande le meme objet JSON que les autres prompts, pour reutiliser le meme parseur', () => {
		const prompt = recipeFromPhotoPrompt({ language: 'français', servings: 4 });

		expect(prompt).toContain(
			RECIPE_JSON_SHAPE
		);
	});
});

describe('stepIngredients (#308)', () => {
	it('lit les liens renvoyes, recales sur les lignes gardees', () => {
		const recipe = parseRecipeSuggestion(
			JSON.stringify({
				name: 'Omelette',
				ingredients: [{ name: 'Oeufs' }, { name: '' }, { name: 'Beurre' }],
				steps: ['Battre les oeufs', '', 'Cuire au beurre'],
				stepIngredients: [[0], [], [2, 9]]
			})
		);

		expect(recipe?.steps).toEqual(['Battre les oeufs', 'Cuire au beurre']);
		expect(recipe?.stepIngredients).toEqual([[0], [1]]);
	});

	it('devine les liens quand le modele les oublie', () => {
		const recipe = parseRecipeSuggestion(
			JSON.stringify({
				name: 'Omelette',
				ingredients: [{ name: 'Oeufs' }, { name: 'Beurre' }],
				steps: ['Battre les oeufs', 'Cuire au beurre']
			})
		);

		expect(recipe?.stepIngredients).toEqual([[0], [1]]);
	});

	it('est demande par chaque prompt', () => {
		expect(recipePrompt(['Oeufs'], { language: 'français', servings: 2 })).toContain('"stepIngredients" contient');
	});
});

describe('imagePrompt (#306)', () => {
	it('est demande par chaque prompt de recette, en anglais', () => {
		const options = { language: 'français', servings: 4 };
		const prompts = [
			recipePrompt(['Courgettes'], options),
			recipeExtractionPrompt('texte', options),
			recipeFromRequestPrompt('un curry', options),
			recipeFollowUpPrompt('plus epice', options),
			recipeFromPhotoPrompt(options)
		];

		for (const prompt of prompts) {
			expect(prompt).toContain('"imagePrompt":""');
			expect(prompt).toContain('"imagePrompt" decrit en anglais');
		}
	});

	it('est lu avec la recette', () => {
		const recipe = parseRecipeSuggestion(
			'{"name":"Nems","ingredients":[{"name":"porc"}],"imagePrompt":"Golden fried spring rolls on lettuce leaves"}'
		);
		expect(recipe?.imagePrompt).toBe('Golden fried spring rolls on lettuce leaves');
	});

	it('reste absent quand le modele ne le donne pas', () => {
		const recipe = parseRecipeSuggestion('{"name":"Nems","ingredients":[{"name":"porc"}]}');
		expect(recipe?.imagePrompt).toBeUndefined();
	});
});

describe('imagePromptRequest (#306)', () => {
	it('decrit le plat a partir de son nom, de ses ingredients et de ses etapes', () => {
		const prompt = imagePromptRequest('Quiche lorraine', ['lardons', '', 'oeufs'], ['Cuire 35 minutes']);

		expect(prompt).toContain('Dish: Quiche lorraine');
		expect(prompt).toContain('Ingredients: lardons, oeufs');
		expect(prompt).toContain('Method: Cuire 35 minutes');
	});

	it('omet les lignes vides', () => {
		const prompt = imagePromptRequest('Salade', [], []);
		expect(prompt).not.toContain('Ingredients:');
		expect(prompt).not.toContain('Method:');
	});
});

describe('cleanImagePrompt (#306)', () => {
	it('retire guillemets, etiquette et espaces en trop', () => {
		expect(cleanImagePrompt('Description: "A creamy   tiramisu in a glass dish."\n')).toBe(
			'A creamy tiramisu in a glass dish.'
		);
	});

	it('coupe une reponse trop longue et refuse une reponse vide', () => {
		expect(cleanImagePrompt('a'.repeat(2000))?.length).toBe(MAX_IMAGE_PROMPT_LENGTH);
		expect(cleanImagePrompt('  ""  ')).toBeNull();
	});
});
