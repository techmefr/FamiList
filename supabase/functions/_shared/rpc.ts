/**
 * L appel d une fonction de la base depuis une fonction edge.
 *
 * Ecrit une fois ici parce que trois fonctions l avaient recopie, et que le detail qui compte — une
 * fonction `returns void` repond 204 sans corps, et `response.json()` echoue dessus — se perd a la
 * troisieme copie. L echec tomberait alors apres l envoi du courriel, en relachant des lignes deja
 * parties.
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

/** La cle de service, celle qui ouvre les fonctions reservees a `service_role`. */
export function serviceKey(): string {
	return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
