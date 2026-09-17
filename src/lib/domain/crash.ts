/**
 * What we keep from a crash before sending it, and what we strip out of it.
 *
 * A stack trace is not neutral technical data. It crosses URLs carrying household ids, error messages
 * where Postgres copied back the value that violated a constraint, file paths starting with the person's
 * first name. The scrubbing below happens before anything is sent.
 *
 * What it cannot do, and it is better written down than left to be assumed: the free text of an `Error`
 * stays free text. If a library writes "cannot delete Granny's picnic", no regular expression will tell
 * that name from a technical word. So we cut it short — five hundred characters — and the database keeps
 * these rows for thirty days, no more.
 */

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4000;

/** Where the crash comes from. The same four values as the `client_errors.source` constraint. */
export type CrashSource = 'window' | 'promise' | 'render' | 'sync';

export interface Crash {
	fingerprint: string;
	source: CrashSource;
	message: string;
	stack: string;
	path: string;
}

/**
 * The replacements, in this order.
 *
 * The order is not decorative: an email address contains a dot and letters that would otherwise be eaten
 * by the long-token pattern, and a data URL starts with characters the UUID pattern would no longer
 * recognise once truncated.
 */
const REPLACEMENTS: Array<[RegExp, string]> = [
	[/\bdata:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, '{data}'],
	[/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '{token}'],
	[/[\w.+-]+@[\w-]+\.[\w.-]+/g, '{email}'],
	[/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}'],
	// An absolute development or device path starts with the system account name.
	[/\/(?:home|Users)\/[^/\s)'"]+/g, '/home/{user}'],
	// The query string is only removed if it really carries a key=value pair: otherwise the question mark
	// of a sentence would take the end of the message with it.
	[/\?[\w[\]%.+-]+=[^\s)'"]*/g, '?{query}'],
	[/\b[A-Za-z0-9_-]{32,}\b/g, '{token}'],
	// Six digits and more: an id, a timestamp, a number. Below that, they are the line and column numbers
	// of the stack, and erasing them would make the stack useless.
	[/\d{6,}/g, '{n}']
];

export function scrub(text: string): string {
	return REPLACEMENTS.reduce((said, [pattern, token]) => said.replace(pattern, token), text);
}

/**
 * The screen the crash comes from, reduced to its route.
 *
 * `/l/7f3a-…` becomes `/l/{id}`: the segment is a list id, and keeping it would say which list it is
 * without teaching anything about the bug — two people crashing on two different lists crash at the same
 * place in the code.
 */
export function normalizePath(path: string): string {
	const withoutQuery = path.split('?')[0].split('#')[0];

	return scrub(withoutQuery.replace(/^\/l\/[^/]+/, '/l/{id}'));
}

/**
 * The readable message of any cause.
 *
 * Same problem as in the sync: what is thrown is not always an `Error`. `describeError` already answers
 * that question for the banner, but it lives in `sync/` and does not know the error's name; here we
 * prefix with the name (`TypeError: …`), which is what groups two identical crashes best.
 */
function readMessage(cause: unknown): string {
	if (cause instanceof Error) {
		const body = cause.message || cause.name;
		return cause.message && cause.name ? `${cause.name}: ${cause.message}` : body;
	}

	if (typeof cause === 'string') return cause;

	if (cause && typeof cause === 'object' && 'message' in cause) {
		const message = (cause as { message: unknown }).message;
		if (typeof message === 'string' && message) return message;
	}

	return '';
}

function readStack(cause: unknown): string {
	if (cause instanceof Error && typeof cause.stack === 'string') return cause.stack;

	if (cause && typeof cause === 'object' && 'stack' in cause) {
		const stack = (cause as { stack: unknown }).stack;
		if (typeof stack === 'string') return stack;
	}

	return '';
}

/**
 * The hash used as a fingerprint: FNV-1a on 32 bits, rendered in hexadecimal.
 *
 * Deliberately not `crypto.subtle`: that one is asynchronous, and the reporter must be able to work from
 * a synchronous event handler without delaying anything. This is not about hiding anything — the
 * fingerprint only has to group two identical crashes.
 */
function hash(text: string): string {
	let value = 0x811c9dc5;

	for (let index = 0; index < text.length; index += 1) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 0x01000193) >>> 0;
	}

	return value.toString(16).padStart(8, '0');
}

/**
 * The first frame of the stack, without line or column numbers.
 *
 * The numbers move on every build: keeping them in the fingerprint would make the same bug look new on
 * every deployment, and the occurrence counter would count nothing any more.
 */
function topFrame(stack: string): string {
	const frame = stack.split('\n').find((line) => line.includes('at ') || line.includes('@'));

	return frame ? frame.trim().replace(/:\d+:\d+/g, '') : '';
}

export function fingerprint(source: CrashSource, message: string, stack: string): string {
	const normalized = message.toLowerCase().replace(/\d+/g, '');

	return hash(`${source}|${normalized}|${topFrame(stack)}`);
}

/**
 * Everything above, put end to end.
 *
 * Returns `null` when there is nothing to say: a cause with no message and no stack would only send an
 * empty row to the admin screen, and an empty row takes the same space as a useful one while teaching
 * nothing.
 */
export function buildCrash(cause: unknown, source: CrashSource, path: string): Crash | null {
	const message = scrub(readMessage(cause)).trim().slice(0, MESSAGE_LIMIT);
	const stack = scrub(readStack(cause)).slice(0, STACK_LIMIT);

	if (!message) return null;

	return {
		fingerprint: fingerprint(source, message, stack),
		source,
		message,
		stack,
		path: normalizePath(path)
	};
}
