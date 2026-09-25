import { describe, expect, it } from 'vitest';
import { NATIVE_OCR_LANGUAGES, OCR_LANGUAGES, ocrLanguagesFor } from './ocr-languages';

describe('ocrLanguagesFor', () => {
	it('charge la langue de l application, puis l anglais', () => {
		expect(ocrLanguagesFor('fr')).toEqual(['fra', 'eng']);
		expect(ocrLanguagesFor('ru')).toEqual(['rus', 'eng']);
		expect(ocrLanguagesFor('zh')).toEqual(['chi_sim', 'eng']);
	});

	it('ne charge l anglais qu une fois', () => {
		expect(ocrLanguagesFor('en')).toEqual(['eng']);
	});

	it('lit le malgache avec le modèle français', () => {
		expect(ocrLanguagesFor('mg')).toEqual(['fra', 'eng']);
	});

	it('se rabat sur l anglais pour une langue inconnue, et accepte une région', () => {
		expect(ocrLanguagesFor('xx')).toEqual(['eng']);
		expect(ocrLanguagesFor('pt-BR')).toEqual(['por', 'eng']);
	});

	it('dans l application installée, garde seulement les modèles embarqués', () => {
		expect(ocrLanguagesFor('fr', NATIVE_OCR_LANGUAGES)).toEqual(['fra', 'eng']);
		expect(ocrLanguagesFor('ar', NATIVE_OCR_LANGUAGES)).toEqual(['eng']);
		expect(ocrLanguagesFor('ar', [])).toEqual(['eng']);
	});

	it('couvre les dix langues de l application', () => {
		expect(Object.keys(OCR_LANGUAGES).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'mg', 'pt', 'ru', 'zh']);
	});
});
