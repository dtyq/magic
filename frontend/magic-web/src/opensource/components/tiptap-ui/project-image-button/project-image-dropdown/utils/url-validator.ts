/**
 * Validate if a URL is a valid http or https URL
 * @param url - The URL string to validate
 * @returns true if the URL is valid http/https URL, false otherwise
 */
export function isValidImageUrl(url: string): boolean {
	if (!url.trim()) return false

	try {
		const urlObj = new URL(url)
		return urlObj.protocol === "http:" || urlObj.protocol === "https:"
	} catch {
		return false
	}
}
