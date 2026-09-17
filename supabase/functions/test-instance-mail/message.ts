/**
 * The text of the test email.
 *
 * In French, for the same reason as the grouped email: it is addressed to whoever administers the instance,
 * and nothing in the database says which language that person reads it in.
 *
 * The message says what it proves, and not merely "this is a test". Somebody receiving this email three days
 * later, in a junk folder, must understand where it comes from and what its presence means — that a pending
 * sign-up will reach them by the same path.
 *
 * No Deno dependency here, so that the writing stays testable by vitest.
 */

export type TestMail = {
	subject: string;
	text: string;
};

export function buildTestMail(recipient: string): TestMail {
	return {
		subject: 'Familiste — courriel de test',
		text: [
			`Ce message a ete envoye a ${recipient} depuis le panneau d administration de Familiste.`,
			'',
			'Sa reception prouve trois choses : le serveur d envoi repond, ses identifiants sont',
			'acceptes, et votre fournisseur reconnait l adresse d expedition configuree.',
			'',
			'Les inscriptions en attente et les signalements emprunteront desormais ce meme chemin.',
			'',
			"S il est arrive dans les indesirables, marquez-le comme legitime : les prochains n'auront",
			'pas plus de chance que celui-ci.'
		].join('\n')
	};
}
