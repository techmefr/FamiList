/**
 * Dominant hand: which side of the screen the thumb-reachable controls sit on.
 *
 * Only two values, and right-handed by default: that is the original placement of the create button, and
 * the more common hand. A "system" value would make no sense here — no platform publishes this information.
 *
 * Careful, this setting is not a logical property. A left hand stays a left hand when the interface reads
 * right to left: the side aimed at is physical, it does not follow `dir`.
 */
export type Hand = 'right' | 'left';

export const HANDS: Hand[] = ['right', 'left'];

export const isHand = (value: unknown): value is Hand => HANDS.includes(value as Hand);
