interface ResolveMarkdownRenderSourceOptions {
	isStreaming: boolean
}

const MARKDOWN_FENCE_LINE_PATTERN = /^\s*(`{3,}|~{3,})(.*)$/

export function hasMarkdownFence(markdown: string): boolean {
	return markdown.split("\n").some((line) => Boolean(getFenceLine(line)))
}

export function resolveMarkdownRenderSource(
	markdown: string,
	options: ResolveMarkdownRenderSourceOptions,
) {
	if (options.isStreaming) return markdown
	return ensureClosedMarkdownFence(markdown)
}

export function shouldEnableStreamingTextAnimation(
	markdown: string,
	options: ResolveMarkdownRenderSourceOptions,
) {
	return options.isStreaming && !hasMarkdownFence(markdown)
}

function ensureClosedMarkdownFence(markdown: string) {
	const unclosedFence = getUnclosedMarkdownFence(markdown)
	if (!unclosedFence) return markdown

	return `${markdown.replace(/\s*$/, "")}\n${unclosedFence.char.repeat(unclosedFence.length)}`
}

function getUnclosedMarkdownFence(markdown: string): { char: "`" | "~"; length: number } | null {
	let fence: { char: "`" | "~"; length: number } | null = null

	for (const line of markdown.split("\n")) {
		const fenceLine = getFenceLine(line)
		if (!fenceLine) continue

		if (!fence) {
			fence = { char: fenceLine.char, length: fenceLine.length }
			continue
		}

		if (
			fenceLine.char === fence.char &&
			fenceLine.length >= fence.length &&
			fenceLine.trailing.trim() === ""
		) {
			fence = null
		}
	}

	return fence
}

function getFenceLine(
	line: string,
): { char: "`" | "~"; length: number; trailing: string } | null {
	const match = line.match(MARKDOWN_FENCE_LINE_PATTERN)
	if (!match) return null

	const marker = match[1]
	const char = marker[0]
	if (char !== "`" && char !== "~") return null

	return { char, length: marker.length, trailing: match[2] ?? "" }
}
