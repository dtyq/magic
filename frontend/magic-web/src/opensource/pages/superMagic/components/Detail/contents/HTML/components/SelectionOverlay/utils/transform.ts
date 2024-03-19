import type { ElementRect } from "../types"

/**
 * Transform iframe coordinates to viewport coordinates
 * For fixed positioning, we use viewport coordinates (relative to browser window)
 */
export function transformRect(
	rect: ElementRect,
	iframeRef: React.RefObject<HTMLIFrameElement>,
	isPptRender: boolean,
	scaleRatio: number,
): ElementRect {
	if (!iframeRef.current) return rect

	// Get iframe position relative to viewport (fixed positioning reference)
	const iframeRect = iframeRef.current.getBoundingClientRect()

	// For PPT mode, consider scale transforms
	if (isPptRender) {
		return {
			top: iframeRect.top + rect.top * scaleRatio,
			left: iframeRect.left + rect.left * scaleRatio,
			width: rect.width * scaleRatio,
			height: rect.height * scaleRatio,
		}
	}

	// For normal mode, just offset by iframe position in viewport
	return {
		top: iframeRect.top + rect.top,
		left: iframeRect.left + rect.left,
		width: rect.width,
		height: rect.height,
	}
}

/**
 * Calculate transform style for selected element (to match rotation)
 * With optimistic updates, infoRotation is kept up-to-date in real-time during rotation
 */
export function getSelectionBoxTransform(
	infoRotation: number,
	isMultiSelect: boolean,
	liveRotation: number,
	displayRotation: number,
): string | undefined {
	// Use the element's current rotation value (already optimistically updated)
	if (infoRotation === 0) return undefined

	// Apply rotation around the center of the bounding box
	return `rotate(${infoRotation}deg)`
}

/**
 * Normalize angle to 0-360 range for display
 */
export function normalizeAngle(angle: number): number {
	return ((angle % 360) + 360) % 360
}
