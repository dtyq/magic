/**
 * Utilities for Markdown content processing
 * Re-exports common utilities from shared image-url-resolver module
 */

// Export shared utilities from image-url-resolver
export {
	parseImageSize,
	normalizeImagePath,
	findFileByPath,
	resolveRelativePath,
	buildImageUrlMapEntries,
	extractImagePaths,
	isExternalUrl,
	processMarkdownImages,
	resolveSingleImageUrl,
} from "@/opensource/pages/superMagic/utils/image-url-resolver"

// Export types
export type {
	AttachmentFile,
	ResolvedImageData,
	ImageUrlMap,
} from "@/opensource/pages/superMagic/utils/image-url-resolver"

/**
 * Recursively find a file in the attachment tree by file name
 * Legacy function for backward compatibility
 *
 * @param items - Array of attachment files
 * @param fileName - The file name to search for
 * @returns The matched file or null if not found
 */
export function findFileByName(
	items: Array<{
		file_id: string
		file_name: string
		is_directory?: boolean
		children?: any[]
		relative_file_path?: string
	}>,
	fileName: string,
): any | null {
	if (!Array.isArray(items) || items.length === 0) {
		return null
	}

	for (const item of items) {
		// Recursively search in directories
		if (item.is_directory && item.children) {
			const found = findFileByName(item.children, fileName)
			if (found) return found
		}
		// Check if the file name matches
		else if (item.file_name === fileName || fileName.startsWith(item.file_name)) {
			return item
		}
	}

	return null
}

/**
 * Extract file name from image URL (removing size syntax)
 *
 * @param imgUrl - Image URL with optional size syntax (e.g., "./images/file.png =300x200")
 * @returns File name without path and size syntax
 *
 * @example
 * extractFileName("./images/file.png =300x200") // returns "file.png"
 * extractFileName("../folder/photo.jpg =300x") // returns "photo.jpg"
 */
export function extractFileName(imgUrl: string): string {
	// Remove size syntax first (e.g., " =300x200")
	const urlWithoutSize = imgUrl.split(" ")[0]
	// Extract the file name from path
	const pathParts = urlWithoutSize.split("/")
	return pathParts[pathParts.length - 1]
}
