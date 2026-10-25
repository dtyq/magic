export interface CodeSearchHighlight {
	from: number
	to: number
	className: string
}

export function escapeCodeHtml(text: string) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Project source offsets into syntax tokens without changing their text or styles. */
export function highlightCodeHtml(
	html: string,
	highlights: CodeSearchHighlight[],
	source?: string,
) {
	if (!highlights.length) return html
	const template = document.createElement("template")
	template.innerHTML = html
	const code = template.content.querySelector("code")
	if (!code) return html
	// Syntax transformers can remove annotation comments. Source-based search must
	// use the original text in that case, rather than highlight shifted offsets.
	if (source !== undefined && code.textContent !== source) code.textContent = source
	const sortedHighlights = [...highlights].sort((a, b) => a.from - b.from)
	const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
	const textNodes: Text[] = []
	while (walker.nextNode()) textNodes.push(walker.currentNode as Text)
	let offset = 0
	let matchIndex = 0
	for (const textNode of textNodes) {
		const text = textNode.data
		const end = offset + text.length
		while (matchIndex < sortedHighlights.length && sortedHighlights[matchIndex].to <= offset)
			matchIndex += 1
		const matches: CodeSearchHighlight[] = []
		for (
			let i = matchIndex;
			i < sortedHighlights.length && sortedHighlights[i].from < end;
			i += 1
		)
			matches.push(sortedHighlights[i])
		if (matches.length) {
			const fragment = document.createDocumentFragment()
			let cursor = 0
			for (const match of matches) {
				const from = Math.max(cursor, match.from - offset)
				const to = Math.min(text.length, match.to - offset)
				if (to <= from) continue
				fragment.append(text.slice(cursor, from))
				const mark = document.createElement("span")
				mark.className = match.className
				mark.textContent = text.slice(from, to)
				fragment.append(mark)
				cursor = to
			}
			fragment.append(text.slice(cursor))
			textNode.replaceWith(fragment)
		}
		offset = end
	}
	return template.innerHTML
}
