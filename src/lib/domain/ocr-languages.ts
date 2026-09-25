/**
 * Which Tesseract models read a recipe photographed by someone using the app in a given language (#312).
 *
 * English is always added: cookbooks, packaging and measures ("cup", "tbsp") mix it in everywhere, and its
 * model reads any Latin text passably. Malagasy has no Tesseract model: books in Madagascar are mostly in
 * French or in Malagasy, which the French model reads well enough, being the same alphabet.
 */
export const OCR_LANGUAGES: Record<string, string> = {
	fr: 'fra',
	en: 'eng',
	es: 'spa',
	de: 'deu',
	it: 'ita',
	pt: 'por',
	ru: 'rus',
	ar: 'ara',
	zh: 'chi_sim',
	mg: 'fra'
};

/** The only models shipped inside the installed app; keep in step with `scripts/ocr-assets.mjs`. */
export const NATIVE_OCR_LANGUAGES: readonly string[] = ['fra', 'eng'];

const FALLBACK = 'eng';

/**
 * The models to load, the app language's first. `available` restricts them to those actually shipped (the
 * installed app): a model that is not there would fail the whole reading, English alone still reads.
 */
export function ocrLanguagesFor(locale: string, available?: readonly string[]): string[] {
	const primary = OCR_LANGUAGES[locale.toLowerCase().split('-')[0]] ?? FALLBACK;
	const wanted = [...new Set([primary, FALLBACK])];
	const usable = available ? wanted.filter((language) => available.includes(language)) : wanted;

	return usable.length ? usable : [FALLBACK];
}
