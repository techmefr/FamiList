export type ToastTone = 'success' | 'error';

export interface Toast {
	id: number;
	tone: ToastTone;
	message: string;
}

/** Long enough to be read at the largest text size; an error stays longer, it usually says what to do next. */
export const TOAST_DURATION_MS: Record<ToastTone, number> = {
	success: 5000,
	error: 9000
};

export const MAX_TOASTS = 3;

export function pushToast(toasts: Toast[], toast: Toast): Toast[] {
	return [...toasts, toast].slice(-MAX_TOASTS);
}

export function dismissToast(toasts: Toast[], id: number): Toast[] {
	return toasts.filter((toast) => toast.id !== id);
}
