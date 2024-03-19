import type { SlideItem } from "../PPTSidebar/types"

/**
 * Build SlideItem array from slides paths and file URL mapping
 * @param slidesPaths - Array of slide paths from magic.project.js
 * @param fileUrlMapping - Map of file path/name to download URL
 * @param slideTitles - Optional array of slide titles
 * @returns Array of SlideItem objects
 */
export function buildSlideItems({
	slidesPaths,
	fileUrlMapping,
	slideTitles,
}: {
	slidesPaths: string[]
	fileUrlMapping: Map<string, string>
	slideTitles?: string[]
}): SlideItem[] {
	return slidesPaths.map((path, index) => {
		// Try to find URL from mapping
		// The mapping key might be the full path or just the filename
		let url: string | undefined

		// Try exact path match first
		url = fileUrlMapping.get(path)

		// If not found, try to match by filename
		if (!url) {
			const filename = path.split("/").pop() || ""
			for (const [key, value] of fileUrlMapping.entries()) {
				if (key.endsWith(filename)) {
					url = value
					break
				}
			}
		}

		return {
			id: `slide-${index}`,
			path,
			url,
			index,
			title: slideTitles?.[index],
		}
	})
}

/**
 * Extract slide title from HTML content
 * Looks for <title> tag or first <h1> tag
 * @param htmlContent - HTML content string
 * @param defaultTitle - Default title if not found
 * @returns Extracted title
 */
export function extractSlideTitle(htmlContent: string, defaultTitle: string): string {
	// Try to extract from <title> tag
	const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i)
	if (titleMatch && titleMatch[1]) {
		return titleMatch[1].trim()
	}

	// Try to extract from first <h1> tag
	const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i)
	if (h1Match && h1Match[1]) {
		// Remove HTML tags from h1 content
		return h1Match[1].replace(/<[^>]*>/g, "").trim()
	}

	return defaultTitle
}

/**
 * Batch extract slide titles from HTML contents
 * @param slideContents - Map of slide index to HTML content
 * @returns Array of slide titles
 */
export function extractSlideTitles(slideContents: Map<number, string>): string[] {
	const titles: string[] = []
	slideContents.forEach((content, index) => {
		const title = extractSlideTitle(content, `Slide ${index + 1}`)
		titles[index] = title
	})
	return titles
}
