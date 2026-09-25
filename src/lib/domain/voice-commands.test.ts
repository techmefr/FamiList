import { describe, expect, it } from 'vitest';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import itLocale from '../i18n/locales/it.json';
import pt from '../i18n/locales/pt.json';
import ru from '../i18n/locales/ru.json';
import ar from '../i18n/locales/ar.json';
import zh from '../i18n/locales/zh.json';
import mg from '../i18n/locales/mg.json';
import {
	VOICE_COMMANDS,
	afterWakeWord,
	hear,
	matchCommand,
	normalizeSpeech,
	stepVolume,
	type VoiceVocabulary
} from './voice-commands';

const LOCALES = { fr, en, de, es, it: itLocale, pt, ru, ar, zh, mg };

function vocabularyOf(locale: typeof fr): VoiceVocabulary {
	const voice = locale.recipes.cookAlong.voice;
	return { wake: voice.wake, commands: voice.commands };
}

const french = vocabularyOf(fr);

describe('normalizeSpeech', () => {
	it('ignore la casse, les accents et la ponctuation', () => {
		expect(normalizeSpeech('  Étape SUIVANTE !')).toBe('etape suivante');
		expect(normalizeSpeech("Famy, lis l'étape.")).toBe('famy lis l etape');
	});
});

describe('afterWakeWord', () => {
	it('rend ce qui suit le dernier « Famy »', () => {
		expect(afterWakeWord('Fami, suivant', french.wake)).toBe('suivant');
		expect(afterWakeWord('bon alors famie répète', french.wake)).toBe('repete');
	});

	it('ne réagit pas sans le mot d éveil, ni à un mot qui le contient', () => {
		expect(afterWakeWord('suivant', french.wake)).toBeNull();
		expect(afterWakeWord('la famille arrive', french.wake)).toBeNull();
	});
});

describe('matchCommand', () => {
	it('comprend les synonymes', () => {
		for (const phrase of ['suivant', 'étape suivante', 'après', 'on continue']) {
			expect(matchCommand(phrase, french.commands), phrase).toBe('next');
		}
	});

	it('préfère la phrase la plus longue', () => {
		expect(matchCommand('lis les ingrédients', french.commands)).toBe('stepIngredients');
		expect(matchCommand('lis tous les ingrédients', french.commands)).toBe('allIngredients');
		expect(matchCommand('coupe la voix', french.commands)).toBe('mute');
		expect(matchCommand('remets la voix', french.commands)).toBe('unmute');
	});

	it('ne devine rien quand rien ne correspond', () => {
		expect(matchCommand('quelle heure est-il', french.commands)).toBeNull();
	});
});

describe('hear', () => {
	it('lit une commande précédée du mot d éveil', () => {
		expect(hear(['Famy suivant'], french)).toEqual({ kind: 'command', command: 'next' });
	});

	it('essaie chaque proposition du moteur', () => {
		expect(hear(['fa mi suivant', 'Fami suivant'], french)).toEqual({ kind: 'command', command: 'next' });
	});

	it('attend la commande après « Famy » seul', () => {
		expect(hear(['Famy'], french)).toEqual({ kind: 'wake' });
		expect(hear(['précédent'], french, true)).toEqual({ kind: 'command', command: 'previous' });
		expect(hear(['précédent'], french, false)).toBeNull();
	});

	it('signale une demande adressée à Famy mais inconnue', () => {
		expect(hear(['Famy fais-moi un café'], french)).toEqual({ kind: 'unknown', text: 'fais moi un cafe' });
	});

	it('ignore la conversation autour', () => {
		expect(hear(['passe-moi le sel'], french)).toBeNull();
	});
});

describe('stepVolume', () => {
	it('monte et descend par quarts, sans jamais atteindre le silence', () => {
		expect(stepVolume(1, 'up')).toBe(1);
		expect(stepVolume(1, 'down')).toBe(0.75);
		expect(stepVolume(0.25, 'down')).toBe(0.25);
		expect(stepVolume(0.5, 'up')).toBe(0.75);
	});
});

describe('vocabulaire des 10 langues', () => {
	for (const [code, locale] of Object.entries(LOCALES)) {
		it(`${code} : mot d éveil et chaque commande définis, sans phrase partagée entre deux commandes`, () => {
			const vocabulary = vocabularyOf(locale as typeof fr);
			expect(vocabulary.wake.length).toBeGreaterThan(0);

			const seen = new Map<string, string>();
			for (const command of VOICE_COMMANDS) {
				const phrases = vocabulary.commands[command];
				expect(phrases?.length, `${code}.${command}`).toBeGreaterThan(0);
				expect(locale.recipes.cookAlong.voice.labels[command], `${code} label ${command}`).toBeTruthy();

				for (const phrase of phrases) {
					const key = normalizeSpeech(phrase);
					expect(seen.get(key), `${code}: « ${phrase} » in ${command} and ${seen.get(key)}`).toBeUndefined();
					seen.set(key, command);
				}
			}

			for (const command of VOICE_COMMANDS) {
				const first = vocabulary.commands[command][0];
				expect(hear([`${vocabulary.wake[0]} ${first}`], vocabulary), `${code}: ${first}`).toEqual({
					kind: 'command',
					command
				});
			}
		});
	}
});
