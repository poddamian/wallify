/**
 * AR Math Utilities
 *
 * Converts real-world canvas dimensions (in cm) to on-screen pixel sizes.
 *
 * Assumptions:
 *  - Average viewing distance ≈ 2.5 m (e.g. user pointing phone at wall)
 *  - Screen pixel density varies; CM_TO_PX_RATIO is a tunable constant
 *  - Production implementations should use device sensors or distance sliders
 *    for more accurate depth estimation.
 */

/** Base scale: 1 cm in the real world → this many pixels on screen */
export const CM_TO_PX_RATIO = 5.8;

/** Convert cm to pixels using the base ratio and an optional scale multiplier */
export function cmToPx(cm: number, scaleFactor = 1): number {
    return Math.round(cm * CM_TO_PX_RATIO * scaleFactor);
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the overlay dimensions from a CanvasSize object.
 * Returns pixel width and height for use in inline styles.
 */
export function getOverlayDimensions(
    widthCm: number,
    heightCm: number,
    scaleFactor = 1
): { widthPx: number; heightPx: number } {
    return {
        widthPx: cmToPx(widthCm, scaleFactor),
        heightPx: cmToPx(heightCm, scaleFactor),
    };
}
