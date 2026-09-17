/**
 * The capture attached to a bug report only needs to be readable, not to stay at its original resolution: a
 * phone screenshot weighs several megabytes, and the `bug_reports` migration caps the column at 1.5 MB of
 * base64 text.
 */

/** Beyond this, the longest side of the image is resized before encoding. */
export const SCREENSHOT_MAX_DIM = 1280;

/** Beyond this, we refuse the file before even decoding it: that is not a screenshot. */
export const SCREENSHOT_MAX_BYTES = 15 * 1024 * 1024;

/**
 * The dimensions to give an image so that it fits within `maxDim` on its longest side, without distorting
 * it. An image already smaller must not be enlarged — better keep it as it is than introduce blur.
 */
export function fitWithin(width: number, height: number, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
