/**
 * Transform utility functions for image manipulation
 */

export interface TransformState {
	scale: number
	translateX: number
	translateY: number
}

/**
 * Apply transform to an HTML element
 */
export function applyTransform(element: HTMLElement | null, transform: TransformState): void {
	if (!element) return

	const { scale, translateX, translateY } = transform
	const transformString = `scale(${scale}) translate(${translateX}px, ${translateY}px)`
	element.style.transform = transformString
}

/**
 * Apply animated transform to an HTML element
 */
export function applyAnimatedTransform(
	element: HTMLElement | null,
	transform: TransformState,
	duration: number = 200,
	easing: string = "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
): void {
	if (!element) return

	const { scale, translateX, translateY } = transform

	// Apply transition
	element.style.transition = `transform ${duration}ms ${easing}`
	element.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`

	// Remove transition after animation completes
	setTimeout(() => {
		if (element) {
			element.style.transition = "none"
		}
	}, duration)
}

/**
 * Reset transform to default state
 */
export function resetTransform(element: HTMLElement | null): void {
	if (!element) return

	element.style.transition = "none"
	element.style.transform = "scale(1) translate(0px, 0px)"
}

/**
 * Calculate boundary constraints for a scaled image
 */
export function calculateBoundaryConstraints(
	imageElement: HTMLElement | null,
	containerElement: HTMLElement | null,
	currentTransform: TransformState,
): { maxTranslateX: number; maxTranslateY: number } {
	if (!imageElement || !containerElement) {
		return { maxTranslateX: 0, maxTranslateY: 0 }
	}

	const imageRect = imageElement.getBoundingClientRect()
	const containerRect = containerElement.getBoundingClientRect()
	const { scale } = currentTransform

	// Calculate image dimensions at current scale
	const scaledWidth = imageRect.width
	const scaledHeight = imageRect.height

	// Calculate max translation bounds
	const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2 / scale)
	const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2 / scale)

	return { maxTranslateX, maxTranslateY }
}

/**
 * Constrain transform within boundaries
 */
export function constrainTransform(
	transform: TransformState,
	bounds: { maxTranslateX: number; maxTranslateY: number },
): TransformState {
	const { scale, translateX, translateY } = transform
	const { maxTranslateX, maxTranslateY } = bounds

	return {
		scale,
		translateX: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
		translateY: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY)),
	}
}

/**
 * Get default transform state
 */
export function getDefaultTransform(): TransformState {
	return {
		scale: 1,
		translateX: 0,
		translateY: 0,
	}
}
