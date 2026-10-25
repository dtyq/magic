export type QueryScalar = string | number | boolean | null | undefined
export type QueryParams = Readonly<Record<string, QueryScalar | readonly QueryScalar[]>>

/**
 * Append query params using the backend's repeated `key[]` array convention.
 * Nullish values (including array items) and empty arrays are omitted;
 * empty strings, zero and false are preserved. Existing keys are appended to,
 * not overwritten. Object values are ignored; non-finite numbers are rejected.
 */
export function appendQueryParams(url: string, params?: QueryParams): string {
	if (!params) return url

	const query = new URLSearchParams()
	const append = (key: string, value: unknown) => {
		if (value === null || value === undefined) return
		// Legacy APIs can contain object-valued filters whose wire format is undecided.
		// Omit them defensively rather than sending [object Object] or blocking the request.
		if (typeof value === "object") return
		// Invalid primitives still fail before transport rather than silently sending NaN.
		if (
			(typeof value !== "string" &&
				typeof value !== "number" &&
				typeof value !== "boolean") ||
			(typeof value === "number" && !Number.isFinite(value))
		) {
			throw new TypeError(`Invalid query parameter: ${key}`)
		}
		query.append(key, String(value))
	}

	for (const [key, value] of Object.entries(params)) {
		if (Array.isArray(value)) {
			value.forEach((item) => append(`${key}[]`, item))
		} else {
			append(key, value)
		}
	}

	const search = query.toString()
	if (!search) return url

	// Only encode new params: parsing/reserializing the existing query could change
	// signed values (%20 to +). Splitting the hash also preserves relative URLs.
	const hashIndex = url.indexOf("#")
	const path = hashIndex === -1 ? url : url.slice(0, hashIndex)
	const hash = hashIndex === -1 ? "" : url.slice(hashIndex)
	const separator = path.includes("?") ? (/[?&]$/.test(path) ? "" : "&") : "?"
	return `${path}${separator}${search}${hash}`
}
