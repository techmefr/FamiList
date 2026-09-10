import type { ReportKind } from '$domain/bug-report';

/**
 * Le signalement en cours d'écriture.
 *
 * Il vit ici, hors de tout écran, pour une raison précise : le panneau doit pouvoir se réduire
 * sans rien perdre. Ce qu'on veut montrer est derrière lui — l'article qui s'affiche mal, le
 * message d'erreur, la liste qui a coincé — et le seul moyen d'en prendre une capture est de
 * ranger le formulaire le temps du geste. S'il vivait dans le composant, le réduire le
 * démonterait, et la description serait à retaper.
 */
class ReportStore {
	/** Le panneau existe (ouvert ou réduit). Fermé, il n'y a plus de brouillon du tout. */
	open = $state(false);

	/** Réduit : rangé en bas, l'écran redevient visible, le contenu saisi est conservé. */
	minimized = $state(false);

	kind = $state<ReportKind>('bug');

	/** L'écran d'où part le signalement. Noté pour ne pas avoir à demander « vous étiez où ? ». */
	path = $state('');

	description = $state('');
	screenshot = $state<string | null>(null);
	sent = $state(false);

	get hasDraft() {
		return this.description.trim() !== '' || this.screenshot !== null;
	}

	/**
	 * Ouvre le panneau depuis le menu d'aide.
	 *
	 * Un brouillon déjà commencé n'est pas écrasé : quelqu'un qui a réduit le panneau pour aller
	 * chercher sa capture, puis repasse par le menu d'aide au lieu du bouton « Reprendre »,
	 * retrouve ce qu'il écrivait. On ne change alors ni le type ni l'écran d'origine — ils
	 * appartiennent au signalement en cours.
	 */
	show(kind: ReportKind, path: string) {
		if (!this.hasDraft || this.sent) {
			this.kind = kind;
			this.path = path;
			this.description = '';
			this.screenshot = null;
			this.sent = false;
		}

		this.open = true;
		this.minimized = false;
	}

	minimize() {
		this.minimized = true;
	}

	restore() {
		this.minimized = false;
	}

	/** Ferme et oublie. C'est le seul chemin qui jette ce qui a été écrit. */
	close() {
		this.open = false;
		this.minimized = false;
		this.description = '';
		this.screenshot = null;
		this.sent = false;
	}
}

export const report = new ReportStore();
