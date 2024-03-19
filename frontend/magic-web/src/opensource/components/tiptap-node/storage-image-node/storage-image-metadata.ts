/**
 * Storage image metadata utilities
 * Provides constants and helper functions for storage image nodes
 */

export interface StorageImageDimensions {
	width?: number | null
	height?: number | null
}

/**
 * Build markdown image size syntax
 * Format: =WxH or =Wx (height auto)
 * Examples: =300x200, =300x
 */
export function buildStorageImageTitle(dimensions: StorageImageDimensions): string {
	const { width, height } = dimensions

	if (!width) return ""

	// Format: =WxH or =Wx (height omitted means auto)
	const heightPart = height ? height.toString() : ""
	return ` =${width}x${heightPart}`
}

/**
 * Parse markdown image size syntax
 * Format: =WxH or =Wx (height auto)
 * Examples: =300x200, =300x
 */
export function parseStorageImageTitle(title: string | null): StorageImageDimensions {
	if (!title) {
		return {
			width: null,
			height: null,
		}
	}

	// Match format: =300x200 or =300x
	const sizeMatch = title.match(/=(\d+)x(\d*)/)

	if (sizeMatch) {
		const width = parseInt(sizeMatch[1], 10)
		// If height part exists and is not empty, parse it
		const height = sizeMatch[2] ? parseInt(sizeMatch[2], 10) : null

		return {
			width,
			height,
		}
	}

	return {
		width: null,
		height: null,
	}
}
