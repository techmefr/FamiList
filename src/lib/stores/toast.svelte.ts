import { dismissToast, pushToast, TOAST_DURATION_MS, type Toast, type ToastTone } from '$domain/toast';
import { feedback } from './feedback.svelte';

class Toasts {
	items = $state<Toast[]>([]);
	#nextId = 1;

	success(message: string) {
		this.#show('success', message);
	}

	error(message: string) {
		this.#show('error', message);
	}

	dismiss(id: number) {
		this.items = dismissToast(this.items, id);
	}

	#show(tone: ToastTone, message: string) {
		const id = this.#nextId++;
		this.items = pushToast(this.items, { id, tone, message });
		feedback.play(tone);
		setTimeout(() => this.dismiss(id), TOAST_DURATION_MS[tone]);
	}
}

export const toasts = new Toasts();
