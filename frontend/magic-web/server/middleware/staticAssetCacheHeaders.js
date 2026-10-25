const { isDesignStylePreviewPath } = require("./designStylePreviewMiddleware")
const MAGIC_WIDGET_PUBLIC_PATH = "/sdk/magic-widget.js"
const MAGIC_HTML_SANDBOX_RUNTIME_PATH = "/husky-runtime.js"
const NEGOTIATED_CACHE_CONTROL = "no-cache"
const STRONG_STATIC_CACHE_CONTROL = "max-age=31536000"
const NO_STORE_CACHE_CONTROL = "no-cache, no-store, must-revalidate"

const noStoreStaticResourcePatterns = [
	/sw\.js$/,
	/\.html$/,
	/registerSW\.js$/,
	/favicon\.svg$/,
	/manifest\.webmanifest$/,
]

function normalizePathname(pathname) {
	return pathname.replace(/\\/g, "/")
}

function isMagicWidgetAsset(pathname) {
	return normalizePathname(pathname).endsWith(MAGIC_WIDGET_PUBLIC_PATH)
}

function isMagicHtmlSandboxRuntime(pathname) {
	return normalizePathname(pathname).endsWith(MAGIC_HTML_SANDBOX_RUNTIME_PATH)
}

function setStaticAssetCacheHeaders(res, pathname) {
	if (isDesignStylePreviewPath(pathname)) {
		// Keep the access middleware's browser-only revalidation policy on static responses.
		res.setHeader("Cache-Control", "private, no-cache")
		return
	}
	if (normalizePathname(pathname).endsWith("/html-design-style/catalog.json")) {
		// The catalog URL is stable across releases, so it must not stay fresh for a year.
		res.setHeader("Cache-Control", "public, no-cache")
		return
	}

	if (isMagicWidgetAsset(pathname)) {
		// The widget has a stable external URL, so browsers may store it but must revalidate each load.
		res.setHeader("Cache-Control", NEGOTIATED_CACHE_CONTROL)
		return
	}

	if (isMagicHtmlSandboxRuntime(pathname)) {
		// This stable runtime URL must revalidate on every deployment so a shared
		// HTML Sandbox shell does not execute a stale compatibility bundle.
		res.setHeader("Cache-Control", NEGOTIATED_CACHE_CONTROL)
		return
	}

	if (noStoreStaticResourcePatterns.some((pattern) => pattern.test(pathname))) {
		res.setHeader("Cache-Control", NO_STORE_CACHE_CONTROL)
		res.setHeader("Pragma", "no-cache")
		res.setHeader("Expires", "0")
		return
	}

	res.setHeader("Cache-Control", STRONG_STATIC_CACHE_CONTROL)
}

module.exports = {
	MAGIC_WIDGET_PUBLIC_PATH,
	MAGIC_HTML_SANDBOX_RUNTIME_PATH,
	setStaticAssetCacheHeaders,
}
