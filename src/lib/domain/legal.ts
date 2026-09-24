import { LEGAL_FR } from './legal-texts-fr';
import { LEGAL_EN } from './legal-texts-en';
import { PRIVACY_REQUEST_PATH } from './privacy-request';

export const LEGAL_DOCUMENTS = ['notice', 'terms', 'privacy', 'sales'] as const;

export type LegalDocumentId = (typeof LEGAL_DOCUMENTS)[number];

export type LegalLanguage = 'fr' | 'en';

export interface LegalSection {
	heading: string;
	paragraphs?: string[];
	items?: string[];
	link?: { label: string; href: string };
}

export interface LegalText {
	title: string;
	updated: string;
	sections: LegalSection[];
}

export const LEGAL_ROUTE_PREFIX = '/legal';

export function legalPath(id: LegalDocumentId): string {
	return `${LEGAL_ROUTE_PREFIX}/${id}`;
}

export function isLegalRoute(pathname: string): boolean {
	return pathname === PRIVACY_REQUEST_PATH || LEGAL_DOCUMENTS.some((id) => pathname === legalPath(id));
}

export function legalLanguage(locale: string): LegalLanguage {
	return locale === 'fr' ? 'fr' : 'en';
}

export function legalText(id: LegalDocumentId, locale: string): LegalText {
	return legalLanguage(locale) === 'fr' ? LEGAL_FR[id] : LEGAL_EN[id];
}

export const PLACEHOLDER_PATTERN = /(\[TO CONFIRM:[^\]]*\])/;

export function splitPlaceholders(text: string): { text: string; placeholder: boolean }[] {
	return text
		.split(PLACEHOLDER_PATTERN)
		.filter((part) => part !== '')
		.map((part) => ({
			text: part,
			placeholder: PLACEHOLDER_PATTERN.test(part)
		}));
}
