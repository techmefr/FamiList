/**
 * Calling a database function from an edge function.
 *
 * Written once here because three functions had copied it, and because the detail that matters — a `returns
 * void` function answers 204 with no body, and `response.json()` fails on it — gets lost by the third copy.
 * The failure would then come after the email was sent, releasing rows that had already left.
 */
export async function callRpc<T>(
	name: string,
	args: Record<string, unknown>,
	token: string
): Promise<T> {
	const url = Deno.env.get('SUPABASE_URL') ?? '';

	const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? token,
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(args)
	});

	if (!response.ok) {
		throw new Error(`${name}: ${response.status} ${await response.text()}`);
	}

	const body = await response.text();

	return (body === '' ? null : JSON.parse(body)) as T;
}

/** The service key, the one that opens the functions reserved for `service_role`. */
export function serviceKey(): string {
	return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
