/**
 * Image loading retry configuration constants
 */
export const IMAGE_LOADING_CONFIG = {
	/** Maximum number of retry attempts */
	MAX_RETRIES: 5,
	/** Initial delay in milliseconds before first retry */
	INITIAL_DELAY: 100,
	/** Maximum delay in milliseconds between retries */
	MAX_DELAY: 5000,
	/** Total timeout in milliseconds for all retry attempts */
	TOTAL_TIMEOUT: 30000,
	/** Minimum image size in pixels */
	MIN_IMAGE_SIZE: 50,
} as const

/**
 * Intersection Observer configuration
 */
export const INTERSECTION_OBSERVER_CONFIG = {
	/** Visibility threshold (0-1) */
	THRESHOLD: 0.1,
	/** Root margin in pixels */
	ROOT_MARGIN: "50px",
	/** Viewport margin for initial check */
	VIEWPORT_MARGIN: 50,
} as const
