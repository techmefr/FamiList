export type ToastTone = 'success' | 'error' | 'progress';

/** A button on the toast itself, for news that leads somewhere: "the recipe is ready — open it". */
export interface ToastAction {
	label: string;
	run: () => void;
}

export interface Toast {
	id: number;
	tone: ToastTone;
	message: string;
	action?: ToastAction;
	/** From 0 to 1, for a `progress` toast: work going on in the background while the app stays usable. */
	progress?: number;
}

/** Long enough to be read at the largest text size; an error stays longer, it usually says what to do next. */
export const TOAST_DURATION_MS: Record<Exclude<ToastTone, 'progress'>, number> = {
	success: 5000,
	error: 9000
};

export const MAX_TOASTS = 3;

/**
 * Whether the toast goes away on its own. One carrying a button or a progress bar stays until it is done
 * with: a button vanishing while a slow reader reaches for it is a door shut in their face.
 */
export const isSticky = (toast: Pick<Toast, 'tone' | 'action'>): boolean =>
	toast.tone === 'progress' || Boolean(toast.action);

export function pushToast(toasts: Toast[], toast: Toast): Toast[] {
	return [...toasts, toast].slice(-MAX_TOASTS);
}

export function dismissToast(toasts: Toast[], id: number): Toast[] {
	return toasts.filter((toast) => toast.id !== id);
}

/** The bar of a progress toast moved on, kept between 0 and 1. */
export function progressToast(toasts: Toast[], id: number, progress: number): Toast[] {
	const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
	return toasts.map((toast) => (toast.id === id ? { ...toast, progress: clamped } : toast));
}
