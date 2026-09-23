import { describe, it, expect } from 'vitest';
import {
	appendTranscript,
	bcp47LocaleOf,
	isSpeechRecognitionSupported,
	normalizeTranscript,
	speechRecognitionCtor
} from './speech-dictation';

describe('isSpeechRecognitionSupported', () => {
	it('est vrai quand le constructeur non prefixe existe', () => {
		expect(isSpeechRecognitionSupported({ SpeechRecognition: function () {} })).toBe(true);
	});

	it('est vrai quand seul le constructeur webkit existe', () => {
		expect(isSpeechRecognitionSupported({ webkitSpeechRecognition: function () {} })).toBe(true);
	});

	it('est faux sans aucun des deux', () => {
		expect(isSpeechRecognitionSupported({})).toBe(false);
	});

	it('est faux sans objet global', () => {
		expect(isSpeechRecognitionSupported(undefined)).toBe(false);
	});
});

describe('speechRecognitionCtor', () => {
	it('prefere le constructeur non prefixe quand les deux existent', () => {
		const standard = function () {};
		const webkit = function () {};

		expect(speechRecognitionCtor({ SpeechRecognition: standard, webkitSpeechRecognition: webkit })).toBe(
			standard
		);
	});

	it('retombe sur le constructeur webkit seul', () => {
		const webkit = function () {};

		expect(speechRecognitionCtor({ webkitSpeechRecognition: webkit })).toBe(webkit);
	});

	it('rend undefined sans constructeur utilisable', () => {
		expect(speechRecognitionCtor({ SpeechRecognition: 'nope' })).toBeUndefined();
	});
});

describe('bcp47LocaleOf', () => {
	it('rend un tag region pour chaque locale connue', () => {
		expect(bcp47LocaleOf('fr')).toBe('fr-FR');
		expect(bcp47LocaleOf('en')).toBe('en-US');
		expect(bcp47LocaleOf('zh')).toBe('zh-CN');
	});

	it('rend le code tel quel pour le malgache, non couvert par les navigateurs', () => {
		expect(bcp47LocaleOf('mg')).toBe('mg');
	});
});

describe('normalizeTranscript', () => {
	it('coupe les espaces de bord et compresse les espaces internes', () => {
		expect(normalizeTranscript('  un curry   de poulet  ')).toBe('un curry de poulet');
	});

	it('rend une chaine vide pour un texte vide', () => {
		expect(normalizeTranscript('   ')).toBe('');
	});
});

describe('appendTranscript', () => {
	it('remplit un champ vide avec la transcription', () => {
		expect(appendTranscript('', 'un curry de poulet')).toBe('un curry de poulet');
	});

	it('ajoute la transcription apres le texte deja present', () => {
		expect(appendTranscript('pour 4 personnes', 'un curry de poulet')).toBe(
			'pour 4 personnes un curry de poulet'
		);
	});

	it('ne touche pas au texte existant quand la transcription est vide', () => {
		expect(appendTranscript('pour 4 personnes', '   ')).toBe('pour 4 personnes');
	});

	it('ignore les espaces de fin deja presents avant de concatener', () => {
		expect(appendTranscript('pour 4 personnes   ', 'un curry')).toBe('pour 4 personnes un curry');
	});
});
