import { goto } from '$app/navigation';
import { i18n, t } from '$i18n/index.svelte';
import { ocrEngine } from '$native/ocr';
import { MAX_SCAN_PAGES, draftFromScan, scanProgress, structureRecipeText } from '$domain/recipe-ocr';
import { move } from '$domain/reorder';
import type { RecipeDraft } from '$domain/recipe-draft';
import { recipeDraft } from './recipe-draft.svelte';
import { toasts } from './toast.svelte';

export interface ScanPage {
	id: number;
	file: File;
	/** An object URL for the thumbnail, released when the page leaves the list. */
	url: string;
}

export type ScanStatus = 'idle' | 'reading' | 'ready' | 'empty' | 'failed';

/**
 * The photographed pages of a recipe and their reading (#312), kept here rather than in the screen: reading
 * a few pages takes a while on a phone, and the person must be able to leave the screen meanwhile. A toast
 * shows the progress wherever they are, and another one says when the recipe is ready — tapping it opens
 * the recipe form, the same hand-over every "Create a recipe" source ends with (#311). Nothing is saved.
 */
class RecipeScan {
	pages = $state<ScanPage[]>([]);
	status = $state<ScanStatus>('idle');
	progress = $state(0);
	draft = $state<RecipeDraft | null>(null);

	#nextId = 1;
	#toast: number | null = null;
	/** Bumped by every new reading and by a cancel: an older reading finishing late is then ignored. */
	#run = 0;

	get reading(): boolean {
		return this.status === 'reading';
	}

	get full(): boolean {
		return this.pages.length >= MAX_SCAN_PAGES;
	}

	add(files: Iterable<File>) {
		if (this.reading) return;
		this.#settle();

		const room = MAX_SCAN_PAGES - this.pages.length;
		const added = [...files]
			.filter((file) => file.type.startsWith('image/') || file.type === '')
			.slice(0, Math.max(0, room))
			.map((file) => ({ id: this.#nextId++, file, url: URL.createObjectURL(file) }));
		this.pages = [...this.pages, ...added];
	}

	remove(id: number) {
		if (this.reading) return;
		this.#settle();

		const page = this.pages.find((candidate) => candidate.id === id);
		if (page) URL.revokeObjectURL(page.url);
		this.pages = this.pages.filter((candidate) => candidate.id !== id);
	}

	/** One place up (-1) or down (+1): buttons rather than a drag, which a shaky hand cannot always do. */
	shift(id: number, delta: -1 | 1) {
		if (this.reading) return;
		const from = this.pages.findIndex((page) => page.id === id);
		const to = from + delta;
		if (from === -1 || to < 0 || to >= this.pages.length) return;

		this.#settle();
		this.pages = move(this.pages, from, to);
	}

	async read(): Promise<void> {
		const engine = ocrEngine();
		if (!engine || this.reading || this.pages.length === 0) return;

		const run = ++this.#run;
		const pages = [...this.pages];
		this.#dismissToast();
		this.status = 'reading';
		this.progress = 0;
		this.draft = null;
		this.#toast = toasts.progress(t('recipeScan.readingToast'));

		const advance = (ratio: number) => {
			if (run !== this.#run) return;
			this.progress = ratio;
			if (this.#toast !== null) toasts.setProgress(this.#toast, ratio);
		};

		const texts: string[] = [];
		try {
			for (const [index, page] of pages.entries()) {
				const text = await engine.recognize(page.file, {
					locale: i18n.locale,
					onProgress: (ratio) => advance(scanProgress(index, pages.length, ratio))
				});
				if (run !== this.#run) return;
				texts.push(text);
				advance(scanProgress(index + 1, pages.length, 0));
			}
		} catch {
			if (run !== this.#run) return;
			this.#dismissToast();
			this.status = 'failed';
			this.#toast = toasts.error(t('recipeScan.failedToast'));
			return;
		}

		this.#dismissToast();
		const recipe = structureRecipeText(texts);
		if (!recipe) {
			this.status = 'empty';
			this.#toast = toasts.error(t('recipeScan.emptyToast'));
			return;
		}

		this.draft = draftFromScan(recipe);
		this.status = 'ready';
		this.#toast = toasts.success(t('recipeScan.readyToast'), {
			label: t('recipeScan.open'),
			run: () => this.#openFromToast()
		});
	}

	/** Stops a reading: its result, when it comes, is thrown away. The pages stay, to try again. */
	cancel() {
		this.#run++;
		this.#dismissToast();
		this.status = 'idle';
		this.progress = 0;
	}

	/** The draft, once: taking it empties the list, so the next recipe starts from a blank page. */
	take(): RecipeDraft | null {
		const draft = this.draft;
		this.clear();
		return draft;
	}

	clear() {
		this.#run++;
		this.#dismissToast();
		for (const page of this.pages) URL.revokeObjectURL(page.url);
		this.pages = [];
		this.status = 'idle';
		this.progress = 0;
		this.draft = null;
	}

	/** A changed list makes the last result stale: the next reading starts from the pages as they are now. */
	#settle() {
		if (this.status === 'reading' || this.status === 'idle') return;
		this.#dismissToast();
		this.status = 'idle';
		this.draft = null;
	}

	#dismissToast() {
		if (this.#toast !== null) toasts.dismiss(this.#toast);
		this.#toast = null;
	}

	#openFromToast() {
		this.#toast = null;
		const draft = this.take();
		if (!draft) return;

		recipeDraft.offer(draft);
		void goto('/recipes');
	}
}

export const recipeScan = new RecipeScan();
