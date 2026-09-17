/**
 * Envoie un courriel de test a l administrateur qui vient de cliquer, et dit ce qui a echoue.
 *
 * Pourquoi cette fonction existe. L envoi reel est asynchrone et muet : `flush_admin_notifications`
 * reveille `notify-admins` toutes les cinq minutes, et un echec ne laisse qu une ligne dans des
 * journaux que personne qui n est pas developpeur n ira lire. Sans ce bouton, la seule facon de
 * savoir si la configuration marche serait d attendre qu un inconnu s inscrive.
 *
 * Pourquoi elle repond en codes et non en messages. Le texte montre a l ecran est traduit dans dix
 * langues cote client ; renvoyer une phrase francaise d ici la rendrait intraduisible. Le code dit
 * la cause, l ecran dit la phrase.
 *
 * Pourquoi le destinataire n est pas dans la requete. `begin_instance_mail_test()` rend l adresse
 * du compte appelant, et c est la seule qu on serve. Un champ libre aurait fait de ce bouton un
 * formulaire d envoi pour qui detient un compte administrateur vole.
 *
 * Ce qu elle ne rend jamais : la valeur d un reglage secret. La reponse ne porte que l issue, la
 * cle publique de la cause, et l adresse a laquelle le message est parti.
 */

import { diagnoseMailFailure, type MailTestOutcome } from '../_shared/mail-diagnosis.ts';
import { isMailConfigured, loadMailSettings, sendMail } from '../_shared/mail.ts';
import { callRpc } from '../_shared/rpc.ts';
import { buildTestMail } from './message.ts';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(outcome: MailTestOutcome, extra: Record<string, unknown> = {}): Response {
	return Response.json({ outcome, ...extra }, { headers: CORS });
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

	// Le jeton de la personne, pas la cle de service : c est la base qui verifie le role et le
	// deuxieme facteur, via `assert_admin_write()`. Une fonction edge qui trancherait elle-meme
	// serait un deuxieme endroit ou la regle peut diverger.
	const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? '';
	if (token === '') return reply('failed', { reason: 'missing_token' });

	let recipient: string;

	try {
		recipient = await callRpc<string>('begin_instance_mail_test', {}, token);
	} catch (error) {
		const reason = String(error);

		if (reason.includes('plafond')) return reply('quota');

		// Un refus de role ou d elevation remonte tel quel : l ecran sait deja traduire ces deux
		// messages-la, il le fait pour toutes les autres ecritures du panneau.
		return reply('failed', { reason });
	}

	const settings = await loadMailSettings();

	if (!isMailConfigured(settings)) return reply('not_configured');

	try {
		const mail = buildTestMail(recipient);
		await sendMail(settings, [recipient], mail.subject, mail.text);
	} catch (error) {
		console.error('test-instance-mail', error);

		return reply(diagnoseMailFailure(String(error)), { recipient });
	}

	return reply('sent', { recipient });
});
