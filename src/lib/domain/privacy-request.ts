export const PRIVACY_REQUEST_KINDS = [
	'access',
	'rectification',
	'erasure',
	'portability',
	'objection',
	'restriction',
	'other'
] as const;

export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export const PRIVACY_REQUEST_PATH = '/legal/privacy-request';

export const PRIVACY_MESSAGE_MAX = 4000;

export type PrivacyRequestErrorKey =
	| 'legal.request.errorEmail'
	| 'legal.request.errorMessage'
	| 'legal.request.errorConfirm'
	| 'legal.request.errorTooMany'
	| 'legal.request.errorUnknown';

export interface PrivacyRequestDraft {
	email: string;
	kind: PrivacyRequestKind;
	message: string;
	confirmed: boolean;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(email: string): boolean {
	const value = email.trim();

	return value.length <= 320 && EMAIL_PATTERN.test(value);
}

export function validatePrivacyRequest(draft: PrivacyRequestDraft): PrivacyRequestErrorKey | null {
	if (!isValidEmail(draft.email)) return 'legal.request.errorEmail';

	const message = draft.message.trim();
	if (message.length < 1 || message.length > PRIVACY_MESSAGE_MAX) return 'legal.request.errorMessage';

	if (!draft.confirmed) return 'legal.request.errorConfirm';

	return null;
}

export function readPrivacyRequestOutcome(payload: unknown): PrivacyRequestErrorKey | null {
	if (payload === null || typeof payload !== 'object') return 'legal.request.errorUnknown';

	const status = (payload as { status?: unknown }).status;

	if (status === 'submitted') return null;
	if (status === 'rate_limited') return 'legal.request.errorTooMany';
	if (status === 'invalid') return 'legal.request.errorMessage';

	return 'legal.request.errorUnknown';
}
