import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { OAUTH_PROVIDERS, type ProviderId } from '$domain/oauth';
import type { Session, User } from '@supabase/supabase-js';

export type AccountStatus = 'pending' | 'approved' | 'rejected';

/** Un facteur TOTP tel qu'on en a besoin à l'écran : le reste de la réponse ne sert à rien ici. */
export interface Factor {
	id: string;
	friendlyName: string;
	createdAt: string;
}

/** Une session ouverte, telle que la rend `public.my_sessions()`. */
export interface OpenSession {
	id: string;
	created_at: string;
	refreshed_at: string;
	user_agent: string | null;
	ip: string | null;
	aal: string;
	current: boolean;
}

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

	/**
	 * Où en est cette session de son deuxième facteur.
	 *
	 * `level` est ce qu'elle a présenté, `nextLevel` ce que le compte exige. Les deux se lisent dans
	 * le jeton, sans appel réseau : Supabase les décode pour nous.
	 */
	level = $state<string | null>(null);
	nextLevel = $state<string | null>(null);

	isSignedIn = $derived(this.user !== null);

	/**
	 * Le compte demande un deuxième facteur et cette session ne l'a pas encore donné.
	 *
	 * Ce n'est pas qu'un écran : la base refuse déjà toute lecture dans cet état (voir
	 * `public.is_approved()`). Le dire côté client sert surtout à ne pas lancer la synchronisation,
	 * qui vide les tables locales avant de les remplir — elle les viderait pour rien, et l'appareil
	 * perdrait son hors-ligne à cause d'un code pas encore saisi.
	 */
	needsSecondFactor = $derived(
		this.isSignedIn && this.nextLevel === 'aal2' && this.level !== 'aal2'
	);

	isApproved = $derived(this.profile?.status === 'approved' && !this.needsSecondFactor);
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
			this.level = null;
			this.nextLevel = null;
			return;
		}

		await this.refreshLevels();

		const { data, error } = await supabase
			.from('profiles')
			.select('id, display_name, role, status, is_demo')
			.eq('id', this.user.id)
			.maybeSingle();

		// Le profil est créé par un trigger à l'inscription. S'il manque encore, on ne bloque pas :
		// l'écran d'attente s'affichera, et le prochain rafraîchissement le trouvera.
		this.profile = error ? null : (data as Profile | null);
	}

	/**
	 * Relit le niveau d'authentification de la session.
	 *
	 * Appelé à chaque changement de session, et à nouveau quand la base refuse une écriture pour
	 * « compte non valide » : c'est le seul moyen de savoir si le refus vient d'un deuxième
	 * facteur manquant plutôt que d'un compte non approuvé. Une lecture qui échoue laisse les
	 * niveaux inchangés — les mettre à `null` ferait passer un compte protégé pour un compte sans
	 * deuxième facteur.
	 */
	async refreshLevels() {
		const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
		if (error) return false;

		this.level = data?.currentLevel ?? null;
		this.nextLevel = data?.nextLevel ?? null;
		return true;
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

	/**
	 * Envoie un code à six chiffres par courriel.
	 *
	 * Le même appel sert au lien magique : c'est le gabarit de courriel qui décide lequel des deux
	 * part, et Supabase accepte la vérification du code dans les deux cas. On ne crée pas de compte
	 * au passage — une adresse mal tapée créerait un compte fantôme en attente de validation, que
	 * l'administrateur devrait ensuite trier.
	 */
	async sendEmailCode(email: string) {
		this.error = null;
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/` }
		});

		if (error) this.error = error.message;
		return !error;
	}

	async verifyEmailCode(email: string, token: string) {
		this.error = null;
		const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Change le mot de passe, après avoir revérifié l'ancien.
	 *
	 * Supabase ne demande pas l'ancien : `updateUser` accepte un nouveau mot de passe sur la seule
	 * foi de la session. C'est commode et c'est dangereux — un écran laissé ouvert dans un bureau
	 * suffirait alors à s'emparer du compte, et la personne à qui il appartient ne pourrait plus
	 * rentrer. On se reconnecte donc avec l'ancien avant d'écrire le nouveau.
	 *
	 * L'appel de contrôle ouvre une session de plus, ce qui est visible dans la liste des appareils
	 * : c'est le prix, et il est petit à côté de ce qu'il évite.
	 */
	async changePassword(current: string, next: string) {
		this.error = null;

		const email = this.user?.email;
		if (!email) return false;

		const { error: refus } = await supabase.auth.signInWithPassword({ email, password: current });
		if (refus) {
			this.error = refus.message;
			return false;
		}

		const { error } = await supabase.auth.updateUser({ password: next });
		if (error) {
			this.error = error.message;
			return false;
		}

		return true;
	}

	/**
	 * Les facteurs TOTP vérifiés du compte. Les inscriptions inachevées ne comptent pas.
	 *
	 * `null` quand la lecture échoue : une liste vide voudrait dire « pas de deuxième facteur »,
	 * ce qui est un état légitime et rassurant, alors que l'appel n'a rien pu établir.
	 */
	async listFactors(): Promise<Factor[] | null> {
		const { data, error } = await supabase.auth.mfa.listFactors();

		if (error) {
			this.error = error.message;
			return null;
		}

		return (data?.totp ?? []).map((factor) => ({
			id: factor.id,
			friendlyName: factor.friendly_name ?? '',
			createdAt: factor.created_at
		}));
	}

	/**
	 * Commence une inscription TOTP et rend de quoi la montrer.
	 *
	 * Supabase dessine lui-même le QR : rien à encoder ici. Le secret en clair l'accompagne, pour
	 * les applications qui ne savent pas photographier et pour qui ne peut pas viser un carré.
	 */
	async enrollTotp() {
		this.error = null;
		const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

		if (error) {
			this.error = error.message;
			return null;
		}

		return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
	}

	/** Termine l'inscription : le code prouve que l'application a bien été réglée. */
	async verifyEnrollment(factorId: string, code: string) {
		this.error = null;
		const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

		if (error) this.error = error.message;
		return !error;
	}

	/** Élève la session courante en aal2. Même appel, autre moment : ici on se connecte. */
	async challengeTotp(factorId: string, code: string) {
		return this.verifyEnrollment(factorId, code);
	}

	/**
	 * Retire le deuxième facteur. La session doit être en aal2 pour cela — c'est Supabase qui
	 * l'exige, et c'est heureux : sinon un onglet volé suffirait à le désactiver.
	 */
	async unenrollTotp(factorId: string) {
		this.error = null;
		const { error } = await supabase.auth.mfa.unenroll({ factorId });

		if (error) {
			this.error = error.message;
			return false;
		}

		await supabase.auth.refreshSession();
		return true;
	}

	/**
	 * Consomme un code de secours, ce qui retire le deuxième facteur du compte.
	 *
	 * Le jeton est rafraîchi juste après : il portait encore la trace d'un facteur qui n'existe
	 * plus, et sans cela la session resterait bloquée devant une porte qu'on vient d'enlever.
	 */
	async useBackupCode(code: string) {
		this.error = null;
		const { data, error } = await supabase.rpc('consume_backup_code', { code });

		if (error) {
			this.error = error.message;
			return false;
		}

		if (!data) return false;

		await supabase.auth.refreshSession();
		return true;
	}

	/** Fabrique une série neuve. Les codes en clair ne repasseront jamais par ici. */
	async newBackupCodes(): Promise<string[]> {
		this.error = null;
		const { data, error } = await supabase.rpc('create_backup_codes');

		if (error) {
			this.error = error.message;
			return [];
		}

		return (data ?? []) as string[];
	}

	/** `null` sur échec : zéro se lirait comme « plus aucun code de secours ». */
	async backupCodesLeft(): Promise<number | null> {
		const { data, error } = await supabase.rpc('backup_codes_left');

		if (error) {
			this.error = error.message;
			return null;
		}

		return typeof data === 'number' ? data : 0;
	}

	/** `null` sur échec : une liste vide se lirait comme « aucun appareil connecté ». */
	async listSessions(): Promise<OpenSession[] | null> {
		const { data, error } = await supabase.rpc('my_sessions');

		if (error) {
			this.error = error.message;
			return null;
		}

		return (data ?? []) as OpenSession[];
	}

	/**
	 * Ferme une session. Fermer la sienne est permis, et vaut déconnexion : le client s'en aperçoit
	 * au prochain rafraîchissement de jeton, on ne l'attend pas.
	 */
	async revokeSession(id: string) {
		this.error = null;
		const { error } = await supabase.rpc('revoke_session', { target: id });

		if (error) {
			this.error = error.message;
			return false;
		}

		return true;
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
