/**
 * SVG Content Processor Utility
 * Handles various SVG formats and prevents URI malformed errors
 * Shared utility for both desktop and mobile platforms
 */

export interface SvgProcessResult {
	content: string
	isValid: boolean
	error?: string
}

/**
 * Safely process SVG content from various sources
 * @param src - SVG source (data URL, raw SVG, or file URL)
 * @returns Processed SVG content and validation status
 */
export function processSvgContent(src: string): SvgProcessResult {
	try {
		// Handle data URLs
		if (src.startsWith("data:image/svg+xml")) {
			return processDataUrl(src)
		}

		// Handle raw SVG content
		if (src.trim().startsWith("<svg")) {
			return processSvgString(src)
		}

		// Handle file URLs ending with .svg
		if (src.endsWith(".svg")) {
			return {
				content: src,
				isValid: true,
			}
		}

		// For any other content, treat as non-SVG
		return {
			content: src,
			isValid: false,
			error: "Content is not recognized as SVG format",
		}
	} catch (error) {
		return {
			content: src,
			isValid: false,
			error: error instanceof Error ? error.message : "Unknown error",
		}
	}
}

/**
 * Process SVG data URLs (base64 or URL-encoded)
 */
function processDataUrl(src: string): SvgProcessResult {
	try {
		const [header, content] = src.split(",")
		if (!content) {
			throw new Error("Invalid data URL format")
		}

		// Check if it's base64 encoded
		const isBase64 = header.includes("base64")

		if (isBase64) {
			try {
				const decodedContent = atob(content)
				return processSvgString(decodedContent)
			} catch (e) {
				throw new Error("Failed to decode base64 content")
			}
		} else {
			// URL-encoded content
			try {
				const decodedContent = decodeURIComponent(content)
				return processSvgString(decodedContent)
			} catch (e) {
				throw new Error("Failed to decode URL-encoded content")
			}
		}
	} catch (error) {
		return {
			content: src,
			isValid: false,
			error: error instanceof Error ? error.message : "Data URL processing failed",
		}
	}
}

/**
 * Process and validate raw SVG string content
 */
function processSvgString(svgContent: string): SvgProcessResult {
	try {
		// Basic SVG validation
		const trimmedContent = svgContent.trim()

		if (!trimmedContent.startsWith("<svg")) {
			throw new Error("Invalid SVG format - must start with <svg>")
		}

		if (!trimmedContent.includes("</svg>")) {
			throw new Error("Invalid SVG format - missing closing </svg> tag")
		}

		// Clean up potentially problematic characters
		const cleanedContent = cleanSvgContent(trimmedContent)

		return {
			content: cleanedContent,
			isValid: true,
		}
	} catch (error) {
		return {
			content: svgContent,
			isValid: false,
			error: error instanceof Error ? error.message : "SVG string processing failed",
		}
	}
}

/**
 * Clean SVG content to prevent URI and rendering issues
 */
function cleanSvgContent(svgContent: string): string {
	// Remove problematic characters that might cause URI issues
	let cleaned = svgContent

	// Fix common URI encoding issues in SVG
	try {
		// Replace problematic URL characters in href attributes
		cleaned = cleaned.replace(/href="([^"]*[%][^"]*)*"/g, (match, url) => {
			try {
				const decodedUrl = decodeURIComponent(url)
				return `href="${decodedUrl}"`
			} catch {
				// If decoding fails, return original
				return match
			}
		})

		// Similar treatment for xlink:href
		cleaned = cleaned.replace(/xlink:href="([^"]*[%][^"]*)*"/g, (match, url) => {
			try {
				const decodedUrl = decodeURIComponent(url)
				return `xlink:href="${decodedUrl}"`
			} catch {
				return match
			}
		})
	} catch (error) {
		console.warn("Error cleaning SVG content:", error)
	}

	return cleaned
}

/**
 * Check if a string is likely an SVG based on content or extension
 */
export function isSvgContent(src: string, fileExtension?: string): boolean {
	// Check file extension first - this takes highest priority
	if (fileExtension) {
		return fileExtension === "svg" || fileExtension === "svg+xml"
	}

	// If no file extension provided, check content patterns
	// Check data URL
	if (src.startsWith("data:image/svg+xml")) {
		return true
	}

	// Check file extension in URL
	if (src.endsWith(".svg")) {
		return true
	}

	// Check raw SVG content
	if (src.trim().startsWith("<svg")) {
		return true
	}

	return false
}
