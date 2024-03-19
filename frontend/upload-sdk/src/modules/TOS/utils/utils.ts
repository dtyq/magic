export const getSortedQueryString = (query: Record<string, any>) => {
	const searchParts: string[] = []
	Object.keys(query)
		.sort()
		.forEach((key) => {
			searchParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
		})
	return searchParts.join("&")
}

export function isBuffer(obj: unknown): obj is Buffer {
	return typeof Buffer !== "undefined" && obj instanceof Buffer
}
