/** The brand's website as typed, or `null` when it is not a plain http(s) address — never a `javascript:` link. */
export const safeWebsiteUrl = (input: string | null | undefined): string | null => {
	const typed = (input ?? '').trim();
	if (!typed) return null;

	const candidate = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;

	try {
		const url = new URL(candidate);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		if (!url.hostname.includes('.') || /\s/.test(typed)) return null;
		return url.href;
	} catch {
		return null;
	}
};
