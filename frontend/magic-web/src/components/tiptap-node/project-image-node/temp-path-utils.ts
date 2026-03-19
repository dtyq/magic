/**
 * Temporary path utilities for project image uploads
 * Provides consistent handling of temporary image paths during upload process
 */

/**
 * Prefix used for temporary image paths during upload
 * Format: temp_{timestamp}_{random}/${fileName}
 */
export const TEMP_PATH_PREFIX = "temp_"

/**
 * Check if a path is a temporary upload path
 * @param path - The path to check
 * @returns true if the path is a temporary upload path
 */
export function isTempPath(path: string | null | undefined): path is string {
	if (!path) return false
	return path.startsWith(TEMP_PATH_PREFIX)
}

/**
 * Generate a temporary src for uploading images
 * @param fileName - The name of the file being uploaded
 * @returns A unique temporary path
 */
export function generateTempSrc(fileName: string): string {
	const timestamp = Date.now()
	const randomId = Math.random().toString(36).substring(2, 11)
	return `${TEMP_PATH_PREFIX}${timestamp}_${randomId}/${fileName}`
}

/**
 * Extract the original file name from a temporary path
 * @param tempPath - The temporary path
 * @returns The original file name, or null if not a valid temp path
 */
export function extractFileNameFromTempPath(tempPath: string): string | null {
	if (!isTempPath(tempPath)) return null

	// Valid temp path must contain at least one slash (temp_{id}/{fileName})
	if (!tempPath.includes("/")) return null

	const parts = tempPath.split("/")
	const fileName = parts[parts.length - 1]

	// Return null if no file name found or if it's empty
	return fileName && fileName.trim() ? fileName : null
}
