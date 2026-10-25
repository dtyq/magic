import { slugify } from "@/utils/slug"

export interface HtmlNavigationRequest {
	/** Browser target intent; the host owns tab reuse and activation. */
	target?: string
	background?: boolean
	history?: "push" | "replace"
	/** Path used for attachment matching. It never contains query or hash. */
	filePath: string
	/** Complete query string, including the leading `?` when present. */
	search: string
	/** Complete hash string, including the leading `#` when present. */
	hash: string
	/** Normalized anchor used by the existing scroll implementation. */
	anchor: string
}

export type HtmlNavigationIntent = Pick<HtmlNavigationRequest, "target" | "background" | "history">

/** Message payloads are untrusted even after the iframe source/origin checks. */
export function getHtmlNavigationIntent(value: Record<string, unknown>): HtmlNavigationIntent {
	return {
		target: typeof value.target === "string" && value.target ? value.target : "_self",
		background: value.background === true,
		history: value.history === "replace" ? "replace" : "push",
	}
}

/**
 * Returns a stable identity for the runtime navigation state.
 *
 * The identity is used by the HTML renderer to distinguish a new document
 * navigation from an ordinary content update.
 */
export function getHtmlNavigationKey(navigation?: HtmlNavigationRequest): string {
	if (!navigation) return ""

	return [navigation.filePath, navigation.search, navigation.hash, navigation.anchor].join(
		"\u0000",
	)
}

function normalizeAnchor(hash: string): string {
	if (!hash) return ""

	const rawAnchor = hash.slice(1)
	let decodedAnchor = rawAnchor
	try {
		decodedAnchor = decodeURIComponent(rawAnchor)
	} catch {
		// Keep the original value when the hash contains malformed encoding.
	}

	return slugify(decodedAnchor)
}

function splitNavigationParts(value: string): HtmlNavigationRequest {
	const hashIndex = value.indexOf("#")
	const withoutHash = hashIndex === -1 ? value : value.slice(0, hashIndex)
	const hash = hashIndex === -1 ? "" : value.slice(hashIndex)
	const searchIndex = withoutHash.indexOf("?")

	return {
		filePath: searchIndex === -1 ? withoutHash : withoutHash.slice(0, searchIndex),
		search: searchIndex === -1 ? "" : withoutHash.slice(searchIndex),
		hash,
		anchor: normalizeAnchor(hash),
	}
}

/**
 * Parses navigation URLs used by HTML previews without changing Markdown link semantics.
 * Relative paths remain relative so the caller can resolve them against the current file
 * directory. Same-origin absolute URLs are converted to their pathname plus query/hash.
 */
export function parseHtmlNavigationRequest(
	href: string,
	baseHref?: string,
): HtmlNavigationRequest | null {
	if (typeof href !== "string") return null

	const value = href.trim()
	if (!value) return null
	if (value.startsWith("#") || value.startsWith("?")) return splitNavigationParts(value)

	if (/^(mailto:|tel:|javascript:|data:|blob:|about:|\/\/)/i.test(value)) {
		return null
	}

	if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
		if (!baseHref) return null

		try {
			const targetUrl = new URL(value)
			const baseUrl = new URL(baseHref)
			if (targetUrl.origin !== baseUrl.origin) return null
			return splitNavigationParts(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
		} catch {
			return null
		}
	}

	return splitNavigationParts(value)
}

function getNavigationFilePath(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) return ""

	try {
		if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
			return new URL(trimmed).pathname.replace(/^\/+/, "")
		}
	} catch {
		return ""
	}

	const parsed = parseHtmlNavigationRequest(trimmed)
	return (parsed?.filePath || trimmed).replace(/^\/+/, "").split(/[?#]/)[0]
}

/**
 * True when href is the preview iframe shell, not a project HTML file.
 * document.open after cancel is reported as this same-URL navigation.
 */
export function isHtmlPreviewShellNavigation(href: string, shellUrl = "/husky.html"): boolean {
	if (typeof href !== "string" || !href.trim()) return false

	const trimmedHref = href.trim()
	const trimmedShell = (shellUrl || "").trim()
	if (!trimmedShell) return false

	const isShellAbsolute = /^[a-z][a-z\d+.-]*:/i.test(trimmedShell)
	const isHrefAbsolute = /^[a-z][a-z\d+.-]*:/i.test(trimmedHref)

	// When shellUrl is a full absolute URL (e.g. cross-origin sandbox https://husky.pages.letsmagic.space/index.html):
	// A shell rewrite will always be the shell's own absolute URL.
	// Any relative link in a project (such as "index.html", "./index.html", "/index.html")
	// is a project file navigation and must never be blocked as a shell rewrite.
	if (isShellAbsolute) {
		if (!isHrefAbsolute) {
			return false
		}
		try {
			const shellUrlObj = new URL(trimmedShell)
			const hrefUrlObj = new URL(trimmedHref)
			return (
				shellUrlObj.origin === hrefUrlObj.origin &&
				shellUrlObj.pathname.replace(/\/+$/, "") === hrefUrlObj.pathname.replace(/\/+$/, "")
			)
		} catch {
			return false
		}
	}

	// For same-origin shell (default /husky.html or husky.html):
	// Do not treat explicit relative paths (e.g. "./husky.html", "slides/husky.html") as the shell.
	if (trimmedHref.startsWith("./")) {
		return false
	}

	const hrefPath = getNavigationFilePath(trimmedHref)
	const shellPath = getNavigationFilePath(trimmedShell)
	return Boolean(hrefPath && shellPath && hrefPath === shellPath)
}

const ROOT_INDEX_NAME = /^index\.html?$/i

/**
 * URL.pathname percent-encodes UTF-8. Project paths stay Unicode.
 * decodeURI leaves "/" "?" "#" encoded, so %2F is not a new segment.
 */
function decodeHtmlPreviewPath(path: string): string {
	if (!path.includes("%")) return path
	try {
		return decodeURI(path)
	} catch {
		return path
	}
}

/** Normalize preview paths: slashes, leading /, and repeated ./ prefixes. */
export function normalizeHtmlPreviewPath(path?: string): string {
	let value = decodeHtmlPreviewPath(path || "").replace(/\\/g, "/")
	while (value.startsWith("./")) {
		value = value.slice(2)
	}
	return value.replace(/^\/+/, "")
}

interface HtmlPreviewPathCandidate {
	file_name?: string
	name?: string
	relative_file_path?: string
}

/**
 * Resolve a root-only index.html fallback. Nested or path-less entries are ignored
 * so an ambiguous filename match cannot open the wrong file.
 */
export function resolveRootHtmlIndexFallback<T extends HtmlPreviewPathCandidate>(
	newPath: string,
	attachments?: T[],
): T | undefined {
	if (!ROOT_INDEX_NAME.test(newPath) || !attachments?.length) return undefined

	const rootCandidates = attachments.filter((attachment) => {
		const name = attachment.file_name || attachment.name || ""
		if (!ROOT_INDEX_NAME.test(name)) return false

		const candidatePath = normalizeHtmlPreviewPath(attachment.relative_file_path)
		return (
			Boolean(candidatePath) &&
			!candidatePath.includes("/") &&
			ROOT_INDEX_NAME.test(candidatePath)
		)
	})

	if (rootCandidates.length === 1) return rootCandidates[0]
	if (rootCandidates.length > 1) {
		const exactNameCandidates = rootCandidates.filter((attachment) => {
			const name = (attachment.file_name || attachment.name || "").toLowerCase()
			return name === newPath.toLowerCase()
		})
		if (exactNameCandidates.length === 1) return exactNameCandidates[0]
	}
	return undefined
}
