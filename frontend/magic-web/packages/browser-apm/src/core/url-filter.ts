/** Shared URL matching semantics; no application endpoint is known to this package. */
export function matchesUrl(url: string, patterns: (string | RegExp)[] = []): boolean {
	return patterns.some((pattern) => {
		if (typeof pattern === "string") return url.includes(pattern)
		pattern.lastIndex = 0
		return pattern.test(url)
	})
}
