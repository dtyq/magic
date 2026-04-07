import yaml from "js-yaml"

export const MARKDOWN_FRONTMATTER_NODE_NAME = "markdownFrontmatter"
export const MARKDOWN_FRONTMATTER_DATA_TYPE = "markdown-frontmatter"

const frontmatterPattern =
	/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/

export interface MarkdownFrontmatterMatch {
	raw: string
	body: string
}

export function extractMarkdownFrontmatter(markdown: string): MarkdownFrontmatterMatch | null {
	if (!markdown) return null

	const match = markdown.match(frontmatterPattern)
	if (!match) return null

	return {
		raw: normalizeFrontmatterRaw(match[1] ?? ""),
		body: markdown.slice(match[0].length),
	}
}

export function preprocessMarkdownFrontmatter(markdown: string): string {
	const match = extractMarkdownFrontmatter(markdown)
	if (!match) return markdown

	const placeholderHtml = [
		`<div data-type="${MARKDOWN_FRONTMATTER_DATA_TYPE}"`,
		`data-frontmatter-raw="${encodeMarkdownFrontmatterRaw(match.raw)}"></div>`,
	].join(" ")

	const body = stripLeadingLineBreak(match.body)
	if (!body) return placeholderHtml

	return `${placeholderHtml}\n\n${body}`
}

export function encodeMarkdownFrontmatterRaw(raw: string): string {
	return encodeURIComponent(normalizeFrontmatterRaw(raw))
}

export function decodeMarkdownFrontmatterRaw(raw: string | null): string {
	if (!raw) return ""

	try {
		return normalizeFrontmatterRaw(decodeURIComponent(raw))
	} catch {
		return normalizeFrontmatterRaw(raw)
	}
}

export function serializeMarkdownFrontmatter(raw: string): string {
	const normalizedRaw = normalizeFrontmatterRaw(raw).trimEnd()
	return `---\n${normalizedRaw}\n---`
}

export function parseEditableMarkdownFrontmatter(value: string): string {
	const normalizedValue = normalizeFrontmatterRaw(value)
	const withoutOpeningFence = normalizedValue.replace(/^(?:\uFEFF)?---[ \t]*\n?/, "")
	return withoutOpeningFence.replace(/\n?(?:---|\.\.\.)[ \t]*$/, "")
}

export function parseMarkdownFrontmatter(raw: string): {
	data: unknown
	error: Error | null
} {
	try {
		return {
			data: yaml.load(normalizeFrontmatterRaw(raw)),
			error: null,
		}
	} catch (error) {
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Invalid YAML frontmatter"),
		}
	}
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function stringifyFrontmatterValue(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return ""
	if (typeof value === "string") return value
	if (typeof value === "number" || typeof value === "boolean") return String(value)

	return JSON.stringify(value, null, 2)
}

function normalizeFrontmatterRaw(raw: string): string {
	return raw.replace(/\r\n/g, "\n")
}

function stripLeadingLineBreak(content: string): string {
	if (!content) return content
	return content.replace(/^\r?\n/, "")
}
