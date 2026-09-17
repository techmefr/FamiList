/**
 * How long to let the camera search before offering something else.
 *
 * A well presented card is read in a second or two. Past six seconds, it is no longer a question of
 * patience: it is the screen's reflection, the crumpled film or the light preventing the reading, and
 * waiting longer changes nothing. So we offer the photo at that moment, without cutting anything — the scan
 * can still succeed while the suggestion is being read.
 *
 * The stop at thirty seconds is there for somebody who has put the phone down: beyond that, the camera
 * heats up and drains the battery for nothing. It is long on purpose, because a cut just as you are looking
 * for the right angle would be more annoying than the sweep itself.
 */
export const SCAN_SUGGEST_MS = 6_000;
export const SCAN_TIMEOUT_MS = 30_000;

export type ScanOutcome = 'stopped' | 'timeout';

/**
 * A requested stop is not a failure: showing "no code found" because "Stop" has just been pressed would
 * make a deliberate gesture look like a breakdown.
 */
export function scanOutcome(aborted: boolean): ScanOutcome {
	return aborted ? 'stopped' : 'timeout';
}
