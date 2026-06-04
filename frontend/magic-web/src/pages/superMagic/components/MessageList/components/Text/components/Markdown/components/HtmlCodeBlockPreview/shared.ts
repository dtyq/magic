export const HTML_CODE_BLOCK_LANGUAGE = "html"
const ECHARTS_INIT_PATTERN = /\becharts\.init\s*\(/i

const HTML_PREVIEW_NON_RENDERING_TAG_NAMES = new Set([
	"base",
	"head",
	"link",
	"meta",
	"noscript",
	"script",
	"style",
	"template",
	"title",
])

/** 围栏内 HTML 正文：首尾 trim，空内容不计入预览（不再要求必须以 <!DOCTYPE html> 开头） */
export function normalizeHtmlFenceBodyCode(code: string): string | undefined {
	const normalized = code.trim()
	if (!normalized) return undefined
	return normalized
}

// 只有命中真正可见的文本节点或可渲染元素时，才保留 HTML 预览模式；
// 纯 style/link/script 这类非渲染标签会回退成“仅复制 + 展开源码”的卡片。
export function hasVisibleHtmlPreviewContent(code: string): boolean {
	const normalizedCode = normalizeHtmlFenceBodyCode(code)
	if (!normalizedCode) return false

	function hasVisibleContentByStringFallback(source: string): boolean {
		return (
			source
				.replace(/<!--[\s\S]*?-->/g, "")
				.replace(/<!DOCTYPE[^>]*>/gi, "")
				.replace(
					/<(?:noscript|script|style|template)\b[^>]*>[\s\S]*?<\/(?:noscript|script|style|template)>/gi,
					"",
				)
				.replace(/<\/?(?:html|head|body|base|link|meta|title)\b[^>]*>/gi, "")
				.trim().length > 0
		)
	}

	if (typeof DOMParser === "undefined") {
		return hasVisibleContentByStringFallback(normalizedCode)
	}

	const htmlDoc = new DOMParser().parseFromString(normalizedCode, "text/html")
	const hasScriptTag = /<script\b/i.test(normalizedCode)
	const hasEChartsInit = ECHARTS_INIT_PATTERN.test(normalizedCode)
	// 某些运行环境或异常 HTML 片段下，DOMParser 可能拿不到 body；
	// 这里优先复用 document 根节点，再不行就退回字符串判断，避免预览链路直接报错。
	const rootNode = htmlDoc.body ?? htmlDoc.documentElement

	if (!rootNode) {
		return hasVisibleContentByStringFallback(normalizedCode)
	}

	function isEChartsMountContainer(element: HTMLElement): boolean {
		if (!hasScriptTag || !hasEChartsInit) return false
		if (element.childNodes.length > 0) return false

		return Array.from(element.attributes).some((attribute) => {
			if (attribute.name === "id") return attribute.value.trim().length > 0
			if (attribute.name.startsWith("data-")) return true
			if (attribute.name === "class") return attribute.value.trim().length > 0
			return false
		})
	}

	function hasVisibleNode(node: Node): boolean {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent?.trim().length ? true : false
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return false
		}

		const element = node as HTMLElement
		const tagName = element.tagName.toLowerCase()

		if (tagName === "html" || tagName === "body") {
			return Array.from(element.childNodes).some(hasVisibleNode)
		}

		if (HTML_PREVIEW_NON_RENDERING_TAG_NAMES.has(tagName)) {
			return false
		}

		if (isEChartsMountContainer(element)) {
			return true
		}

		return true
	}

	return Array.from(rootNode.childNodes).some(hasVisibleNode)
}
