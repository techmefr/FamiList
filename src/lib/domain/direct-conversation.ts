/**
 * What we show of a direct conversation, outside any circle.
 *
 * A direct conversation has neither name nor emoji: it is designated by the other person. Everything that
 * follows is therefore computed from the two participants and the last message, and nothing else.
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
 * The other person in the conversation.
 *
 * Nothing guarantees on the screen side that the pair is intact: a deleted account leaves its identifier
 * behind, and a conversation with a single participant would return `undefined` rather than designate
 * oneself.
 */
export const otherParticipant = (conversation: DirectParticipation, me: string) =>
	conversation.participantIds.find((id) => id !== me);

/**
 * The direct conversations, the most recently active first.
 *
 * A conversation with no message keeps its place: it has just been opened and that is precisely where we
 * are about to write. It is dated at zero and therefore comes behind the live ones, but it does not
 * disappear.
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
