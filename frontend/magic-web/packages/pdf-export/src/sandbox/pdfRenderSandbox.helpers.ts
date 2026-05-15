import {
	EXTERNAL_RESOURCE_TIMEOUT_MS,
	NATIVE_LOAD_WAIT_MS,
	READY_STATE_FALLBACK_MS,
	RENDER_TIMEOUT_MS,
} from "../shared/constants"

export function createHiddenIframe({
	pageWidthPx,
	pageHeightPx,
}: { pageWidthPx: number; pageHeightPx: number }): HTMLIFrameElement {
	const iframe = document.createElement("iframe")
	iframe.style.cssText = `
		width: ${pageWidthPx}px;
		height: ${pageHeightPx}px;
		position: fixed;
		left: -99999px;
		top: -99999px;
		z-index: -1;
		border: none;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		background: white;
		pointer-events: none;
	`
	iframe.setAttribute(
		"sandbox",
		"allow-scripts allow-modals allow-forms allow-same-origin allow-popups",
	)
	iframe.setAttribute("allow", "autoplay")
	iframe.setAttribute("translate", "no")
	return iframe
}

export function normalizeSandboxHtml(html: string): string {
	return injectVideoCrossOriginAnonymous(decodeInlineScriptEntities(html))
}

export function isDocumentReadyForRender({
	iframeDocument,
	renderStartedAt,
}: {
	iframeDocument: Document
	renderStartedAt: number
}): boolean {
	const isReadyStateComplete = iframeDocument.readyState === "complete"
	if (isReadyStateComplete) return true

	const hasDomScaffold = Boolean(iframeDocument.documentElement && iframeDocument.body)
	if (!hasDomScaffold) return false

	return Date.now() - renderStartedAt >= READY_STATE_FALLBACK_MS
}

const MAX_DESCENDANT_PAINT_PROBE = 12000

/**
 * 用子元素包围盒估计绘制宽高，弥补 body/html scrollHeight 在内部滚动、overflow 等场景下仍等于视口的问题。
 */
function measureDescendantPaintExtent(iframeDocument: Document): {
	width: number
	height: number
} {
	const win = iframeDocument.defaultView
	const body = iframeDocument.body
	if (!win || !body) return { width: 0, height: 0 }

	const scrollX = win.scrollX ?? win.pageXOffset ?? 0
	const scrollY = win.scrollY ?? win.pageYOffset ?? 0

	let maxRight = 0
	let maxBottom = 0

	const nodes = body.getElementsByTagName("*")
	const cap = Math.min(nodes.length, MAX_DESCENDANT_PAINT_PROBE)
	for (let i = 0; i < cap; i++) {
		const el = nodes[i]
		if (!el.getClientRects?.().length) continue
		let style: CSSStyleDeclaration
		try {
			style = win.getComputedStyle(el)
		} catch {
			continue
		}
		if (style.display === "none" || style.visibility === "hidden") continue

		const r = el.getBoundingClientRect()
		if (r.width <= 0 && r.height <= 0) continue

		maxRight = Math.max(maxRight, r.right + scrollX)
		maxBottom = Math.max(maxBottom, r.bottom + scrollY)
	}

	const br = body.getBoundingClientRect()
	maxRight = Math.max(maxRight, br.right + scrollX)
	maxBottom = Math.max(maxBottom, br.bottom + scrollY)

	return {
		width: Math.ceil(Math.max(0, maxRight)),
		height: Math.ceil(Math.max(0, maxBottom)),
	}
}

export function measureContentSize({
	iframeDocument,
	fallbackWidth,
	fallbackHeight,
}: {
	iframeDocument: Document
	fallbackWidth: number
	fallbackHeight: number
}): { width: number; height: number } {
	const root = iframeDocument.documentElement
	const body = iframeDocument.body
	const flowWidth = Math.max(
		root?.scrollWidth ?? 0,
		root?.offsetWidth ?? 0,
		body?.scrollWidth ?? 0,
		body?.offsetWidth ?? 0,
		fallbackWidth,
	)
	const flowHeight = Math.max(
		root?.scrollHeight ?? 0,
		root?.offsetHeight ?? 0,
		body?.scrollHeight ?? 0,
		body?.offsetHeight ?? 0,
		fallbackHeight,
	)
	const paint = measureDescendantPaintExtent(iframeDocument)
	return {
		width: Math.max(flowWidth, paint.width),
		height: Math.max(flowHeight, paint.height),
	}
}

export function resolveRenderTimeoutMs(): number {
	return Math.max(
		RENDER_TIMEOUT_MS,
		READY_STATE_FALLBACK_MS +
			NATIVE_LOAD_WAIT_MS +
			EXTERNAL_RESOURCE_TIMEOUT_MS +
			5000,
	)
}

function injectVideoCrossOriginAnonymous(html: string): string {
	return html.replace(/<video\b([^>]*)>/gi, (full) => {
		if (/\bcrossorigin\s*=/i.test(full)) return full
		return full.replace(/^<video\b/i, '<video crossorigin="anonymous"')
	})
}

function decodeInlineScriptEntities(rawHtml: string): string {
	return rawHtml.replace(
		/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
		(full, attrs: string, code: string) => {
			if (/\bsrc\s*=/.test(attrs)) return full
			const decodedCode = code
				.replace(/&amp;(?=(?:lt|gt|quot|#39|apos);)/gi, "&")
				.replace(/&lt;/gi, "<")
				.replace(/&gt;/gi, ">")
				.replace(/&quot;/gi, "\"")
				.replace(/&#39;|&apos;/gi, "'")
			if (decodedCode === code) return full
			return `<script${attrs}>${decodedCode}</script>`
		},
	)
}
