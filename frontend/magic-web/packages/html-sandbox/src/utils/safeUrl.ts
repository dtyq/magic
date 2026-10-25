const ALLOWED_HREF_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])
const FALLBACK_BASE_URL = "http://sandbox.invalid/"

function normalizeHrefValue(value: string): string {
	return value.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
}

/**
 * Validates editable anchor URLs at the DOM write boundary.
 * Relative URLs are resolved against the current document, while executable
 * and embedded-data schemes are rejected explicitly.
 */
export function isSafeHref(value: string, baseUrl?: string): boolean {
	const normalizedValue = normalizeHrefValue(value)
	if (!normalizedValue) return true
	const explicitProtocol = normalizedValue.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]
	if (!explicitProtocol) return true

	try {
		const parsedUrl = new URL(
			normalizedValue,
			baseUrl ?? (typeof document === "undefined" ? FALLBACK_BASE_URL : document.baseURI),
		)
		return ALLOWED_HREF_PROTOCOLS.has(parsedUrl.protocol)
	} catch {
		return false
	}
}

export function normalizeSafeHref(value: string | null): string | null {
	if (value === null) return null
	const normalizedValue = normalizeHrefValue(value)
	if (!normalizedValue) return null
	if (!isSafeHref(normalizedValue)) {
		throw new Error("Unsafe href URL protocol")
	}
	return normalizedValue
}
