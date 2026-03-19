/**
 * Normalizes file type by removing dots and converting to lowercase
 */
export function normalizeFiletype(value?: string): string | undefined {
	if (!value) return undefined
	return value.replace(/^[.]/, "").toLowerCase()
}

/**
 * Gets display text for file type icon
 * Returns common abbreviations or truncated extension
 */
export function getDisplayText(filetype?: string): string {
	if (!filetype) return "?"

	// For common file types, show recognizable abbreviations
	const commonTypes: Record<string, string> = {
		py: "python",
		webm: "WebM",
	}

	// Return predefined abbreviation or first 4 characters of extension
	return commonTypes[filetype] || filetype.slice(0, 4).toUpperCase()
}
