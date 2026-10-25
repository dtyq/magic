const path = require("node:path")

function isDesignStylePreviewPath(pathname) {
	// Match static resolution on case-insensitive filesystems as well as Linux.
	// Callers supply decoded URL paths or absolute filesystem paths.
	return path.posix
		.normalize(pathname.replace(/\\/g, "/"))
		.toLowerCase()
		.includes("/html-design-style/previews/")
}

// Browsers without Fetch Metadata (Safari < 16.4) send neither header, so the iframe check
// cannot be evaluated. Fall back to requiring a same-host Referer for that case only.
// If either header is present the strict check applies, so modern browsers never downgrade.
function isSameHostReferer(req) {
	const referer = req.get("Referer")
	const host = req.get("Host")
	if (!referer || !host) return false
	try {
		return new URL(referer).host === host
	} catch {
		return false
	}
}

function isAllowedPreviewRequest(req) {
	const dest = req.get("Sec-Fetch-Dest")
	const site = req.get("Sec-Fetch-Site")
	if (!dest && !site) return isSameHostReferer(req)
	return dest === "iframe" && site === "same-origin"
}

function designStylePreviewMiddleware(req, res, next) {
	let pathname
	try {
		pathname = decodeURIComponent(req.path)
	} catch {
		// Preserve the static server's malformed URL handling.
		return next()
	}
	if (!isDesignStylePreviewPath(pathname)) return next()

	// Fetch Metadata is a browser access restriction, not authentication.
	// Vary and private caching prevent an allowed iframe response being reused elsewhere.
	res.vary("Sec-Fetch-Dest")
	res.vary("Sec-Fetch-Site")
	res.vary("Referer")
	res.setHeader(
		"Content-Security-Policy",
		"frame-ancestors 'self'; sandbox; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
	)
	res.setHeader("X-Content-Type-Options", "nosniff")
	if (!["GET", "HEAD"].includes(req.method) || !isAllowedPreviewRequest(req)) {
		res.setHeader("Cache-Control", "no-store")
		return res.status(403).send("")
	}
	res.setHeader("Cache-Control", "private, no-cache")
	return next()
}

module.exports = { designStylePreviewMiddleware, isDesignStylePreviewPath }
