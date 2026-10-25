const NO_INDEX_ROBOTS_DIRECTIVE = "noindex, nofollow, noarchive, nosnippet"

function noIndexMiddleware(req, res, next) {
	res.setHeader("X-Robots-Tag", NO_INDEX_ROBOTS_DIRECTIVE)
	next()
}

module.exports = noIndexMiddleware
module.exports.NO_INDEX_ROBOTS_DIRECTIVE = NO_INDEX_ROBOTS_DIRECTIVE
