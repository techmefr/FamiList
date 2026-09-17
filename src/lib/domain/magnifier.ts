/**
 * Magnifier: enlarging a product label on screen.
 *
 * Two magnifications combine. The lens's, when the camera accepts it, gives a sharp image; the
 * browser's, a plain enlargement of the image received, helps beyond that but blurs quickly. So we ask
 * the lens for everything it can do, and make up the rest.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

export interface ZoomRange {
	min: number;
	max: number;
}

/**
 * Guard shared by both computations. Internal: the slider already bounds the value through its min and
 * max attributes, nothing outside has any reason to bound it again.
 */
function clampZoom(value: number): number {
	if (!Number.isFinite(value)) return ZOOM_MIN;

	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

/** What the lens can really apply, never going outside what it declares it accepts. */
export function opticalZoom(requested: number, range: ZoomRange | null): number {
	if (!range || !(range.max > range.min)) return 1;

	return Math.min(range.max, Math.max(range.min, clampZoom(requested)));
}

/**
 * The rest of the way, left to the browser.
 *
 * The prototype added a fixed supplement here, independent of what the lens had granted: on a device
 * whose zoom stops at 2x, asking for 5x barely enlarged anything. The ratio between the two gives the
 * requested magnification instead, whatever the device.
 */
export function digitalZoom(requested: number, applied: number): number {
	const target = clampZoom(requested);

	return applied > 0 ? Math.max(1, target / applied) : target;
}

/**
 * The pinch: two fingers moving apart magnify in the same ratio as their spread.
 *
 * We start again from the spread and the magnification recorded when the second finger landed, and not
 * from the previous movement. Accumulating successive ratios makes the result drift as soon as a finger
 * jumps from one event to the next, and the magnifier then starts magnifying on its own.
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
 * The point of the image being looked at, in fractions of what was visible before magnifying: 0.5 / 0.5
 * is the centre, 0 / 0 the corner where reading starts.
 */
export type Focus = Point;

export const CENTER: Focus = { x: 0.5, y: 0.5 };

/**
 * Panning is bounded to what was already on screen at the moment the image was frozen.
 *
 * That is the constraint that matters most here: someone who sees badly cannot orient themselves on a
 * black band. As long as the magnified window stays entirely inside the image, there is no empty edge to
 * reach, and releasing the finger too far does nothing rather than losing everything.
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
 * Where we are looking after dragging the finger by `drag` pixels.
 *
 * The image follows the finger, so the point being looked at goes the other way. The travel is divided by
 * the magnification: at 5x, a centimetre of finger only crosses a fifth of the label, otherwise the
 * slightest tremble sends you to the other end.
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
 * The portion of the captured frame to redraw in order to fill the screen.
 *
 * This is the heart of it: enlarging an already drawn image only stretches its pixels, whereas the
 * captured frame is far finer than the screen. By re-cropping inside it, we gain detail instead of losing
 * it, as long as the camera has some to give.
 *
 * The reference is the area visible at rest, not the whole frame: the image is displayed with
 * `object-cover`, so cropped on one side. Panning must not reveal what was never seen — you find exactly
 * what you had in front of you when freezing.
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
 * What we apply to the image to make it readable, as a single CSS filter.
 *
 * Two different needs, and they add up. Without a hardware torch, we brighten the image received: it is
 * not real lighting, but on a matt, slightly grey label it is often enough to lift the text off the
 * background. Contrast mode, on the other hand, serves when the text is printed in light grey on white,
 * or in colour on a photo: we remove the colour, which carries no information here, and push the
 * remaining greys apart.
 *
 * The two contrasts do not stack — the torch's is overridden by the mode's, which is stronger. Together
 * they filled in the blacks and ate the descenders.
 *
 * Assembled here rather than in the markup: two states that combine are exactly what ends up written
 * wrong in a string interpolation.
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
