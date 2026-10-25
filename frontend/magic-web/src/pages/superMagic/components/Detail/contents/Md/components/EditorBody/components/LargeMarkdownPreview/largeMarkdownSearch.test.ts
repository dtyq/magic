import { describe, expect, it } from "vitest"
import { splitMarkdownIntoVirtualChunks } from "../../largeMarkdown"
import { MAX_REGEX_QUERY_LENGTH, MAX_SEARCH_RESULTS, searchMarkdown } from "./largeMarkdownSearch"

describe("searchMarkdown", () => {
	it("returns literal matches with source offsets and chunk indexes", () => {
		const content = "Alpha\n\nBeta alpha"
		const chunks = splitMarkdownIntoVirtualChunks(content, 8, 12)

		expect(
			searchMarkdown({ content, chunks, query: "alpha", caseSensitive: false }),
		).toMatchObject([
			{ start: 0, end: 5, chunkIndex: 0 },
			{ start: 12, end: 17, chunkIndex: 1 },
		])
	})

	it("supports case-sensitive searches and empty queries", () => {
		const content = "Alpha alpha"
		const chunks = splitMarkdownIntoVirtualChunks(content)

		expect(
			searchMarkdown({ content, chunks, query: "alpha", caseSensitive: true }),
		).toHaveLength(1)
		expect(searchMarkdown({ content, chunks, query: "", caseSensitive: false })).toEqual([])
	})

	it("treats regex characters as literal text and caps results", () => {
		const content = `${"a+b ".repeat(MAX_SEARCH_RESULTS + 10)}`
		const chunks = splitMarkdownIntoVirtualChunks(content)
		const results = searchMarkdown({ content, chunks, query: "a+b", caseSensitive: true })

		expect(results).toHaveLength(MAX_SEARCH_RESULTS)
		expect(results[0]?.preview).toContain("a+b")
	})

	it("supports regular expression matching and ignores invalid patterns", () => {
		const content = "Alpha 123\nBeta 456\nGamma"
		const chunks = splitMarkdownIntoVirtualChunks(content)

		expect(
			searchMarkdown({
				content,
				chunks,
				query: "[A-Za-z]+ \\d+",
				caseSensitive: false,
				useRegex: true,
			}),
		).toHaveLength(2)
		expect(
			searchMarkdown({
				content,
				chunks,
				query: "[",
				caseSensitive: false,
				useRegex: true,
			}),
		).toEqual([])
	})

	it("advances zero-length regex matches without repeating the same offset", () => {
		const content = "😀ab"
		const chunks = splitMarkdownIntoVirtualChunks(content)

		for (const query of ["^", ".*", "a*"]) {
			const results = searchMarkdown({
				content,
				chunks,
				query,
				caseSensitive: false,
				useRegex: true,
			})
			const offsets = results.map((result) => result.start)
			expect(new Set(offsets).size).toBe(offsets.length)
			expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
		}
	})

	it("rejects oversized and obviously nested-quantifier patterns", () => {
		const content = "a".repeat(100)
		const chunks = splitMarkdownIntoVirtualChunks(content)

		for (const query of ["(a+)+", "^(a|aa)+$"]) {
			expect(
				searchMarkdown({
					content,
					chunks,
					query,
					caseSensitive: false,
					useRegex: true,
				}),
			).toEqual([])
		}
		expect(
			searchMarkdown({
				content,
				chunks,
				query: "a".repeat(MAX_REGEX_QUERY_LENGTH + 1),
				caseSensitive: false,
				useRegex: true,
			}),
		).toEqual([])
	})
})
