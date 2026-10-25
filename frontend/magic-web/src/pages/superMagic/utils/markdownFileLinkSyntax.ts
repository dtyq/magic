import MarkdownIt from "markdown-it"
import { isMarkdownFileLink } from "./markdownFileReference"

const parser = new MarkdownIt({ html: false, linkify: false })

export interface MarkdownFileLinkSyntax {
	label: string
	rawLabel: string
	href: string
	title: string | null
	image: boolean
	compatible: boolean
	startIndex: number
	endIndex: number
	labelStart: number
	labelEnd: number
	fullMatch: string
}

/** 标准语法优先；只有裸空格文件目标才启用扩展，不把任意括号内文字当文件。 */
export function parseMarkdownFileLinkSyntaxAt(
	content: string,
	startIndex: number,
	max = content.length,
): MarkdownFileLinkSyntax | null {
	const image = content[startIndex] === "!"
	const bracketStart = startIndex + (image ? 1 : 0)
	if (content[bracketStart] !== "[" || (!image && content[startIndex - 1] === "!")) return null
	const state = new parser.inline.State(content, parser, {}, [])
	state.posMax = max
	const labelEnd = parser.helpers.parseLinkLabel(state, bracketStart, true)
	if (labelEnd < 0 || content[labelEnd + 1] !== "(") return null
	const labelStart = bracketStart + 1
	let index = labelEnd + 2
	while (index < max && /[ \t\r\n]/.test(content[index])) index++
	const destinationStart = index
	// 复用 Markdown 语法规则，只记录原文区间，不重新序列化正文。
	const destination = parser.helpers.parseLinkDestination(content, index, max)
	let href = destination.str
	let title: string | null = null
	let valid = destination.ok
	if (valid) {
		index = destination.pos
		const destinationEnd = index
		while (index < max && /[ \t\r\n]/.test(content[index])) index++
		if (index > destinationEnd && content[index] !== ")") {
			const parsedTitle = parser.helpers.parseLinkTitle(content, index, max)
			valid = parsedTitle.ok
			if (valid) {
				title = parsedTitle.str
				index = parsedTitle.pos
				while (index < max && /[ \t\r\n]/.test(content[index])) index++
			}
		}
		valid = valid && index < max && content[index] === ")"
	}
	if (!valid) {
		index = destinationStart
		let depth = 0
		while (index < max) {
			const char = content[index]
			const code = char.charCodeAt(0)
			if (code < 32 || code === 127 || char === "<" || char === ">") return null
			if (char === "\\" && index + 1 < max) {
				index += 2
				continue
			}
			if (char === "(" && ++depth > 32) return null
			if (char === ")") {
				if (depth === 0) break
				depth--
			}
			index++
		}
		if (index === max || depth !== 0) return null
		href = parser.utils.unescapeAll(content.slice(destinationStart, index).trim())
		// 文件名带空格且有扩展名，或带明确目录；网页 URL、title 和裸句子保持原解析。
		if (
			!href.includes(" ") ||
			!isMarkdownFileLink(href) ||
			/["'<>]/.test(href) ||
			Array.from(href).some(
				(char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
			) ||
			(!href.includes("/") && !/^[^/]+\.[^/\s.]+$/.test(href))
		)
			return null
		title = null
	}
	const rawLabel = content.slice(labelStart, labelEnd)
	const endIndex = index + 1
	return {
		label: parser.utils.unescapeAll(rawLabel),
		rawLabel,
		href: parser.normalizeLink(href),
		title,
		image,
		compatible: !valid,
		startIndex,
		endIndex,
		labelStart,
		labelEnd,
		fullMatch: content.slice(startIndex, endIndex),
	}
}

export const decodeMarkdownFileText = (source: string) => parser.utils.unescapeAll(source)

/** 在原行内解析阶段生成普通 link/image token，代码块和源码位置无需重写。 */
export function installSpacedMarkdownFileLinks(md: MarkdownIt) {
	const rule: Parameters<typeof md.inline.ruler.push>[1] = (state, silent) => {
		// markdown-it 14 的运行时提供 linkLevel，当前 @types 尚未声明这个字段。
		const inlineState = state as typeof state & { linkLevel: number }
		if (inlineState.linkLevel > 0) return false
		const match = parseMarkdownFileLinkSyntaxAt(state.src, state.pos, state.posMax)
		if (!match?.compatible || !md.validateLink(match.href)) return false
		if (!silent) {
			if (match.image) {
				const token = state.push("image", "img", 0)
				token.attrs = [
					["src", match.href],
					["alt", ""],
				]
				token.content = match.rawLabel
				token.children = []
				md.inline.parse(match.rawLabel, md, state.env, token.children)
			} else {
				const max = state.posMax
				state.push("link_open", "a", 1).attrs = [["href", match.href]]
				state.pos = match.labelStart
				state.posMax = match.labelEnd
				inlineState.linkLevel++
				try {
					md.inline.tokenize(state)
				} finally {
					state.posMax = max
					inlineState.linkLevel--
				}
				state.push("link_close", "a", -1)
			}
		}
		state.pos = match.endIndex
		return true
	}
	// Tiptap 每次解析都会执行 setup；同名规则替换，避免重复注册。
	try {
		md.inline.ruler.at("spaced_file_link", rule)
	} catch {
		md.inline.ruler.after("image", "spaced_file_link", rule)
	}
}
