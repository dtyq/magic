/**
 * Touch utility functions for gesture recognition
 */

export interface TouchPoint {
	x: number
	y: number
}

/**
 * Get distance between two fingers
 */
export function getTouchDistance(touches: TouchList): number {
	if (touches.length < 2) return 0

	const touch1 = touches[0]
	const touch2 = touches[1]

	return Math.sqrt(
		Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
	)
}

/**
 * Get center point between two fingers
 */
export function getTouchCenter(touches: TouchList): TouchPoint {
	if (touches.length < 2) {
		return {
			x: touches[0]?.clientX || 0,
			y: touches[0]?.clientY || 0,
		}
	}

	const touch1 = touches[0]
	const touch2 = touches[1]

	return {
		x: (touch1.clientX + touch2.clientX) / 2,
		y: (touch1.clientY + touch2.clientY) / 2,
	}
}

/**
 * Check if two touches form a double tap
 */
export function isDoubleTap(lastTapTime: number, threshold: number = 300): boolean {
	const now = Date.now()
	return now - lastTapTime < threshold
}

/**
 * Calculate scale change between current and previous touch distance
 */
export function getScaleChange(currentDistance: number, previousDistance: number): number {
	if (previousDistance <= 0) return 1
	return currentDistance / previousDistance
}

/**
 * Constrain a value within min and max bounds
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}
