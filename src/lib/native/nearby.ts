import { Capacitor } from '@capacitor/core';
import {
	nearbyAlert,
	NEARBY_CHECK_MS,
	rememberNotified,
	type NearbyAlert,
	type NearbyCard,
	type NearbyShop
} from '$domain/nearby';

/**
 * Proposer la carte de fidélité quand on arrive devant un magasin.
 *
 * C'est natif et rien d'autre. Un navigateur ne surveille pas une position : l'onglet est suspendu
 * dès qu'on le quitte, et fermé il n'exécute plus rien. Sur le web on ne démarre donc aucune
 * surveillance, et l'interface le dit au lieu de laisser croire à une notification qui ne viendra
 * jamais.
 *
 * Même en natif, la promesse est bornée et il vaut mieux l'écrire : la surveillance vit avec
 * l'application. Tant qu'elle est ouverte ou récemment mise en arrière-plan, la position arrive ;
 * une fois l'application tuée par le système, plus rien ne tourne — tenir cette promesse-là
 * demanderait un service de premier plan avec sa notification permanente, ce qui coûte plus cher
 * en batterie et en attention que ce que la fonctionnalité rapporte.
 */
export type NearbyPermission = 'granted' | 'denied' | 'unsupported';

export interface NearbyContext {
	shops: NearbyShop[];
	cards: NearbyCard[];
	texts: (alert: NearbyAlert) => { title: string; body: string };
	onOpen: (cardId: string) => void;
}

const JOURNAL_KEY = 'familiste:nearby';

export function nearbySupported(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * Le journal des magasins déjà annoncés, gardé sur l'appareil.
 *
 * Volontairement local et non synchronisé : c'est ce téléphone-là qui est passé devant ce
 * magasin-là. Quelqu'un d'autre du foyer qui y va le même jour a droit à sa propre notification.
 */
function lireJournal(): Record<string, string> {
	try {
		const brut = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '{}');
		return typeof brut === 'object' && brut !== null ? (brut as Record<string, string>) : {};
	} catch {
		return {};
	}
}

function ecrireJournal(journal: Record<string, string>) {
	try {
		localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
	} catch {
		// Stockage plein ou refusé : au pire une notification de trop, rien de cassé.
	}
}

/**
 * Demander les deux autorisations, et seulement sur un geste de la personne.
 *
 * La position et les notifications sont demandées ensemble parce que l'une sans l'autre ne sert à
 * rien ici. Un refus n'est pas une erreur : le réglage reste refusable, et l'interface annonce ce
 * qui manque plutôt que de rester muette.
 */
export async function requestNearbyPermission(): Promise<NearbyPermission> {
	if (!nearbySupported()) return 'unsupported';

	try {
		const { Geolocation } = await import('@capacitor/geolocation');
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const position = await Geolocation.requestPermissions({ permissions: ['location'] });
		if (position.location !== 'granted') return 'denied';

		const notifications = await LocalNotifications.checkPermissions();
		if (notifications.display === 'granted') return 'granted';

		const demandee = await LocalNotifications.requestPermissions();
		return demandee.display === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'unsupported';
	}
}

let contexte: NearbyContext | null = null;
let veille: string | null = null;
let dernierControle = 0;
let ecoute = false;

async function annoncer(latitude: number, longitude: number) {
	if (!contexte) return;

	const maintenant = new Date();
	// La position peut arriver à la seconde ; on n'en regarde qu'une de temps en temps.
	if (maintenant.getTime() - dernierControle < NEARBY_CHECK_MS) return;
	dernierControle = maintenant.getTime();

	const alerte = nearbyAlert(
		{ lat: latitude, lng: longitude },
		contexte.shops,
		contexte.cards,
		lireJournal(),
		maintenant
	);
	if (!alerte) return;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const permission = await LocalNotifications.checkPermissions();
		if (permission.display !== 'granted') return;

		const { title, body } = contexte.texts(alerte);

		// Le journal est inscrit avant l'envoi : si l'affichage échoue, mieux vaut une notification
		// manquée qu'une boucle qui réessaie à chaque position.
		ecrireJournal(rememberNotified(lireJournal(), alerte.shopId, maintenant));

		await LocalNotifications.schedule({
			notifications: [
				{
					id: alerte.id,
					title,
					body,
					// Aucune programmation : on est devant le magasin maintenant, pas plus tard.
					extra: { cardId: alerte.cardId }
				}
			]
		});
	} catch {
		// Greffon absent ou canal refusé : les cartes restent accessibles à la main.
	}
}

/**
 * Le robinet de la surveillance, rejoué à chaque changement.
 *
 * Une seule veille tourne à la fois, et le contexte est remplacé à chaud : un magasin créé, une
 * carte rattachée ou une position relevée sont pris en compte sans redémarrer le GPS.
 *
 * Précision basse assumée : à trois cents mètres de rayon, le réseau et les bornes wifi suffisent,
 * et c'est ce qui permet de laisser la veille tourner sans vider la batterie.
 */
export async function applyNearbyWatch(enabled: boolean, next: NearbyContext): Promise<void> {
	contexte = next;

	if (!nearbySupported()) return;

	try {
		const { Geolocation } = await import('@capacitor/geolocation');

		if (!enabled) {
			if (veille) await Geolocation.clearWatch({ id: veille });
			veille = null;
			return;
		}

		if (!ecoute) {
			const { LocalNotifications } = await import('@capacitor/local-notifications');

			// Toucher la notification ouvre la carte : c'est tout l'intérêt de la proposer.
			await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
				const cardId = action.notification.extra?.cardId;
				if (typeof cardId === 'string') contexte?.onOpen(cardId);
			});
			ecoute = true;
		}

		if (veille) return;

		const permission = await Geolocation.checkPermissions();
		if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') return;

		veille = await Geolocation.watchPosition(
			{ enableHighAccuracy: false, timeout: 30_000, maximumAge: NEARBY_CHECK_MS },
			(position) => {
				if (!position) return;
				void annoncer(position.coords.latitude, position.coords.longitude);
			}
		);
	} catch {
		// Greffon absent ou position indisponible : rien ne se déclenche, rien ne casse.
	}
}
