import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { OAUTH_PROVIDERS, type ProviderId } from '$domain/oauth';
import type { Session, User } from '@supabase/supabase-js';

export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
	id: string;
	display_name: string;
	role: 'user' | 'admin';
	status: AccountStatus;
	is_demo: boolean;
}

class SessionStore {
	user = $state<User | null>(null);
	profile = $state<Profile | null>(null);
	loading = $state(true);
	error = $state<string | null>(null);

	isSignedIn = $derived(this.user !== null);
	isApproved = $derived(this.profile?.status === 'approved');
	isAdmin = $derived(this.profile?.role === 'admin' && this.isApproved);

	async init() {
		if (!browser) return;

		const { data } = await supabase.auth.getSession();
		await this.apply(data.session);

		supabase.auth.onAuthStateChange((_event, session) => {
			this.apply(session);
		});

		this.loading = false;
	}

	private async apply(session: Session | null) {
		this.user = session?.user ?? null;

		if (!this.user) {
			this.profile = null;
			return;
		}

		const { data, error } = await supabase
			.from('profiles')
			.select('id, display_name, role, status, is_demo')
			.eq('id', this.user.id)
			.maybeSingle();

		// Le profil est créé par un trigger à l'inscription. S'il manque encore, on ne bloque pas :
		// l'écran d'attente s'affichera, et le prochain rafraîchissement le trouvera.
		this.profile = error ? null : (data as Profile | null);
	}

	async signUp(email: string, password: string, displayName: string) {
		this.error = null;
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: displayName } }
		});

		if (error) this.error = error.message;
		return !error;
	}

	async signIn(email: string, password: string) {
		this.error = null;
		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Part chez le fournisseur puis revient sur la racine. On ne redirige pas vers une page dediee :
	 * le client Supabase est cree avec detectSessionInUrl, il echange le code contre une session
	 * au premier chargement, quelle que soit la page. Et la racine sait deja renvoyer vers l'ecran
	 * d'attente si le compte n'est pas encore valide.
	 */
	async signInWithProvider(id: ProviderId) {
		this.error = null;

		const provider = OAUTH_PROVIDERS.find((candidate) => candidate.id === id);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: id,
			options: {
				redirectTo: `${location.origin}/`,
				scopes: provider?.scopes
			}
		});

		if (error) this.error = error.message;
		return !error;
	}

	async signOut() {
		await supabase.auth.signOut();
		this.user = null;
		this.profile = null;

		// Le cache local survit à la déconnexion s'il n'est pas vidé : sur un appareil partagé, la
		// personne suivante ouvrirait les listes de la précédente.
		const { data } = await import('$stores/data.svelte');
		await data.forget();
	}
}

export const session = new SessionStore();
