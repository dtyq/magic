const NOTES_OPEN_TAG = '<template data-magic-slide-notes data-format="plain-text" data-version="1">'
const NOTES_BLOCK_PATTERN =
	/<template\b(?=[^>]*\bdata-magic-slide-notes(?:\s|=|>))[^>]*>[\s\S]*?<\/template\s*>/i
const NOTES_BLOCK_GLOBAL_PATTERN = new RegExp(NOTES_BLOCK_PATTERN.source, "gi")

export function stripSlideNotes(html: string): string {
	return html.replace(NOTES_BLOCK_GLOBAL_PATTERN, "")
}

function escapeSlideNotes(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function decodeSlideNotes(value: string): string {
	if (typeof document === "undefined") return value

	const template = document.createElement("template")
	template.innerHTML = value
	return template.content.textContent || ""
}

/**
 * Notes are kept in an inert template so the slide iframe never lays them out.
 * The parser intentionally accepts attribute variations while the writer emits one canonical form.
 */
export function extractSlideNotes(html: string): string {
	const match = html.match(NOTES_BLOCK_PATTERN)
	if (!match) return ""

	const openTagEnd = match[0].indexOf(">")
	const closeTagStart = match[0].toLowerCase().lastIndexOf("</template")
	if (openTagEnd < 0 || closeTagStart < 0) return ""

	return decodeSlideNotes(match[0].slice(openTagEnd + 1, closeTagStart)).trim()
}

export function upsertSlideNotes(html: string, notes: string): string {
	const block = `${NOTES_OPEN_TAG}\n${escapeSlideNotes(notes)}\n</template>`
	return writeSlideNotesBlock(html, block)
}

/** Visual editors own the slide body; the source owns separately saved inert notes. */
export function preserveSlideNotesFromSource(editedHtml: string, sourceHtml: string): string {
	const block = sourceHtml.match(NOTES_BLOCK_PATTERN)?.[0]
	return block ? writeSlideNotesBlock(editedHtml, block) : stripSlideNotes(editedHtml)
}

function writeSlideNotesBlock(html: string, block: string): string {
	if (NOTES_BLOCK_PATTERN.test(html)) {
		let hasWrittenBlock = false
		return html.replace(NOTES_BLOCK_GLOBAL_PATTERN, () => {
			if (hasWrittenBlock) return ""
			hasWrittenBlock = true
			return block
		})
	}

	const bodyCloseIndex = html.search(/<\/body\s*>/i)
	if (bodyCloseIndex >= 0) {
		return `${html.slice(0, bodyCloseIndex)}${block}\n${html.slice(bodyCloseIndex)}`
	}

	const htmlCloseIndex = html.search(/<\/html\s*>/i)
	if (htmlCloseIndex >= 0) {
		return `${html.slice(0, htmlCloseIndex)}${block}\n${html.slice(htmlCloseIndex)}`
	}

	return `${html}\n${block}`
}
