export function fuzzyMatch(target: string, query: string): boolean {
	const targetLower = target.toLowerCase()
	const queryLower = query.toLowerCase()

	let queryIndex = 0

	for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
		if (targetLower[i] === queryLower[queryIndex]) queryIndex++
	}

	return queryIndex === queryLower.length
}

export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\s_-]+/g, "")
}

export function matchesQuery(target: string, query: string): boolean {
	const targetLower = normalizeSearchText(target)
	const queryLower = normalizeSearchText(query)

	if (targetLower.includes(queryLower)) return true

	return fuzzyMatch(targetLower, queryLower)
}

export function includesSearchQuery(target: string, query: string): boolean {
	return normalizeSearchText(target).includes(normalizeSearchText(query))
}
