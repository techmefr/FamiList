import { supabase } from '$db/supabase';
import {
	buildRequest,
	DEFAULT_PROVIDER,
	isProvider,
	parseError,
	parseReply,
	providerById
} from '$domain/ai';
import { parseRecipeSuggestion, type SuggestedRecipe } from '$domain/ai-recipe';

/**
 * Les trois issues d'une demande, distinguees parce qu'elles appellent trois gestes differents :
 * un echec reseau se reessaie, un refus du fournisseur se lit et se corrige sur son compte a lui,
 * une reponse illisible se redemande.
 */
export type SuggestOutcome =
	| { ok: true; recipe: SuggestedRecipe }
	| { ok: false; reason: 'network' | 'provider' | 'unreadable'; detail: string };

/**
 * La cle d'API que la personne a posee, et l'appel qu'elle permet.
 *
 * Deux choses seulement sortent de ce magasin vers l'exterieur : la requete construite par
 * `buildRequest`, et rien d'autre. En particulier la cle ne traverse jamais l'interface — les
 * ecrans lisent `configured`, `provider` et `model`, jamais `#apiKey`. C'est la raison du champ
 * prive : un composant ne peut pas l'afficher par distraction, et une capture d'ecran de
 * signalement (#12) ne peut pas l'emporter.
 *
 * Il n'y a pas de cle d'instance dans cette application : sans cle posee ici, il n'y a pas de
 * fonctionnalite du tout, et les ecrans ne montrent rien.
 */
class AiStore {
	provider = $state<string>(DEFAULT_PROVIDER);
	model = $state('');

	/** Une cle est enregistree pour ce compte. C'est ce que les ecrans consultent. */
	configured = $state(false);

	/** Tant que c'est vrai, aucun ecran ne conclut « pas de cle » : il ne conclut rien. */
	loading = $state(true);

	error = $state<string | null>(null);

	#apiKey = '';

	/**
	 * Relit la ligne du compte. `maybeSingle` et non `single` : l'absence de cle est le cas normal
	 * au premier passage, et `single` en ferait une erreur affichee a quelqu'un qui n'a rien
	 * demande.
	 */
	async load() {
		this.loading = true;
		this.error = null;

		const { data, error } = await supabase
			.from('ai_credentials')
			.select('provider, api_key, model')
			.maybeSingle();

		this.loading = false;

		if (error) {
			this.error = error.message;
			return;
		}

		if (!data) {
			this.#apiKey = '';
			this.configured = false;
			return;
		}

		this.provider = isProvider(data.provider) ? data.provider : DEFAULT_PROVIDER;
		this.model = data.model;
		this.#apiKey = data.api_key;
		this.configured = true;
	}

	/**
	 * Enregistre la cle du compte connecte.
	 *
	 * `user_id` est pose explicitement plutot que laisse a un defaut : la policy le compare a
	 * `auth.uid()`, et une colonne absente ferait echouer l'ecriture sur une violation de RLS
	 * plutot que sur un message comprehensible.
	 */
	async save(provider: string, apiKey: string, model: string): Promise<boolean> {
		const key = apiKey.trim();
		if (!isProvider(provider) || key === '') return false;

		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) {
			this.error = 'no-session';
			return false;
		}

		const { error } = await supabase.from('ai_credentials').upsert(
			{
				user_id: userId,
				provider,
				api_key: key,
				model: model.trim(),
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.provider = provider;
		this.model = model.trim();
		this.#apiKey = key;
		this.configured = true;
		return true;
	}

	async clear(): Promise<boolean> {
		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const { error } = await supabase.from('ai_credentials').delete().eq('user_id', userId);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#apiKey = '';
		this.model = '';
		this.configured = false;
		return true;
	}

	/** Le compte a change : ce qui reste en memoire appartient a quelqu'un d'autre. */
	reset() {
		this.#apiKey = '';
		this.model = '';
		this.provider = DEFAULT_PROVIDER;
		this.configured = false;
		this.loading = true;
	}

	/**
	 * Le seul appel qui parte du navigateur directement chez un tiers.
	 *
	 * L'import d'une recette depuis un lien (#140) sort lui aussi du projet, mais il passe par le
	 * serveur de l'instance, qui se presente au site visite. Ici il n'y a pas d'intermediaire : la
	 * requete part de l'appareil, et c'est pour cela que le fournisseur doit accepter une origine
	 * navigateur — condition qui decide a elle seule de la liste de `PROVIDERS`.
	 *
	 * Il part du navigateur, avec la cle de la personne : c'est son quota et sa facture. Le texte
	 * envoye est exactement `prompt`, celui que l'ecran vient d'afficher — aucune entete de
	 * contexte ajoutee ici, sans quoi ce qui est montre avant l'envoi cesserait d'etre ce qui part.
	 */
	async suggestRecipe(prompt: string): Promise<SuggestOutcome> {
		const provider = providerById(this.provider);
		if (!provider || !this.#apiKey) {
			return { ok: false, reason: 'provider', detail: '' };
		}

		const request = buildRequest(provider, this.#apiKey, this.model, prompt);

		let response: Response;
		try {
			response = await fetch(request.url, {
				method: 'POST',
				headers: request.headers,
				body: request.body
			});
		} catch {
			// Un refus CORS arrive ici, indistinguable d'une coupure reseau : le navigateur ne dit
			// rien de plus au code appelant, par conception.
			return { ok: false, reason: 'network', detail: '' };
		}

		const payload: unknown = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				ok: false,
				reason: 'provider',
				detail: parseError(payload) ?? String(response.status)
			};
		}

		const text = parseReply(provider, payload);
		if (text === null) return { ok: false, reason: 'unreadable', detail: '' };

		const recipe = parseRecipeSuggestion(text);
		if (recipe === null) return { ok: false, reason: 'unreadable', detail: '' };

		return { ok: true, recipe };
	}
}

export const ai = new AiStore();
