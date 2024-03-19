/**
 * @description 静态资源防盗链中间件
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function staticResourceMiddleware(req, res, next) {
	const referer = req.get("Referer")
	const host = req.get("Host")

	// 如果没有 Referer 头，拒绝访问
	if (!referer) {
		return res.status(403).json({
			code: 4003,
			message: "Access denied: Missing referer header",
		})
	}

	try {
		const refererUrl = new URL(referer)
		const refererHost = refererUrl.host

		// 检查 Referer 的域名是否与当前请求的 Host 相同
		if (refererHost !== host) {
			return res.status(403).json({
				code: 4003,
				message: "Access denied: Cross-origin request not allowed",
			})
		}

		next()
	} catch (error) {
		// Referer 格式无效
		return res.status(403).json({
			code: 4003,
			message: "Access denied: Invalid referer header",
		})
	}
}

module.exports = staticResourceMiddleware
