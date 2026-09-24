import type { LegalDocumentId, LegalText } from './legal';

const CONTACT = '[TO CONFIRM: adresse e-mail de contact]';
const EFFECTIVE = '[TO CONFIRM: date d’entrée en vigueur]';

export const LEGAL_FR: Record<LegalDocumentId, LegalText> = {
	notice: {
		title: 'Mentions légales',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Éditeur',
				paragraphs: [
					'FamiList est édité par Gaëtan Compigni, particulier, à titre non professionnel.',
					`Contact : ${CONTACT}.`,
					'[TO CONFIRM: adresse postale ou domiciliation, uniquement si elle est exigée]'
				]
			},
			{
				heading: 'Directeur de la publication',
				paragraphs: ['Gaëtan Compigni.']
			},
			{
				heading: 'Hébergement',
				items: [
					'Application web : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com.',
					'Base de données, authentification et fichiers : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 — supabase.com. Les données sont hébergées dans la région eu-west-3 (Paris, France).'
				]
			},
			{
				heading: 'Code source et licence',
				paragraphs: [
					'Le code source de FamiList est public et distribué sous licence GNU AGPL-3.0-or-later : github.com/techmefr/FamiList.'
				]
			},
			{
				heading: 'Signalement',
				paragraphs: [`Pour signaler un contenu illicite ou un problème, écrivez à ${CONTACT}.`]
			}
		]
	},
	terms: {
		title: 'Conditions générales d’utilisation',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Objet',
				paragraphs: [
					'Les présentes conditions encadrent l’utilisation de FamiList, application de listes de courses partagées, de recettes, de menus et de cartes de fidélité, accessible sur app.familiste.fr et dans l’application mobile. Créer un compte vaut acceptation de ces conditions.'
				]
			},
			{
				heading: 'Compte',
				items: [
					'L’inscription demande une adresse e-mail valide. Un compte peut devoir être approuvé par un administrateur avant de donner accès au service.',
					'Vous êtes responsable de la confidentialité de vos identifiants. La double authentification est proposée et recommandée.',
					'Vous pouvez exporter vos données et supprimer votre compte à tout moment depuis Profil › Sécurité.'
				]
			},
			{
				heading: 'Foyer, partages et messagerie',
				paragraphs: [
					'Les listes, recettes, magasins, cartes et messages d’un foyer sont visibles par ses membres. Les éléments que vous partagez avec d’autres personnes leur deviennent accessibles. Vous restez responsable de ce que vous publiez et vous vous engagez à ne rien diffuser d’illicite, de haineux ou portant atteinte aux droits d’autrui.'
				]
			},
			{
				heading: 'Fonctions d’intelligence artificielle',
				paragraphs: [
					'Les fonctions d’IA utilisent un fournisseur que vous choisissez et votre propre clé d’API. Votre utilisation est soumise aux conditions de ce fournisseur, et les coûts éventuels vous incombent. Les résultats générés peuvent être inexacts : vérifiez notamment les allergènes et les quantités.'
				]
			},
			{
				heading: 'Cartes de fidélité',
				paragraphs: [
					'Vous ne devez enregistrer que des cartes et des identifiants dont vous êtes titulaire ou que le titulaire vous a autorisé à utiliser.'
				]
			},
			{
				heading: 'Disponibilité et responsabilité',
				paragraphs: [
					'Le service est fourni gratuitement, en l’état, par un particulier. Aucune disponibilité continue n’est garantie. L’éditeur ne saurait être tenu responsable d’une perte de données ou d’un dommage indirect, dans les limites permises par la loi.'
				]
			},
			{
				heading: 'Suspension',
				paragraphs: ['Un compte qui enfreint ces conditions peut être suspendu ou supprimé.']
			},
			{
				heading: 'Modifications et droit applicable',
				paragraphs: [
					'Ces conditions peuvent évoluer ; la version en vigueur est celle publiée sur cette page. Elles sont soumises au droit français. En cas de litige, une solution amiable est recherchée avant toute action ; à défaut, les tribunaux français sont compétents, sous réserve des règles protectrices du consommateur.',
					`Contact : ${CONTACT}.`
				]
			}
		]
	},
	privacy: {
		title: 'Politique de confidentialité',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Responsable du traitement',
				paragraphs: [`Gaëtan Compigni, particulier. Contact : ${CONTACT}.`]
			},
			{
				heading: 'Données traitées',
				items: [
					'Compte : adresse e-mail, nom affiché, avatar, mot de passe (haché par Supabase Auth), facteurs de double authentification, statut d’approbation.',
					'Contenu : listes et articles, recettes et leurs photos, menus, magasins et leur position, prix, cartes de fidélité, messages et sondages du foyer.',
					'Foyer et partages : appartenance au foyer, invitations, cercles, partages de listes, de recettes et de cartes.',
					'Mots de passe des comptes de fidélité : chiffrés au repos dans Supabase Vault, et éventuellement conservés sur votre appareil, chiffrés par un code de déverrouillage.',
					'Clés d’API d’IA : stockées pour vous seul, jamais partagées avec le foyer.',
					'Préférences : langue, thème, taille du texte, rappels.',
					'Signalements de bugs et rapports de plantage : description, capture d’écran facultative, navigateur (user agent), version de l’application.'
				]
			},
			{
				heading: 'Données traitées sur votre appareil uniquement',
				items: [
					'Caméra : lecture des codes-barres et loupe ; les images ne sont pas envoyées.',
					'Géolocalisation (application mobile, sur autorisation) : proposer la carte de fidélité d’un magasin proche ; votre position n’est pas envoyée à nos serveurs.',
					'Notifications locales : rappels et cartes à proximité, programmés sur l’appareil.'
				]
			},
			{
				heading: 'Finalités et bases légales',
				items: [
					'Fournir le service (compte, synchronisation, foyer, partages, messagerie, cartes) : exécution du contrat (article 6.1.b du RGPD).',
					'Sécurité, prévention des abus, approbation des comptes, double authentification : intérêt légitime (article 6.1.f).',
					'Diagnostic des bugs et des plantages : intérêt légitime.',
					'Fonctions d’IA et images : exécution du contrat, à votre demande.',
					'Géolocalisation et notifications : votre consentement, donné via les autorisations de l’appareil et retirable à tout moment.'
				]
			},
			{
				heading: 'Durées de conservation',
				items: [
					'Données du compte et contenus : tant que le compte existe ; supprimés lors de la suppression du compte.',
					'Contenus partagés au sein du foyer : conservés pour les autres membres selon les règles du foyer.',
					'Rapports de plantage et signalements : [TO CONFIRM: durée de conservation des rapports de plantage et signalements].',
					'Journaux techniques de l’hébergeur : selon la durée appliquée par Supabase et Vercel.'
				]
			},
			{
				heading: 'Destinataires et sous-traitants',
				items: [
					'Supabase Inc. : base de données, authentification, stockage des photos, Vault ; données hébergées à Paris (eu-west-3).',
					'Vercel Inc. (États-Unis) : hébergement de l’application web ; reçoit les données techniques de connexion (adresse IP, requêtes).',
					'Brevo (Sendinblue SAS, France) : envoi des e-mails depuis noreply@familiste.fr ; reçoit votre adresse e-mail.',
					'Sentry (Functional Software Inc., États-Unis), uniquement si l’instance est configurée pour l’utiliser : rapports de plantage. [TO CONFIRM: Sentry est-il activé en production ?]',
					'Fournisseur d’IA choisi par vous (par exemple Anthropic, Google, Mistral, Groq, OpenRouter, DeepSeek) : reçoit le texte de vos demandes, avec votre clé, directement depuis votre appareil.',
					'Pollinations et Openverse : reçoivent la description ou le nom d’une recette pour générer ou rechercher une image.',
					'GitHub : un signalement de bug ouvre un ticket qui ne contient que son numéro, sans donnée personnelle.'
				]
			},
			{
				heading: 'Transferts hors de l’Union européenne',
				paragraphs: [
					'Vercel et Sentry sont établis aux États-Unis, comme les fournisseurs d’IA américains. Ces transferts reposent sur les clauses contractuelles types de la Commission européenne et, le cas échéant, sur le Data Privacy Framework UE–États-Unis.'
				]
			},
			{
				heading: 'Vos droits',
				paragraphs: [
					`Vous disposez des droits d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, ainsi que du droit de retirer votre consentement. L’export de vos données et la suppression du compte sont disponibles dans Profil › Sécurité. Pour toute autre demande, écrivez à ${CONTACT}. Une réponse est apportée sous un mois.`,
					'Vous pouvez introduire une réclamation auprès de la CNIL : www.cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.'
				]
			},
			{
				heading: 'Cookies et stockage local',
				paragraphs: [
					'FamiList ne dépose aucun cookie publicitaire ni traceur de mesure d’audience. L’application utilise uniquement un stockage technique sur votre appareil : le stockage local du navigateur pour la session et les préférences, et une base IndexedDB (Dexie) pour le fonctionnement hors ligne. Ce stockage est strictement nécessaire au service et ne requiert pas de consentement.'
				]
			},
			{
				heading: 'Mineurs',
				paragraphs: [
					'En France, un mineur de moins de 15 ans ne peut consentir seul au traitement de ses données : son compte doit être créé avec l’accord d’un titulaire de l’autorité parentale, par exemple au sein du foyer familial.'
				]
			},
			{
				heading: 'Sécurité',
				paragraphs: [
					'Les échanges sont chiffrés (HTTPS). L’accès aux données est limité par des règles de sécurité au niveau de la base (RLS). Les secrets sont chiffrés au repos. La double authentification est disponible.'
				]
			},
			{
				heading: 'Modifications',
				paragraphs: ['Cette politique peut évoluer ; la version en vigueur est celle publiée sur cette page.']
			}
		]
	},
	sales: {
		title: 'Conditions générales de vente',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Service gratuit',
				paragraphs: [
					'FamiList est aujourd’hui entièrement gratuit. Aucune vente, aucun abonnement et aucun achat intégré ne sont proposés à ce jour.'
				]
			},
			{
				heading: 'Offres futures',
				paragraphs: [
					'L’éditeur se réserve la possibilité de proposer ultérieurement des offres payantes. Avant toute offre payante, des conditions générales de vente complètes (prix, modalités de paiement, droit de rétractation, garanties) seront publiées sur cette page, et aucune somme ne pourra être demandée sans votre accord exprès.'
				]
			},
			{
				heading: 'Contact',
				paragraphs: [`${CONTACT}.`]
			}
		]
	}
};
