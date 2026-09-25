/**
 * "Suivre la recette" mode: one step at a time, hands free.
 *
 * Nothing here touches the browser: reading `SpeechSynthesis`, building an utterance and picking a
 * voice live in `$components/app/CookAlong.svelte`. What is decided here — which step is current, what
 * "next" and "previous" mean at the edges — can be verified without a browser, the same split
 * `domain/install.ts` already draws for the install prompt.
 */

/**
 * The step at `index`, clamped to the array's bounds.
 *
 * An index arriving out of range — a stale bookmark, a recipe edited shorter while cook-along was open —
 * never throws and never wraps: it lands on the nearest real step, so the screen always shows something
 * rather than a blank panel.
 */
export function clampStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(index)) return 0;

  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

/** The index one step forward, clamped: the last step has no next. */
export function nextStepIndex(index: number, total: number): number {
  return clampStepIndex(index + 1, total);
}

/** The index one step back, clamped: the first step has no previous. */
export function previousStepIndex(index: number, total: number): number {
  return clampStepIndex(index - 1, total);
}

export function isFirstStep(index: number, total: number): boolean {
  return clampStepIndex(index, total) === 0;
}

export function isLastStep(index: number, total: number): boolean {
  return total <= 0 || clampStepIndex(index, total) === total - 1;
}

/** "Étape 2 sur 6" needs 1-based numbers; the index stays 0-based everywhere else. */
export function stepPosition(
  index: number,
  total: number,
): { current: number; total: number } {
  return { current: clampStepIndex(index, total) + 1, total };
}

/**
 * The BCP 47 tag to hand `SpeechSynthesisUtterance.lang`, from the app's own locale code.
 *
 * `SpeechSynthesis` wants a real language tag ("fr-FR"), not the two-letter code the rest of the app
 * uses ("fr"): this is the one place that gap is bridged, so a wrong or missing mapping stays a single
 * line to fix.
 */
const SPEECH_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ru: "ru-RU",
  ar: "ar-SA",
  zh: "zh-CN",
  mg: "mg-MG",
};

export function speechLangOf(locale: string): string {
  return SPEECH_LOCALES[locale] ?? "en-US";
}

export type StepState = "done" | "current" | "todo";

/**
 * Every step of the track, told apart by more than a colour (#307): the screen draws a check on a done
 * step and a thicker frame on the current one, so the state reads in grey scale too.
 */
export function stepTrack(
  index: number,
  total: number,
): { number: number; state: StepState }[] {
  const current = clampStepIndex(index, total);

  return Array.from({ length: Math.max(total, 0) }, (_, step) => ({
    number: step + 1,
    state: step < current ? "done" : step === current ? "current" : "todo",
  }));
}
