import { READY_STATE_FALLBACK_MS } from "../shared/constants"

/** Create an offscreen hidden iframe as the HTML render sandbox container */
export function createHiddenIframe({
	htmlWidth,
	htmlHeight,
}: {
	htmlWidth: number
	htmlHeight: number
}): HTMLIFrameElement {
	const iframe = document.createElement("iframe")
	iframe.style.cssText = `
		width: ${htmlWidth}px;
		height: ${htmlHeight}px;
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
	/** Help videos decode and seek to the first frame inside the sandbox, together with muted and related attributes */
	iframe.setAttribute("allow", "autoplay")
	iframe.setAttribute("translate", "no")
	return iframe
}

export function normalizeSandboxHtml(html: string): string {
	return injectExportPatches(injectVideoCrossOriginAnonymous(decodeInlineScriptEntities(html)))
}

/**
 * Identify page content that may continue changing after the document reaches
 * `readyState === "complete"`. Static HTML still gets resource-specific waits
 * for images and videos, so it does not need the legacy fixed native-load
 * grace period. Executable pages and CSS that can load fonts or other external
 * resources retain that grace period for fidelity.
 */
export function requiresNativeLoadWait(html: string): boolean {
	return (
		/<script\b/i.test(html) ||
		/<link\b[^>]*\brel\s*=\s*(?:["'][^"']*\bstylesheet\b[^"']*["']|[^\s>]*\bstylesheet\b)/i.test(
			html,
		) ||
		/<(?:canvas|video|audio|iframe|object|embed)\b/i.test(html) ||
		/<(?:svg:)?(?:image|use)\b[^>]*(?:\bhref|\bxlink:href)\s*=/i.test(html) ||
		/\bon[a-z][\w:-]*\s*=/i.test(html) ||
		/\bdata-(?:render-ready|magic-export-ready)\s*=|@(?:font-face|import)\b|\burl\s*\(/i.test(
			html,
		)
	)
}

/** Determine whether the document is ready to enter the export render stage */
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

/**
 * Measure the document's actual content size for automatic pagination and PPT page width adaptation.
 * Fallback to the iframe size itself so short content still fills at least one page.
 */
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
	const width = Math.max(
		root?.scrollWidth ?? 0,
		root?.offsetWidth ?? 0,
		body?.scrollWidth ?? 0,
		body?.offsetWidth ?? 0,
		fallbackWidth,
	)
	const height = Math.max(
		root?.scrollHeight ?? 0,
		root?.offsetHeight ?? 0,
		body?.scrollHeight ?? 0,
		body?.offsetHeight ?? 0,
		fallbackHeight,
	)
	return { width, height }
}

/**
 * Inject `crossorigin="anonymous"` into opening `<video>` tags that do not declare crossorigin, using a single O(n) scan.
 * The implementation matches up to the first `>` with `[^>]*`; unescaped `>` inside attribute values would truncate incorrectly, so templates should avoid that or write crossorigin manually.
 * Literal `<video...>` text inside script/style would also be replaced, though exported HTML normally does not contain such fragments.
 */
function injectVideoCrossOriginAnonymous(html: string): string {
	return html.replace(/<video\b([^>]*)>/gi, (full) => {
		if (/\bcrossorigin\s*=/i.test(full)) return full
		return full.replace(/^<video\b/i, '<video crossorigin="anonymous"')
	})
}

/** Decode HTML-escaped characters inside inline scripts to avoid script content corruption */
function decodeInlineScriptEntities(rawHtml: string): string {
	return rawHtml.replace(
		/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
		(full, attrs: string, code: string) => {
			if (/\bsrc\s*=/.test(attrs)) return full
			const decodedCode = code
				.replace(/&amp;(?=(?:lt|gt|quot|#39|apos);)/gi, "&")
				.replace(/&lt;/gi, "<")
				.replace(/&gt;/gi, ">")
				.replace(/&quot;/gi, '"')
				.replace(/&#39;|&apos;/gi, "'")
			if (decodedCode === code) return full
			return `<script${attrs}>${decodedCode}</script>`
		},
	)
}

/**
 * Inject export patches:
 * 1. Mock IntersectionObserver by firing callbacks immediately with isIntersecting: true,
 *    so scroll-triggered fade-in animations do not stay inactive forever inside the offscreen iframe.
 * 2. Freeze CSS animations at their final frame instead of disabling them. A plain
 *    `animation: none` leaves animation-driven elements at their initial styles (often
 *    `opacity: 0`), which makes text disappear and makes image transparency resolve to 100%.
 */
const EXPORT_PATCHES = `<script>
(function(){
var O=window.IntersectionObserver;
var root=document.documentElement;
if(root) root.setAttribute("data-magic-export-mode","pptx");
window.__MAGIC_EXPORT_MODE__="pptx";
window.IntersectionObserver=function(cb,opts){
this._cb=cb;this._els=[];
};
window.IntersectionObserver.prototype.observe=function(el){
this._els.push(el);
var self=this;
Promise.resolve().then(function(){
self._cb([{target:el,isIntersecting:true,intersectionRatio:1,
boundingClientRect:el.getBoundingClientRect(),
intersectionRect:el.getBoundingClientRect(),
rootBounds:null,time:performance.now()}],self);
});
};
window.IntersectionObserver.prototype.unobserve=function(){};
window.IntersectionObserver.prototype.disconnect=function(){};
setTimeout(function(){window.dispatchEvent(new Event("magic:export-start"));},0);
})();
<\/script>
<style>*,*::before,*::after{
animation-play-state:paused!important;
animation-delay:-999999s!important;
animation-duration:1s!important;
animation-iteration-count:1!important;
animation-fill-mode:both!important;
transition:none!important;
}</style>`

function injectExportPatches(html: string): string {
	const headMatch = html.match(/<head\b[^>]*>/i)
	if (headMatch) {
		const insertPos = headMatch.index! + headMatch[0].length
		return html.slice(0, insertPos) + EXPORT_PATCHES + html.slice(insertPos)
	}
	const htmlMatch = html.match(/<html\b[^>]*>/i)
	if (htmlMatch) {
		const insertPos = htmlMatch.index! + htmlMatch[0].length
		return (
			html.slice(0, insertPos) + "<head>" + EXPORT_PATCHES + "</head>" + html.slice(insertPos)
		)
	}
	return EXPORT_PATCHES + html
}
