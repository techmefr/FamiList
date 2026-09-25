import data from './releases.json';
import { parseReleases } from '$domain/changelog';

/**
 * The releases bundled with this build, newest first.
 *
 * Parsed rather than cast: a hand edit that breaks the shape fails the unit test on this very file long
 * before it reaches anyone, and the app never has to guard against a half-written release at render time.
 */
export const RELEASES = parseReleases(data);
