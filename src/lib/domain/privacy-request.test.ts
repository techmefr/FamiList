import { describe, expect, it } from 'vitest';
import {
	PRIVACY_REQUEST_PATH,
	isValidEmail,
	readPrivacyRequestOutcome,
	validatePrivacyRequest,
	type PrivacyRequestDraft
} from './privacy-request';
import { isLegalRoute } from './legal';

const draft = (overrides: Partial<PrivacyRequestDraft> = {}): PrivacyRequestDraft => ({
	email: 'dana@example.test',
	kind: 'access',
	message: 'Please send me a copy of my data.',
	confirmed: true,
	...overrides
});

describe('validatePrivacyRequest', () => {
	it('accepts a complete request', () => {
		expect(validatePrivacyRequest(draft())).toBeNull();
	});

	it('refuses an invalid email address', () => {
		expect(validatePrivacyRequest(draft({ email: 'dana' }))).toBe('legal.request.errorEmail');
		expect(isValidEmail(' dana@example.test ')).toBe(true);
	});

	it('refuses an empty or oversized message', () => {
		expect(validatePrivacyRequest(draft({ message: '   ' }))).toBe('legal.request.errorMessage');
		expect(validatePrivacyRequest(draft({ message: 'x'.repeat(4001) }))).toBe('legal.request.errorMessage');
	});

	it('requires the identity confirmation', () => {
		expect(validatePrivacyRequest(draft({ confirmed: false }))).toBe('legal.request.errorConfirm');
	});
});

describe('readPrivacyRequestOutcome', () => {
	it('reads the answers of submit_privacy_request', () => {
		expect(readPrivacyRequestOutcome({ status: 'submitted', id: 'x' })).toBeNull();
		expect(readPrivacyRequestOutcome({ status: 'rate_limited' })).toBe('legal.request.errorTooMany');
		expect(readPrivacyRequestOutcome({ status: 'invalid' })).toBe('legal.request.errorMessage');
		expect(readPrivacyRequestOutcome(null)).toBe('legal.request.errorUnknown');
		expect(readPrivacyRequestOutcome({ status: 'other' })).toBe('legal.request.errorUnknown');
	});
});

describe('privacy request route', () => {
	it('is public', () => {
		expect(isLegalRoute(PRIVACY_REQUEST_PATH)).toBe(true);
	});
});
