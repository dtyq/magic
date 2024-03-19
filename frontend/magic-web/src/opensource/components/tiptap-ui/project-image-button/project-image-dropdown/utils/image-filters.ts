import type { ImageAttachment } from "../types"

/**
 * Supported image file extensions
 */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"] as const

/**
 * Check if a file extension is an image
 * @param extension - File extension (without dot)
 * @returns true if the extension is an image format
 */
export function isImageExtension(extension: string): boolean {
	const normalizedExt = extension.toLowerCase().replace(/^\./, "")
	return IMAGE_EXTENSIONS.includes(normalizedExt as any)
}

/**
 * Filter attachments to only include images
 * @param attachments - List of attachments
 * @returns Filtered list containing only images
 */
export function filterImageAttachments(attachments: any[]): ImageAttachment[] {
	return attachments.filter((item) => {
		if (!item.file_extension) return false
		return isImageExtension(item.file_extension)
	})
}
