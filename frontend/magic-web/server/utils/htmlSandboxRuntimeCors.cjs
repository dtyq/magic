const { MAGIC_HTML_SANDBOX_RUNTIME_PATH } = require("../middleware/staticAssetCacheHeaders")

function getOrigin(value) {
	if (typeof value !== "string" || !value.trim()) return null

	try {
		const url = new URL(value.trim())
		if (url.protocol !== "http:" && url.protocol !== "https:") return null
		return url.origin
	} catch {
		return null
	}
}

function getHtmlSandboxAllowedOrigins(env = process.env) {
	return [
		...new Set(
			[getOrigin(env.MAGIC_WEB_URL), getOrigin(env.MAGIC_HTML_SANDBOX_URL)].filter(Boolean),
		),
	]
}

function isHtmlSandboxRuntimeRequest(pathname) {
	return pathname === MAGIC_HTML_SANDBOX_RUNTIME_PATH
}

function setHtmlSandboxRuntimeCorsHeaders(res, requestOrigin, allowedOrigins) {
	const varyHeader = res.getHeader?.("Vary")
	const varyValues = String(varyHeader || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
	if (!varyValues.some((value) => value.toLowerCase() === "origin")) {
		res.setHeader("Vary", [...varyValues, "Origin"].join(", "))
	}

	if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
		res.setHeader("Access-Control-Allow-Origin", requestOrigin)
		return
	}

	if (typeof res.removeHeader === "function") {
		res.removeHeader("Access-Control-Allow-Origin")
	}
}

module.exports = {
	getOrigin,
	getHtmlSandboxAllowedOrigins,
	isHtmlSandboxRuntimeRequest,
	setHtmlSandboxRuntimeCorsHeaders,
}
