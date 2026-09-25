import {
	dismissToast,
	isSticky,
	progressToast,
	pushToast,
	TOAST_DURATION_MS,
	type Toast,
	type ToastAction
} from '$domain/toast';
import { feedback } from './feedback.svelte';

class Toasts {
	items = $state<Toast[]>([]);
	#nextId = 1;

	success(message: string, action?: ToastAction): number {
		return this.#show({ tone: 'success', message, action });
	}

	error(message: string, action?: ToastAction): number {
		return this.#show({ tone: 'error', message, action });
	}

	/** A toast with a bar, which stays until `dismiss`: returns its id, for `setProgress`. */
	progress(message: string): number {
		return this.#show({ tone: 'progress', message, progress: 0 });
	}

	setProgress(id: number, ratio: number) {
		this.items = progressToast(this.items, id, ratio);
	}

	dismiss(id: number) {
		this.items = dismissToast(this.items, id);
	}

	#show(toast: Omit<Toast, 'id'>): number {
		const id = this.#nextId++;
		this.items = pushToast(this.items, { id, ...toast });
		if (toast.tone !== 'progress') feedback.play(toast.tone);
		if (!isSticky(toast) && toast.tone !== 'progress') {
			setTimeout(() => this.dismiss(id), TOAST_DURATION_MS[toast.tone]);
		}
		return id;
	}
}

export const toasts = new Toasts();
