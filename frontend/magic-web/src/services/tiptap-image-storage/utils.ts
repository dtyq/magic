import { ImageValidationError } from "./errors"

/**
 * Validate an image file against size and type constraints
 * @param file - The file to validate
 * @param maxSize - Maximum allowed file size in bytes
 * @throws {ImageValidationError} If validation fails
 */
export function validateImageFile(file: File, maxSize: number): void {
	if (!file.type.startsWith("image/")) {
		throw new ImageValidationError("File is not an image")
	}

	if (file.size > maxSize) {
		throw new ImageValidationError(`File too large: ${file.size} > ${maxSize}`)
	}

	if (file.size === 0) {
		throw new ImageValidationError("File is empty")
	}
}

/**
 * Safely revoke an object URL
 * @param url - The object URL to revoke
 */
export function revokeImageUrl(url: string): void {
	try {
		URL.revokeObjectURL(url)
	} catch (error) {
		console.error("Failed to revoke URL:", error)
	}
}

/**
 * Check if a string is a valid image ID
 * @param id - The ID to validate
 * @returns True if the ID is valid
 */
export function isValidImageId(id: string): boolean {
	return typeof id === "string" && id.length > 0
}

/**
 * Normalize image file name by removing spaces and brackets (both English and Chinese)
 * @param fileName - The original file name
 * @returns Normalized file name without spaces and brackets
 * @example
 * normalizeImageName("image (1).png") // "image1.png"
 * normalizeImageName("图片（副本）.jpg") // "图片副本.jpg"
 * normalizeImageName("my photo (copy).png") // "myphoto copy.png"
 */
export function normalizeImageName(fileName: string): string {
	return fileName
		.replace(/[\s()（）]/g, "") // Remove spaces and brackets (English and Chinese)
		.replace(/^\.+/, "") // Remove leading dots
		.replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
}
