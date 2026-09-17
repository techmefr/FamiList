/**
 * Le texte du courriel de test.
 *
 * En francais, pour la meme raison que le courriel groupe : il s adresse a qui administre
 * l instance, et rien en base ne dit dans quelle langue cette personne la lit.
 *
 * Le message dit ce qu il prouve, et pas seulement « ceci est un test ». Quelqu un qui recoit ce
 * courriel trois jours plus tard, dans un dossier indesirables, doit comprendre d ou il vient et ce
 * que sa presence signifie — qu une inscription en attente lui arrivera par le meme chemin.
 *
 * Aucune dependance Deno ici, pour que la redaction reste testable par vitest.
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
