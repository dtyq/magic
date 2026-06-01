/**
 * Citations parser — extracts `<references>...</references>` block from content
 * and parses `{{cite:N}}` inline markers.
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
    /** 文件 key (type === 'knowledge_base') */
    file_key?: string
    /** 文件扩展名 (type === 'knowledge_base')，用于 Tab 图标渲染 */
    file_extension?: string
    /** URL (type === 'url') */
    url?: string
}

export interface ParseCitationsResult {
    /** 去除 <references> 块后的正文内容 */
    content: string
    /** 解析出的引用来源列表 */
    citations: CitationSource[]
    /** 是否正在流式中（<references> 块未闭合） */
    isReferencesStreaming: boolean
}

/** 匹配完整的 <references>...</references> 块 */
const REFERENCES_BLOCK_PATTERN = /<references>([\s\S]*?)<\/references>/

/** 匹配未闭合的 <references> 块（流式场景） */
const REFERENCES_OPEN_PATTERN = /<references>([\s\S]*)$/

/** 匹配单个 <ref ... /> 自闭合标签 */
const REF_TAG_PATTERN =
    /<ref\s+([^>]*?)\/>/g

/** 匹配标签属性 key="value" */
const ATTR_PATTERN = /([a-z_]+)="([^"]*)"/g

/** 匹配内联引用标记 {{cite:N}} */
export const CITE_MARKER_PATTERN = /\{\{cite:(\d+)\}\}/g

/** 匹配流式中可能被截断的 cite 标记（末尾不完整） */
const INCOMPLETE_CITE_TAIL_PATTERN = /\{\{cite(?::(?:\d*))?$/

/**
 * 从 content 中分离引用数据。
 * - 移除 `<references>...</references>` 块
 * - 解析其中的 `<ref />` 标签为结构化数据
 * - 流式阶段：检测未闭合的 `<references>` 并截断
 */
export function parseCitations(content: string): ParseCitationsResult {
    if (!content) {
        return { content: "", citations: [], isReferencesStreaming: false }
    }

    // 1. 尝试匹配完整的 <references>...</references>（可能出现在任意位置）
    const closedMatch = content.match(REFERENCES_BLOCK_PATTERN)
    if (closedMatch) {
        const refsContent = closedMatch[1]
        const before = content.slice(0, closedMatch.index!)
        const after = content.slice(closedMatch.index! + closedMatch[0].length)
        const cleanContent = (before + after).trim()
        const citations = parseRefTags(refsContent)
        return { content: cleanContent, citations, isReferencesStreaming: false }
    }

    // 2. 流式场景：检测未闭合的 <references>（只可能在末尾）
    const openMatch = content.match(REFERENCES_OPEN_PATTERN)
    if (openMatch) {
        const refsContent = openMatch[1]
        const cleanContent = content.slice(0, openMatch.index!).trimEnd()
        const citations = parseRefTags(refsContent)
        return { content: cleanContent, citations, isReferencesStreaming: true }
    }

    // 3. 没有 references 块
    return { content, citations: [], isReferencesStreaming: false }
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
    if (attrs.url && !attrs.knowledge_base_id && !attrs.file_key) return "url"
    // 有知识库相关字段 → knowledge_base 类型
    if (attrs.knowledge_base_id || attrs.file_key || attrs.knowledge_base_name) return "knowledge_base"
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
 * 处理流式内容末尾可能被截断的 {{cite: 标记。
 * 返回安全可渲染的内容（截掉不完整的标记）。
 */
export function trimIncompleteCiteMarker(content: string): string {
    // 检查末尾是否有未闭合的 {{cite:... 标记
    const match = content.match(INCOMPLETE_CITE_TAIL_PATTERN)
    if (match) {
        return content.slice(0, match.index!)
    }
    return content
}
