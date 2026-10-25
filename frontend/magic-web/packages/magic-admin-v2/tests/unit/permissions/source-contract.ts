import assert from "node:assert/strict"

/**
 * Source-contract tests should verify the permission boundary, not formatter output.
 * JSX props are intentionally written across multiple lines in production code, so
 * whitespace is not part of the contract being tested.
 */
export function normalizeSource(source: string) {
	return source.replace(/\s+/g, "")
}

export function assertSourceIncludes(source: string, snippet: string) {
	assert.equal(
		normalizeSource(source).includes(normalizeSource(snippet)),
		true,
		`Expected source contract to include: ${snippet}`,
	)
}

