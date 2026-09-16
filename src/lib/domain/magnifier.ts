/**
 * Loupe : agrandir une étiquette de produit à l'écran.
 *
 * Deux grossissements se combinent. Celui de l'objectif, quand l'appareil photo l'accepte, donne
 * une image nette ; celui du navigateur, un simple agrandissement de l'image reçue, dépanne au-delà
 * mais devient vite flou. On demande donc à l'objectif tout ce qu'il sait faire, et on complète.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

export interface ZoomRange {
	min: number;
	max: number;
}

/**
 * Garde-fou commun aux deux calculs. Interne : le curseur borne déjà la valeur par ses attributs
 * min et max, plus rien à l'extérieur n'a de raison de reborner.
 */
function clampZoom(value: number): number {
	if (!Number.isFinite(value)) return ZOOM_MIN;

	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

/** Ce que l'objectif peut réellement appliquer, sans jamais sortir de ce qu'il déclare accepter. */
export function opticalZoom(requested: number, range: ZoomRange | null): number {
	if (!range || !(range.max > range.min)) return 1;

	return Math.min(range.max, Math.max(range.min, clampZoom(requested)));
}

/**
 * Le reste du chemin, à la charge du navigateur.
 *
 * Le prototype ajoutait ici un supplément fixe, indépendant de ce que l'objectif avait accordé :
 * sur un appareil dont le zoom s'arrête à 2×, demander 5× n'agrandissait presque plus rien. Le
 * rapport entre les deux donne à l'inverse le grossissement demandé, quel que soit l'appareil.
 */
export function digitalZoom(requested: number, applied: number): number {
	const target = clampZoom(requested);

	return applied > 0 ? Math.max(1, target / applied) : target;
}

/**
 * Le pincement : deux doigts qui s'écartent grossissent dans le même rapport que leur écartement.
 *
 * On repart de l'écartement et du grossissement relevés au moment où le deuxième doigt s'est
 * posé, et non du précédent mouvement. Cumuler des rapports successifs fait dériver le résultat
 * dès qu'un doigt saute d'un événement à l'autre, et la loupe se met alors à grossir toute seule.
 */
export function pinchDistance(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pinchZoom(baseZoom: number, baseDistance: number, distance: number): number {
	if (!(baseDistance > 0) || !Number.isFinite(distance)) return clampZoom(baseZoom);

	return clampZoom(baseZoom * (distance / baseDistance));
}

export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

/**
 * Le point de l'image qu'on regarde, en fractions de ce qui était visible avant de grossir :
 * 0,5 / 0,5 est le centre, 0 / 0 le coin où commence la lecture.
 */
export type Focus = Point;

export const CENTER: Focus = { x: 0.5, y: 0.5 };

/**
 * Le déplacement est borné à ce qui était déjà à l'écran au moment où l'image a été figée.
 *
 * C'est la contrainte qui compte le plus ici : quelqu'un qui voit mal ne peut pas se repérer sur
 * une bande noire. Tant que la fenêtre agrandie reste entièrement dans l'image, il n'y a aucun
 * bord vide à atteindre, et lâcher le doigt trop loin ne fait rien plutôt que de tout perdre.
 */
export function clampFocus(focus: Focus, scale: number): Focus {
	if (!(scale > 1)) return CENTER;

	const half = 1 / (2 * scale);

	return { x: clampAxis(focus.x, half), y: clampAxis(focus.y, half) };
}

function clampAxis(value: number, half: number): number {
	if (!Number.isFinite(value)) return 0.5;

	return Math.min(1 - half, Math.max(half, value));
}

/**
 * Où l'on regarde après avoir traîné le doigt de `drag` pixels.
 *
 * L'image suit le doigt, donc le point regardé va à l'inverse. La course est divisée par le
 * grossissement : à 5×, un centimètre de doigt ne parcourt qu'un cinquième de l'étiquette, sinon
 * le moindre tremblement envoie à l'autre bout.
 */
export function panFocus(focus: Focus, drag: Point, view: Size, scale: number): Focus {
	if (!(view.width > 0) || !(view.height > 0)) return clampFocus(focus, scale);

	return clampFocus(
		{
			x: focus.x - drag.x / (view.width * scale),
			y: focus.y - drag.y / (view.height * scale)
		},
		scale
	);
}

/**
 * La portion de la trame capturée à redessiner pour remplir l'écran.
 *
 * C'est le cœur de l'affaire : agrandir une image déjà dessinée ne fait qu'étaler ses pixels,
 * alors que la trame capturée est bien plus fine que l'écran. En redécoupant dedans, on gagne du
 * détail au lieu d'en perdre, tant que la caméra en a à donner.
 *
 * Le repère est la zone visible au repos, pas la trame entière : l'image est affichée en
 * `object-cover`, donc rognée sur un côté. Se déplacer ne doit pas révéler ce qu'on n'avait
 * jamais vu — on retrouve exactement ce qu'on avait sous les yeux en figeant.
 */
export function visibleSource(source: Size, view: Size, focus: Focus, scale: number) {
	const cover = coverSize(source, view);
	const factor = Math.max(1, Number.isFinite(scale) ? scale : 1);
	const width = cover.width / factor;
	const height = cover.height / factor;
	const centre = clampFocus(focus, factor);

	return {
		x: (source.width - cover.width) / 2 + centre.x * cover.width - width / 2,
		y: (source.height - cover.height) / 2 + centre.y * cover.height - height / 2,
		width,
		height
	};
}

function coverSize(source: Size, view: Size): Size {
	if (!(source.width > 0) || !(source.height > 0) || !(view.width > 0) || !(view.height > 0)) {
		return { width: Math.max(0, source.width), height: Math.max(0, source.height) };
	}

	const ratio = view.width / view.height;

	if (source.width / source.height > ratio) {
		return { width: source.height * ratio, height: source.height };
	}

	return { width: source.width, height: source.width / ratio };
}

/**
 * Ce qu'on applique à l'image pour la rendre lisible, en un seul filtre CSS.
 *
 * Deux besoins différents, et qui se cumulent. Sans torche matérielle, on éclaircit l'image
 * reçue : ce n'est pas un vrai éclairage, mais sur une étiquette mate un peu grise, cela suffit
 * souvent à décoller le texte du fond. Le mode contraste, lui, sert quand le texte est imprimé
 * en gris clair sur fond blanc, ou en couleur sur une photo : on retire la couleur, qui ne porte
 * ici aucune information, et on écarte les gris restants.
 *
 * Les deux contrastes ne s'empilent pas — celui de la torche est écrasé par celui du mode, qui
 * est plus fort. Cumulés, ils bouchaient les noirs et mangeaient les jambages.
 *
 * Assemblé ici plutôt que dans le balisage : deux états qui se combinent, c'est exactement ce
 * qu'on finit par écrire de travers dans une interpolation de chaîne.
 */
export interface ReadingAids {
	contrast: boolean;
	brighten: boolean;
}

export function viewFilter({ contrast, brighten }: ReadingAids): string {
	const filters: string[] = [];

	if (brighten) filters.push('brightness(1.35)');
	if (contrast) filters.push('grayscale(1)', 'contrast(1.9)');
	else if (brighten) filters.push('contrast(1.05)');

	return filters.length > 0 ? filters.join(' ') : 'none';
}
