import { describe, expect, it } from "vitest"
import {
	LARGE_MARKDOWN_THRESHOLD_BYTES,
	exceedsUtf8ByteLimit,
	getVirtualMarkdownChunkContent,
	isLargeMarkdownContent,
	splitMarkdownIntoVirtualChunks,
} from "./largeMarkdown"

describe("large markdown utilities", () => {
	it("pins the boundary at 200 KiB", () => {
		// Every other case below is expressed relative to the constant, so it would keep
		// passing for any threshold. This one pins the product decision itself.
		expect(LARGE_MARKDOWN_THRESHOLD_BYTES).toBe(204_800)
		expect(LARGE_MARKDOWN_THRESHOLD_BYTES).toBe(200 * 1024)
	})

	it("uses UTF-8 byte size and treats the 200 KB boundary as large", () => {
		expect(isLargeMarkdownContent("a".repeat(LARGE_MARKDOWN_THRESHOLD_BYTES - 1))).toBe(false)
		expect(isLargeMarkdownContent("a".repeat(LARGE_MARKDOWN_THRESHOLD_BYTES))).toBe(true)
		expect(isLargeMarkdownContent("a".repeat(LARGE_MARKDOWN_THRESHOLD_BYTES + 1))).toBe(true)
		expect(exceedsUtf8ByteLimit("你", 2)).toBe(true)
		expect(exceedsUtf8ByteLimit("😀", 3)).toBe(true)
	})

	it("measures multi-byte content in bytes instead of characters", () => {
		// "中" is 3 UTF-8 bytes and the limit minus one is not divisible by 3, so pad with
		// ASCII to land exactly one byte below the limit instead of relying on `repeat`
		// truncating a fractional count.
		const cjkCount = Math.floor((LARGE_MARKDOWN_THRESHOLD_BYTES - 1) / 3)
		const asciiPadding = LARGE_MARKDOWN_THRESHOLD_BYTES - 1 - cjkCount * 3
		const justBelowLimit = `${"中".repeat(cjkCount)}${"a".repeat(asciiPadding)}`

		expect(cjkCount * 3 + asciiPadding).toBe(LARGE_MARKDOWN_THRESHOLD_BYTES - 1)
		expect(isLargeMarkdownContent(justBelowLimit)).toBe(false)
		expect(isLargeMarkdownContent(`${justBelowLimit}a`)).toBe(true)

		// A 4-byte emoji occupies two UTF-16 code units, so this document is only half the
		// threshold in characters while already reaching it in bytes.
		const emojiOnly = "😀".repeat(Math.ceil(LARGE_MARKDOWN_THRESHOLD_BYTES / 4))
		expect(emojiOnly.length).toBeLessThan(LARGE_MARKDOWN_THRESHOLD_BYTES)
		expect(isLargeMarkdownContent(emojiOnly)).toBe(true)

		// This mixed string is long enough to skip the O(1) short-circuits, so it covers
		// the exact byte scan. Adding one more character crosses the inclusive limit.
		const mixedBelowLimit = `${"a".repeat(LARGE_MARKDOWN_THRESHOLD_BYTES - 4)}中`
		expect(isLargeMarkdownContent(mixedBelowLimit)).toBe(false)
		expect(isLargeMarkdownContent(`${mixedBelowLimit}中`)).toBe(true)
	})

	it("splits a large document into source ranges without losing text", () => {
		const content = Array.from(
			{ length: 40 },
			(_, index) => `## Section ${index}\n\n${"paragraph ".repeat(20)}\n\n`,
		).join("")
		const chunks = splitMarkdownIntoVirtualChunks(content, 300, 600)

		expect(chunks.length).toBeGreaterThan(1)
		expect(chunks.map((chunk) => content.slice(chunk.start, chunk.end)).join("")).toBe(content)
		expect(chunks.flatMap((chunk) => chunk.headingSlugs)).toContain("section-0")
	})

	it("keeps split fenced-code chunks independently parseable", () => {
		const content = `\`\`\`json\n${'{"value":1}\n'.repeat(100)}\`\`\`\n`
		const chunks = splitMarkdownIntoVirtualChunks(content, 100, 180)
		const renderedChunks = chunks.map((chunk) => getVirtualMarkdownChunkContent(content, chunk))

		expect(chunks.length).toBeGreaterThan(1)
		renderedChunks.forEach((chunkContent, index) => {
			expect(
				chunkContent.startsWith("```json"),
				`chunk ${index} opening fence: ${JSON.stringify(chunkContent.slice(0, 30))}`,
			).toBe(true)
			expect(
				chunkContent.trimEnd().endsWith("```"),
				`chunk ${index} closing fence: ${JSON.stringify(chunkContent.slice(-30))}`,
			).toBe(true)
		})
	})

	it("generates stable unique slugs for duplicate headings", () => {
		const content = `# Duplicate\n\n${"x".repeat(80)}\n\n# Duplicate\n`
		const chunks = splitMarkdownIntoVirtualChunks(content, 50, 100)

		expect(chunks.flatMap((chunk) => chunk.headingSlugs)).toEqual(["duplicate", "duplicate-1"])
	})
})
