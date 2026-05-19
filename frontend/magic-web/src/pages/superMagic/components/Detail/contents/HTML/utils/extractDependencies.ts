import type { DependencyEntry, DependencyType } from "../components/DevConsole/types"

/**
 * Parse **processed** HTML content and extract all external resource references.
 *
 * The processed HTML may have had URLs rewritten by:
 *   - `rewriteHtmlCdnWithHost`  → leaves `data-original-src` / `data-original-href`
 *   - `processHtmlContent`      → leaves `data-original-path`
 *   - CSS url() replacement     → leaves `/*__ORIGINAL_URL__:path__* /url('...')`
 *
 * We read those markers to recover the **true original URL** and use the
 * current attribute value as the **resolved URL**.
 *
 * Returns DependencyEntry[] with source="static".
 */
export function extractStaticDependencies(html: string): DependencyEntry[] {
	if (!html) return []

	const parser = new DOMParser()
	const doc = parser.parseFromString(html, "text/html")
	const entries: DependencyEntry[] = []
	const seen = new Set<string>()
	let idCounter = 0

	function addEntry(
		originalUrl: string,
		resolvedUrl: string,
		tagName: string,
		attrName: string,
		type: DependencyType,
	) {
		// Dedup by resolved URL (the one actually loaded)
		const key = `${tagName}:${attrName}:${resolvedUrl}`
		if (seen.has(key)) return
		seen.add(key)

		entries.push({
			id: `static_${idCounter++}`,
			type,
			originalUrl,
			resolvedUrl,
			tagName,
			attrName,
			source: "static",
			timestamp: Date.now(),
		})
	}

	/**
	 * Recover the original URL from data-original-* markers left by the
	 * processing pipeline. Falls back to the current (resolved) value.
	 */
	function getOriginalUrl(el: Element, resolvedUrl: string): string {
		return (
			el.getAttribute("data-original-src") ||
			el.getAttribute("data-original-href") ||
			el.getAttribute("data-original-path") ||
			resolvedUrl
		)
	}

	// script[src]
	doc.querySelectorAll("script[src]").forEach((el) => {
		const resolvedUrl = el.getAttribute("src")
		if (resolvedUrl && !isDataOrBlob(resolvedUrl) && !isInjected(el)) {
			addEntry(getOriginalUrl(el, resolvedUrl), resolvedUrl, "SCRIPT", "src", "script")
		}
	})

	// link[href] — stylesheets, fonts, preloads, icons
	doc.querySelectorAll("link[href]").forEach((el) => {
		const resolvedUrl = el.getAttribute("href")
		const rel = (el.getAttribute("rel") || "").toLowerCase()
		if (!resolvedUrl || isDataOrBlob(resolvedUrl) || isInjected(el)) return
		const originalUrl = getOriginalUrl(el, resolvedUrl)

		if (rel.includes("stylesheet")) {
			addEntry(originalUrl, resolvedUrl, "LINK", "href", "stylesheet")
		} else if (rel.includes("preload") || rel.includes("prefetch")) {
			const as = (el.getAttribute("as") || "").toLowerCase()
			addEntry(originalUrl, resolvedUrl, "LINK", "href", asToType(as))
		} else if (rel.includes("icon") || rel.includes("apple-touch-icon")) {
			addEntry(originalUrl, resolvedUrl, "LINK", "href", "image")
		} else if (rel.includes("manifest")) {
			addEntry(originalUrl, resolvedUrl, "LINK", "href", "other")
		}
	})

	// img[src]
	doc.querySelectorAll("img[src]").forEach((el) => {
		const resolvedUrl = el.getAttribute("src")
		if (resolvedUrl && !isDataOrBlob(resolvedUrl) && !isInjected(el)) {
			addEntry(getOriginalUrl(el, resolvedUrl), resolvedUrl, "IMG", "src", "image")
		}
	})

	// video[src], audio[src]
	doc.querySelectorAll("video[src], audio[src]").forEach((el) => {
		const resolvedUrl = el.getAttribute("src")
		if (resolvedUrl && !isDataOrBlob(resolvedUrl)) {
			addEntry(getOriginalUrl(el, resolvedUrl), resolvedUrl, el.tagName, "src", "media")
		}
	})
	doc.querySelectorAll("video > source[src], audio > source[src]").forEach((el) => {
		const resolvedUrl = el.getAttribute("src")
		if (resolvedUrl && !isDataOrBlob(resolvedUrl)) {
			addEntry(getOriginalUrl(el, resolvedUrl), resolvedUrl, "SOURCE", "src", "media")
		}
	})

	// iframe[src]
	doc.querySelectorAll("iframe[src]").forEach((el) => {
		const resolvedUrl = el.getAttribute("src")
		if (resolvedUrl && !isDataOrBlob(resolvedUrl)) {
			addEntry(getOriginalUrl(el, resolvedUrl), resolvedUrl, "IFRAME", "src", "iframe")
		}
	})

	// @font-face / CSS url() in style tags
	// Recognise the /*__ORIGINAL_URL__:path__*/url('resolved') pattern
	doc.querySelectorAll("style").forEach((style) => {
		if (isInjected(style)) return
		const text = style.textContent || ""

		// Match both annotated and plain url() values
		const annotatedRegex =
			/\/\*__ORIGINAL_URL__:(.*?)__\*\/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi
		const plainRegex = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi

		// First pass: collect annotated entries and their positions
		const annotatedPositions = new Set<number>()
		let match
		while ((match = annotatedRegex.exec(text)) !== null) {
			const originalUrl = match[1]
			const resolvedUrl = match[2]
			if (resolvedUrl && !isDataOrBlob(resolvedUrl)) {
				addEntry(
					originalUrl,
					resolvedUrl,
					"STYLE",
					"url()",
					isFontUrl(resolvedUrl) ? "font" : "stylesheet",
				)
			}
			// Mark this range so we skip it in the plain pass
			annotatedPositions.add(match.index)
		}

		// Second pass: plain url() not covered by annotated patterns
		while ((match = plainRegex.exec(text)) !== null) {
			// Skip if this position is inside an annotated match
			if (isInsideAnnotated(text, match.index)) continue
			const url = match[1]
			if (url && !isDataOrBlob(url)) {
				addEntry(url, url, "STYLE", "url()", isFontUrl(url) ? "font" : "stylesheet")
			}
		}
	})

	return entries
}

/** Check if a position in text falls inside a /*__ORIGINAL_URL__:...__* /url(...) block */
function isInsideAnnotated(text: string, pos: number): boolean {
	// Look backwards for the annotation marker
	const prefix = text.slice(Math.max(0, pos - 200), pos)
	// If there's an annotation ending right before this url(), skip it
	return prefix.endsWith("*/")
}

function isDataOrBlob(url: string): boolean {
	return /^(data:|blob:|javascript:|about:)/i.test(url)
}

function isInjected(el: Element): boolean {
	return el.hasAttribute("data-injected")
}

function asToType(as: string): DependencyType {
	switch (as) {
		case "script":
			return "script"
		case "style":
			return "stylesheet"
		case "image":
			return "image"
		case "font":
			return "font"
		case "video":
		case "audio":
			return "media"
		default:
			return "other"
	}
}

function isFontUrl(url: string): boolean {
	return /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)
}
