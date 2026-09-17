/**
 * Ce qu'on affiche d'une conversation directe, hors de tout cercle.
 *
 * Une conversation directe n'a ni nom ni emoji : elle se désigne par l'autre personne. Tout ce qui
 * suit se calcule donc à partir des deux participants et du dernier message, et rien d'autre.
 */

export interface DirectParticipation {
	id: string;
	participantIds: string[];
}

export interface DirectMessage {
	conversationId?: string;
	body: string;
	createdAt: number;
}

export interface DirectSummary {
	conversationId: string;
	otherId: string;
	lastBody: string;
	lastAt: number;
}

/**
 * L'autre personne de la conversation.
 *
 * Rien ne garantit côté écran que la paire soit intacte : un compte supprimé laisse son identifiant
 * derrière lui, et une conversation à un seul participant rendrait `undefined` plutôt que de se
 * désigner soi-même.
 */
export const otherParticipant = (conversation: DirectParticipation, me: string) =>
	conversation.participantIds.find((id) => id !== me);

/**
 * Les conversations directes, la plus récemment animée en tête.
 *
 * Une conversation sans message garde sa place : elle vient d'être ouverte et c'est justement là
 * qu'on va écrire. Elle est datée à zéro et passe donc derrière celles qui vivent, mais elle ne
 * disparaît pas.
 */
export const directSummaries = (
	conversations: readonly DirectParticipation[],
	messages: readonly DirectMessage[],
	me: string
): DirectSummary[] => {
	const last = new Map<string, DirectMessage>();
	for (const message of messages) {
		if (!message.conversationId) continue;

		const known = last.get(message.conversationId);
		if (!known || known.createdAt <= message.createdAt) last.set(message.conversationId, message);
	}

	return conversations
		.flatMap((conversation) => {
			const otherId = otherParticipant(conversation, me);
			if (!otherId) return [];

			const message = last.get(conversation.id);

			return [
				{
					conversationId: conversation.id,
					otherId,
					lastBody: message?.body ?? '',
					lastAt: message?.createdAt ?? 0
				}
			];
		})
		.sort((a, b) => b.lastAt - a.lastAt);
};
