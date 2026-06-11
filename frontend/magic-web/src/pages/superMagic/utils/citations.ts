/**
 * Citation helpers — extract `<references>...</references>` data from content
 * and guard incomplete `<citation index="N"></citation>` inline markers while streaming.
 *
 * Designed to work with streaming content where the block may be incomplete.
 */

export interface CitationSource {
	/** 引用序号（从 1 开始） */
	index: number
	/** 引用类型 */
	type: "knowledge_base" | "url"
	/** 文档标题 */
	title: string
	/** 知识库名称 (type === 'knowledge_base') */
	knowledge_base_name?: string
	/** 知识库 ID (type === 'knowledge_base') */
	knowledge_base_id?: string
	/** 知识库文档 code (type === 'knowledge_base') */
	document_code?: string
	/** 文件 key (type === 'knowledge_base') */
	file_key?: string
	/** 文件扩展名 (type === 'knowledge_base')，用于 Tab 图标渲染 */
	file_extension?: string
	/** URL (type === 'url') */
	url?: string
}

const REFERENCES_OPEN_TAG = "<references>"
const REFERENCES_CLOSE_TAG = "</references>"

/** 匹配单个 <ref ... /> 自闭合标签 */
const REF_TAG_PATTERN = /<ref\s+([^>]*?)\/>/g

/** 匹配标签属性 key="value" */
const ATTR_PATTERN = /([a-z_]+)="([^"]*)"/g

/** 匹配完整的 citation 标签前缀，用于避免误截断 */
const COMPLETE_CITATION_TAG_PREFIX_PATTERN = /^<citation\b[^<>]*(?:\/>|><\/citation>)/i

/** 匹配 Markdown fenced code 起始行 */
const FENCE_OPEN_LINE_PATTERN = /^\s*(`{3,}|~{3,})/

/**
 * 从 content 中读取引用数据。正文中的 references/ref 标签由 Markdown 自定义组件隐藏。
 */
export function extractCitations(content: string): CitationSource[] {
	if (!content) {
		return []
	}

	const refsContent = findReferencesContentOutsideFences(content)
	return refsContent ? parseRefTags(refsContent) : []
}

function findReferencesContentOutsideFences(content: string): string | null {
	const openIndex = findReferencesOpenOutsideFences(content)
	if (openIndex === -1) return null

	const refsStart = openIndex + REFERENCES_OPEN_TAG.length
	const closeIndex = findTokenOutsideFences(content, REFERENCES_CLOSE_TAG, refsStart)
	if (closeIndex === -1) {
		return content.slice(refsStart)
	}

	return content.slice(refsStart, closeIndex)
}

function findReferencesOpenOutsideFences(content: string): number {
	let lineStart = 0
	let fence: { char: "`" | "~"; length: number } | null = null

	while (lineStart < content.length) {
		const lineEnd = content.indexOf("\n", lineStart)
		const lineContentEnd = lineEnd === -1 ? content.length : lineEnd
		const nextLineStart = lineEnd === -1 ? content.length : lineEnd + 1
		const line = content.slice(lineStart, lineContentEnd)

		if (fence) {
			if (isFenceCloseLine(line, fence)) {
				fence = null
			}
			lineStart = nextLineStart
			continue
		}

		if (isIndentedCodeLine(line)) {
			lineStart = nextLineStart
			continue
		}

		const firstNonWhitespaceIndex = line.search(/\S/)
		if (firstNonWhitespaceIndex !== -1) {
			const contentAfterIndent = line.slice(firstNonWhitespaceIndex)
			if (contentAfterIndent.startsWith(REFERENCES_OPEN_TAG)) {
				return lineStart + firstNonWhitespaceIndex
			}
		}

		const openFence = getFenceOpen(line)
		if (openFence) {
			fence = openFence
		}
		lineStart = nextLineStart
	}

	return -1
}

function findTokenOutsideFences(content: string, token: string, fromIndex: number): number {
	let lineStart = 0
	let fence: { char: "`" | "~"; length: number } | null = null

	while (lineStart < content.length) {
		const lineEnd = content.indexOf("\n", lineStart)
		const lineContentEnd = lineEnd === -1 ? content.length : lineEnd
		const nextLineStart = lineEnd === -1 ? content.length : lineEnd + 1
		const line = content.slice(lineStart, lineContentEnd)

		if (fence) {
			if (isFenceCloseLine(line, fence)) {
				fence = null
			}
			lineStart = nextLineStart
			continue
		}

		const searchStart = Math.max(lineStart, fromIndex)
		if (searchStart < nextLineStart) {
			const tokenIndex = content.indexOf(token, searchStart)
			if (tokenIndex !== -1 && tokenIndex < nextLineStart) {
				return tokenIndex
			}
		}

		const openFence = getFenceOpen(line)
		if (openFence) {
			fence = openFence
		}
		lineStart = nextLineStart
	}

	return -1
}

/**
 * 解析 <ref ... /> 标签列表为 CitationSource 数组
 */
function parseRefTags(refsContent: string): CitationSource[] {
	const citations: CitationSource[] = []
	let match: RegExpExecArray | null

	// 重置 lastIndex
	REF_TAG_PATTERN.lastIndex = 0
	while ((match = REF_TAG_PATTERN.exec(refsContent)) !== null) {
		const attrsStr = match[1]
		const attrs = parseAttributes(attrsStr)

		const index = Number(attrs.index)
		if (!index || index < 1) continue

		// 根据实际字段推断类型，不完全信任 LLM 返回的 type
		const type = inferCitationType(attrs)
		const citation: CitationSource = {
			index,
			type,
			title: attrs.title || "",
		}

		if (attrs.knowledge_base_name) citation.knowledge_base_name = attrs.knowledge_base_name
		if (attrs.knowledge_base_id) citation.knowledge_base_id = attrs.knowledge_base_id
		if (attrs.document_code) citation.document_code = attrs.document_code
		if (attrs.file_key) citation.file_key = attrs.file_key
		if (attrs.file_extension) citation.file_extension = attrs.file_extension
		if (attrs.url) citation.url = attrs.url

		citations.push(citation)
	}

	return citations
}

/** 根据属性字段推断引用类型（优先级：字段存在性 > LLM 声明的 type） */
function inferCitationType(attrs: Record<string, string>): CitationSource["type"] {
	// 有 url 字段且无知识库相关字段 → url 类型
	if (attrs.url && !attrs.knowledge_base_id && !attrs.document_code && !attrs.file_key)
		return "url"
	// 有知识库相关字段 → knowledge_base 类型
	if (
		attrs.knowledge_base_id ||
		attrs.document_code ||
		attrs.file_key ||
		attrs.knowledge_base_name
	)
		return "knowledge_base"
	// 兜底：检查 LLM 声明的 type 是否合法
	if (attrs.type === "url") return "url"
	return "knowledge_base"
}

/**
 * 解析 HTML 属性字符串为 key-value 对象
 */
function parseAttributes(attrsStr: string): Record<string, string> {
	const attrs: Record<string, string> = {}
	let match: RegExpExecArray | null

	ATTR_PATTERN.lastIndex = 0
	while ((match = ATTR_PATTERN.exec(attrsStr)) !== null) {
		attrs[match[1]] = decodeHtmlEntities(match[2])
	}

	return attrs
}

/**
 * 解码基本 HTML 实体
 */
function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
}

/**
 * 处理流式内容末尾可能被截断的 <citation> 标签。
 * 返回安全可渲染的内容（截掉不完整的标签）。
 */
export function trimIncompleteCitationTag(content: string): string {
	if (isInsideUnclosedFence(content)) return content

	const lastCitationStart = content.toLowerCase().lastIndexOf("<citation")
	if (lastCitationStart === -1) return content

	const citationTail = content.slice(lastCitationStart)
	if (COMPLETE_CITATION_TAG_PREFIX_PATTERN.test(citationTail)) return content

	return content.slice(0, lastCitationStart)
}

function isInsideUnclosedFence(content: string): boolean {
	const lines = content.split("\n")
	let fence: { char: "`" | "~"; length: number } | null = null

	for (const line of lines) {
		if (fence) {
			if (isFenceCloseLine(line, fence)) {
				fence = null
			}
			continue
		}

		const openFence = getFenceOpen(line)
		if (openFence) {
			fence = openFence
		}
	}

	return !!fence
}

function getFenceOpen(line: string): { char: "`" | "~"; length: number } | null {
	const match = line.match(FENCE_OPEN_LINE_PATTERN)
	if (!match) return null

	const marker = match[1]
	const char = marker[0]
	if (char !== "`" && char !== "~") return null

	return { char, length: marker.length }
}

function isIndentedCodeLine(line: string): boolean {
	return /^(?: {4,}|\t)/.test(line)
}

function isFenceCloseLine(line: string, fence: { char: "`" | "~"; length: number }): boolean {
	const trimmed = line.trim()
	if (!trimmed || trimmed[0] !== fence.char) return false

	let markerLength = 0
	while (trimmed[markerLength] === fence.char) {
		markerLength += 1
	}

	return markerLength >= fence.length && trimmed.slice(markerLength).trim() === ""
}
