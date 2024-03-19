/**
 * Generate GitHub-style slug from heading text
 * Rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep letters, numbers, hyphens, underscores, CJK characters)
 * - Handle duplicate IDs by adding numeric suffix
 */

/**
 * Convert a string to a GitHub-style slug
 * @param text - The text to convert
 * @returns The slugified text
 */
export function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			// Replace spaces with hyphens
			.replace(/\s+/g, "-")
			// Remove special characters, keeping letters, numbers, hyphens, underscores, and CJK characters
			// \u4e00-\u9fff: CJK Unified Ideographs
			// \u3040-\u309f: Hiragana
			// \u30a0-\u30ff: Katakana
			// \uac00-\ud7af: Hangul
			.replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af-]/g, "")
			// Remove leading/trailing hyphens
			.replace(/^-+|-+$/g, "")
			// Replace multiple consecutive hyphens with single hyphen
			.replace(/-+/g, "-")
	)
}

/**
 * Generate a unique slug by adding a numeric suffix if needed
 * @param text - The text to convert
 * @param existingIds - Set of existing IDs to check against
 * @returns A unique slug
 */
export function generateUniqueSlug(text: string, existingIds: Set<string>): string {
	const baseSlug = slugify(text)

	if (!baseSlug) {
		return ""
	}

	// If the base slug is unique, return it
	if (!existingIds.has(baseSlug)) {
		existingIds.add(baseSlug)
		return baseSlug
	}

	// Otherwise, add a numeric suffix
	let counter = 1
	let uniqueSlug = `${baseSlug}-${counter}`

	while (existingIds.has(uniqueSlug)) {
		counter++
		uniqueSlug = `${baseSlug}-${counter}`
	}

	existingIds.add(uniqueSlug)
	return uniqueSlug
}

/**
 * Find the scrollable container for an element
 * Walks up the DOM tree to find the first scrollable parent
 * @param element - The element to find the scrollable container for
 * @returns The scrollable container or null if none found
 */
function findScrollableContainer(element: HTMLElement): HTMLElement | null {
	let current: HTMLElement | null = element.parentElement

	while (current && current !== document.body) {
		const overflowY = window.getComputedStyle(current).overflowY
		const isScrollable = overflowY === "auto" || overflowY === "scroll"

		// Check if the element actually has scrollable content
		if (isScrollable && current.scrollHeight > current.clientHeight) {
			return current
		}

		current = current.parentElement
	}

	// If no scrollable container found, return document.documentElement (for window scroll)
	return document.documentElement
}

/**
 * Scroll to an element by its ID with smooth behavior
 * Automatically detects the correct scrolling container (e.g., markdown editor container)
 * @param elementId - The ID of the element to scroll to
 * @param offset - Optional offset from the top (for fixed headers)
 * @returns true if element was found and scrolled to, false otherwise
 */
export function scrollToAnchor(elementId: string, offset = 0): boolean {
	const element = document.getElementById(elementId)

	if (!element) {
		return false
	}

	// Find the scrollable container
	const scrollContainer = findScrollableContainer(element)

	if (!scrollContainer) {
		return false
	}

	// Calculate scroll position
	if (scrollContainer === document.documentElement) {
		// Scrolling the window
		const elementPosition = element.getBoundingClientRect().top
		const offsetPosition = elementPosition + window.pageYOffset - offset

		window.scrollTo({
			top: offsetPosition,
			behavior: "smooth",
		})
	} else {
		// Scrolling within a container
		const containerRect = scrollContainer.getBoundingClientRect()
		const elementRect = element.getBoundingClientRect()

		// Calculate the position relative to the container
		const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop - offset

		scrollContainer.scrollTo({
			top: relativeTop,
			behavior: "smooth",
		})
	}

	return true
}

/**
 * Parse a link href to extract file path and anchor
 * @param href - The link href
 * @returns Object with filePath and slugified anchor (without #, decoded and normalized)
 */
export function parseAnchorLink(href: string): { filePath: string; anchor: string } {
	const hashIndex = href.indexOf("#")

	if (hashIndex === -1) {
		return { filePath: href, anchor: "" }
	}

	const rawAnchor = href.substring(hashIndex + 1)

	// Decode URL-encoded anchor (e.g., %E7%AC%94 -> 第)
	// This handles cases where markdown/HTML encodes special characters
	let decodedAnchor = rawAnchor
	try {
		decodedAnchor = decodeURIComponent(rawAnchor)
	} catch (error) {
		// If decoding fails, use the raw anchor
		console.warn("Failed to decode anchor:", rawAnchor, error)
	}

	// Apply slugify to ensure anchor matches the generated element IDs
	// This is critical because element IDs are created using slugify()
	const normalizedAnchor = slugify(decodedAnchor)

	return {
		filePath: href.substring(0, hashIndex),
		anchor: normalizedAnchor,
	}
}
