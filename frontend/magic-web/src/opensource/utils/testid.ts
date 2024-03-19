/**
 * Normalize dynamic values to safe test id segments.
 * Keep output stable and kebab-case for reliable selectors.
 */
export const toTestIdSegment = (
	value: string | number | null | undefined,
	fallback = "unknown",
): string => {
	const normalized = String(value ?? fallback)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")

	return normalized || fallback
}
