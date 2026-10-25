interface ProtectedRange {
	start: number
	end: number
	code: boolean
}

export interface NoSendMarkdown {
	content: string
	hasControls: boolean
	hasBlock: boolean
}

const TAG = /<\s*(\/?)\s*no_send\s*(\/?)\s*>/gi
const FENCE = /^ {0,3}(`{3,}|~{3,})/
// Consume the non-backtick before the closing delimiter instead of using lookbehind,
// which prevents this module from loading in Safari versions earlier than 16.4.
const INLINE_CODE = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g

function protectedRanges(text: string): ProtectedRange[] {
	const ranges: ProtectedRange[] = []
	let fenceChar = ""
	let fenceSize = 0
	let offset = 0
	for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
		const fence = FENCE.exec(line)
		if (fenceChar) {
			ranges.push({ start: offset, end: offset + line.length, code: true })
			if (
				fence &&
				fence[1][0] === fenceChar &&
				fence[1].length >= fenceSize &&
				!line.slice(fence[0].length).trim()
			) {
				fenceChar = ""
			}
		} else if (fence) {
			fenceChar = fence[1][0]
			fenceSize = fence[1].length
			ranges.push({ start: offset, end: offset + line.length, code: true })
		} else if (line.startsWith("    ") || line.startsWith("\t")) {
			ranges.push({ start: offset, end: offset + line.length, code: true })
		} else if (line.trimStart().startsWith(">")) {
			ranges.push({ start: offset, end: offset + line.length, code: false })
		}
		offset += line.length
	}
	for (const match of text.matchAll(INLINE_CODE)) {
		ranges.push({ start: match.index, end: match.index + match[0].length, code: true })
	}
	return ranges
}

function isEscaped(text: string, position: number): boolean {
	let preceding = position - 1
	while (preceding >= 0 && text[preceding] === "\\") preceding -= 1
	return (position - preceding - 1) % 2 === 1
}

function startsLine(text: string, position: number): boolean {
	return !text.slice(text.lastIndexOf("\n", position - 1) + 1, position).trim()
}

function endsLine(text: string, position: number): boolean {
	const nextLine = text.indexOf("\n", position)
	return !text.slice(position, nextLine < 0 ? text.length : nextLine).trim()
}

/** 与微信 filter_no_send 使用相同边界；只派生展示副本，不能改写消息正文。 */
export function prepareNoSendMarkdown(text: string, isStreaming: boolean): NoSendMarkdown {
	if (!/no_send/i.test(text) && !(isStreaming && /<\s*\/?\s*no\w*\s*$/i.test(text))) {
		return { content: text, hasControls: false, hasBlock: false }
	}
	const ranges = protectedRanges(text)
	let source = text
	if (isStreaming) {
		const start = source.lastIndexOf("<")
		const suffix = source.slice(start).toLowerCase().replace(/\s/g, "")
		if (
			start >= 0 &&
			/^<\/?no/.test(suffix) &&
			["<no_send>", "</no_send>"].some((tag) => tag !== suffix && tag.startsWith(suffix)) &&
			!ranges.some((range) => start >= range.start && start < range.end) &&
			!isEscaped(source, start)
		) {
			source = source.slice(0, start)
		}
	}

	const output: string[] = []
	let buffer: string[] = []
	let position = 0
	let depth = 0
	let blockStart = false
	let hasControls = false
	let hasBlock = false
	function appendRegion(block: boolean, unclosed: boolean) {
		const body = buffer.join("")
		buffer = []
		if (!body.trim()) return
		hasBlock ||= block
		// 内部元素只用于同一份 Markdown 的展示；嵌套控制已合并，句内格式不拆开。
		output.push(
			`<no-send data-layout="${block ? "block" : "inline"}" data-unclosed="${unclosed}">${body}</no-send>`,
		)
	}

	for (const tag of source.matchAll(TAG)) {
		const start = tag.index
		buffer.push(source.slice(position, start))
		const protectedItems = ranges.filter((range) => start >= range.start && start < range.end)
		if (protectedItems.length || isEscaped(source, start)) {
			// 代码由 Markdown 自己转义；引用中的尖括号显式转义，防止 HTML 清洗丢掉示例。
			buffer.push(
				protectedItems.length && !protectedItems.some((range) => range.code)
					? tag[0].replace(/</g, "&lt;").replace(/>/g, "&gt;")
					: tag[0],
			)
		} else {
			hasControls = true
			if (tag[1]) {
				if (depth > 0) {
					depth -= 1
					if (depth === 0)
						appendRegion(blockStart && endsLine(source, start + tag[0].length), false)
				} else {
					buffer.push('<no-send data-invalid="true"></no-send>')
				}
			} else if (!tag[2]) {
				if (depth === 0) {
					output.push(buffer.join(""))
					buffer = []
					blockStart = startsLine(source, start)
				}
				depth += 1
			}
		}
		position = start + tag[0].length
	}
	buffer.push(source.slice(position))
	if (depth > 0) appendRegion(blockStart, !isStreaming)
	else output.push(buffer.join(""))
	return { content: output.join(""), hasControls, hasBlock }
}
