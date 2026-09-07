/**
 * Connexion par fournisseur externe. Le code est complet pour les quatre fournisseurs, mais un
 * bouton n'apparait que si son identifiant est dans ENABLED_PROVIDERS : Supabase repond
 * « Unsupported provider » a un fournisseur qu'on n'a pas configure chez lui, et un bouton qui
 * echoue toujours est pire que pas de bouton du tout.
 *
 * Activer un fournisseur demande deux gestes, dans cet ordre :
 *  1. creer l'application OAuth chez le fournisseur, puis coller son identifiant et son secret dans
 *     Supabase (Authentication > Sign In / Providers). L'URL de retour a declarer chez le
 *     fournisseur est https://<ref>.supabase.co/auth/v1/callback ;
 *  2. ajouter son identifiant a ENABLED_PROVIDERS ici, puis redeployer.
 *
 * Microsoft s'appelle « azure » cote Supabase, c'est son ancien nom de produit.
 */
export type ProviderId = 'google' | 'apple' | 'facebook' | 'azure';

export interface OAuthProvider {
	id: ProviderId;
	/** Nom de marque, jamais traduit : « Google » s'ecrit Google dans toutes les langues. */
	label: string;
	/**
	 * Portees demandees en plus de celles par defaut. Microsoft ne renvoie pas l'adresse e-mail
	 * sans email, et sans adresse le declencheur qui cree le profil n'a rien pour nommer la
	 * personne.
	 */
	scopes?: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
	{ id: 'google', label: 'Google' },
	{ id: 'apple', label: 'Apple' },
	{ id: 'facebook', label: 'Facebook' },
	{ id: 'azure', label: 'Microsoft', scopes: 'email' }
];

/**
 * Les fournisseurs reellement configures dans Supabase. Vide tant qu'aucune application OAuth
 * n'existe : l'ecran de connexion n'affiche alors que le formulaire e-mail, sans separateur.
 */
export const ENABLED_PROVIDERS: ProviderId[] = [];

export function enabledProviders(
	enabled: ProviderId[] = ENABLED_PROVIDERS,
	catalogue: OAuthProvider[] = OAUTH_PROVIDERS
): OAuthProvider[] {
	return catalogue.filter((provider) => enabled.includes(provider.id));
}
