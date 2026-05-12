export interface ParsedQuestion {
	id: string
	type: "confirm" | "input" | "select" | "multi_select"
	label: string
	placeholder?: string
	min?: number
	max?: number
	defaultValue?: string | readonly string[]
	options: readonly string[]
	isComplete: boolean
}

const QUESTIONS_KEY_RE = /"questions"\s*:\s*"/

/**
 * 从流式的、可能残缺的 JSON 字符串中容错提取 `questions` 字段的字符串 value。
 *
 * 场景：LLM 推送 tool_call.function.arguments 是逐字符拼接的，中途形如
 *   `{"questions": "<question type=\"input\"`
 * 不是合法 JSON，`JSON.parse` 会抛。本函数不依赖 JSON.parse：
 *   1. 用正则定位 `"questions": "` 这个字面片段（允许空白/换行）
 *   2. 手写指针扫描到下一个**未 escape** 的 `"` 或 EOF
 *   3. 对截取到的内容执行 JSON 字符串反转义（`\"` `\\` `\n` `\t` `\uXXXX` 等）
 *
 * 对任意输入（含空串、截断、`\\` 作为最后一字符）都保证幂等、不抛异常。
 */
export function extractQuestionsField(rawArgs: string): string {
	if (!rawArgs) return ""

	const match = rawArgs.match(QUESTIONS_KEY_RE)
	if (!match || match.index === undefined) return ""

	const valueStart = match.index + match[0].length
	const len = rawArgs.length

	// chunk 级切片 + 批量拼接，避免逐字符拼字符串的 O(N²) 常数成本。
	const parts: string[] = []
	let i = valueStart
	let chunkStart = valueStart

	const flushPlain = () => {
		if (i > chunkStart) parts.push(rawArgs.slice(chunkStart, i))
	}

	while (i < len) {
		const ch = rawArgs.charCodeAt(i)
		// 0x22 === '"'
		if (ch === 0x22) {
			flushPlain()
			return parts.join("")
		}
		// 0x5C === '\\'
		if (ch === 0x5c) {
			flushPlain()
			// 末尾未写完的转义，直接当作缺失处理，下一轮 chunk 会补上
			if (i + 1 >= len) return parts.join("")
			const esc = rawArgs[i + 1]
			if (esc === "u") {
				if (i + 5 >= len) return parts.join("")
				const hex = rawArgs.slice(i + 2, i + 6)
				if (/^[0-9a-fA-F]{4}$/.test(hex)) {
					parts.push(String.fromCharCode(parseInt(hex, 16)))
				} else {
					parts.push(esc)
				}
				i += 6
				chunkStart = i
				continue
			}
			parts.push(ESCAPE_MAP[esc] ?? esc)
			i += 2
			chunkStart = i
			continue
		}
		i++
	}
	flushPlain()
	return parts.join("")
}

const ESCAPE_MAP: Record<string, string> = {
	'"': '"',
	"\\": "\\",
	"/": "/",
	n: "\n",
	r: "\r",
	t: "\t",
	b: "\b",
	f: "\f",
}

const EMPTY_OPTIONS: readonly string[] = Object.freeze([])

/** 单条 raw 字符串上限 512KB，防止恶意/抖动的超长输入阻塞主线程 */
const MAX_RAW_BYTES = 512 * 1024

/** 只匹配不带 `g` flag，规避 lastIndex 残留导致的并发重入问题；`matchAll` 走同 source 新建的 stateless 迭代器 */
const QUESTION_OPEN_SOURCE = /<question\b([^>]*)>/gi
const QUESTION_CLOSE_RE = /<\/question\s*>/i
const OPTION_SOURCE = /<option\b[^>]*>([\s\S]*?)(?:<\/option\s*>|(?=<option)|(?=<\/question)|$)/gi
const FIRST_STRUCTURAL_TAG_RE = /<(option|\/question)\b/i
const STRAY_OPTION_TAG_RE = /<\/?option[^>]*>/g
const ATTR_CACHE = new Map<string, RegExp>()

function attrRegex(name: string) {
	const cached = ATTR_CACHE.get(name)
	if (cached) return cached
	const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")
	ATTR_CACHE.set(name, re)
	return re
}

function extractAttr(attrs: string, name: string) {
	return attrs.match(attrRegex(name))?.[1]
}

function parseFiniteInt(value: string | undefined): number | undefined {
	if (value === undefined) return undefined
	const trimmed = value.trim()
	// Number("") === 0 / Number("   ") === 0，这里视为"未设置"
	if (trimmed === "") return undefined
	const n = Number(trimmed)
	return Number.isFinite(n) ? n : undefined
}

function parseDefaultValue(value: string | undefined): string | readonly string[] | undefined {
	if (value === undefined) return undefined
	const trimmed = value.trim()
	if (!trimmed) return ""

	try {
		const parsedValue = JSON.parse(trimmed) as unknown
		if (Array.isArray(parsedValue)) {
			return parsedValue.filter(
				(item): item is string => typeof item === "string" && Boolean(item),
			)
		}
		if (typeof parsedValue === "string") return parsedValue
	} catch {
		// Attribute values are often plain strings in the streaming XML payload.
	}

	return trimmed
}

function normalizeLabel(raw: string) {
	const firstTag = raw.search(FIRST_STRUCTURAL_TAG_RE)
	const slice = firstTag === -1 ? raw : raw.slice(0, firstTag)
	return slice.replace(STRAY_OPTION_TAG_RE, "").trim()
}

function extractOptions(content: string): string[] {
	const options: string[] = []
	const iter = content.matchAll(OPTION_SOURCE)
	for (const match of iter) {
		const text = match[1].replace(STRAY_OPTION_TAG_RE, "").trim()
		if (text) options.push(text)
	}
	return options
}

function sameOptions(a: readonly string[], b: readonly string[]) {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

function sameDefaultValue(a: ParsedQuestion["defaultValue"], b: ParsedQuestion["defaultValue"]) {
	if (a === b) return true
	if (Array.isArray(a) && Array.isArray(b)) return sameOptions(a, b)
	return false
}

function sameQuestion(a: ParsedQuestion, b: ParsedQuestion) {
	return (
		a.type === b.type &&
		a.label === b.label &&
		a.placeholder === b.placeholder &&
		a.min === b.min &&
		a.max === b.max &&
		sameDefaultValue(a.defaultValue, b.defaultValue) &&
		a.isComplete === b.isComplete &&
		sameOptions(a.options, b.options)
	)
}

/**
 * 容错式流式解析：
 * - 允许未闭合 <question> / <option>
 * - 允许多余 </option>
 * - prev 传入上次结果，对未变化的 question 复用引用，便于 React.memo 跳过渲染
 */
export function parseQuestionsXml(raw: string, prev?: readonly ParsedQuestion[]): ParsedQuestion[] {
	if (!raw) return []

	// 硬截断：LLM / 后端异常输出不会拖垮主线程。宁可少解析几题也不卡 UI。
	const safeRaw = raw.length > MAX_RAW_BYTES ? raw.slice(0, MAX_RAW_BYTES) : raw

	const opens: { attrs: string; contentStart: number; tagStart: number }[] = []
	for (const match of safeRaw.matchAll(QUESTION_OPEN_SOURCE)) {
		const idx = match.index ?? 0
		opens.push({
			attrs: match[1],
			tagStart: idx,
			contentStart: idx + match[0].length,
		})
	}

	const result: ParsedQuestion[] = new Array(opens.length)
	for (let i = 0; i < opens.length; i++) {
		const cur = opens[i]
		const next = opens[i + 1]
		const content = safeRaw.slice(cur.contentStart, next ? next.tagStart : safeRaw.length)

		const typeRaw = (extractAttr(cur.attrs, "type") ?? "input").toLowerCase()
		const type: ParsedQuestion["type"] =
			typeRaw === "confirm" || typeRaw === "select" || typeRaw === "multi_select"
				? typeRaw
				: "input"

		const placeholder = extractAttr(cur.attrs, "placeholder")
		const isComplete = QUESTION_CLOSE_RE.test(content) || next !== undefined

		const label = normalizeLabel(content)
		const options: readonly string[] =
			type === "input" ? EMPTY_OPTIONS : extractOptions(content)

		const candidate: ParsedQuestion = {
			id: `q-${i}`,
			type,
			label,
			placeholder,
			min: parseFiniteInt(extractAttr(cur.attrs, "min")),
			max: parseFiniteInt(extractAttr(cur.attrs, "max")),
			defaultValue: parseDefaultValue(
				extractAttr(cur.attrs, "default_value") ||
					extractAttr(cur.attrs, "defaultValue") ||
					extractAttr(cur.attrs, "default"),
			),
			options,
			isComplete,
		}

		const previous = prev?.[i]
		result[i] = previous && sameQuestion(previous, candidate) ? previous : candidate
	}

	return result
}
