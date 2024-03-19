const { logger } = require("../logger.cjs")

/**
 * K8s 内部访问白名单中间件
 * 只允许来自 K8s 集群内部的请求访问健康检查端点
 */
function k8sOnlyMiddleware(req, res, next) {
	const clientIP = getClientIP(req)

	// K8s 内部 IP 范围（根据您的集群配置调整）
	const allowedRanges = [
		"127.0.0.1", // localhost（本地健康检查）
		"::1", // IPv6 localhost
	]

	// 检查是否来自允许的 IP 范围
	if (isIPAllowed(clientIP, allowedRanges)) {
		return next()
	}

	// 记录未授权访问尝试
	logger.warn(
		{
			type: "unauthorized_health_check",
			clientIP,
			path: req.path,
			userAgent: req.get("User-Agent"),
		},
		"Unauthorized health check access attempt",
	)

	// 返回 403 或伪装成 404
	res.status(404).send("Not Found")
}

/**
 * 获取客户端真实 IP
 */
function getClientIP(req) {
	// 信任 K8s Ingress 传递的 X-Forwarded-For
	const forwarded = req.headers["x-forwarded-for"]
	if (forwarded) {
		return forwarded.split(",")[0].trim()
	}

	const realIP = req.headers["x-real-ip"]
	if (realIP) {
		return realIP
	}

	return req.ip || req.connection.remoteAddress
}

/**
 * 检查 IP 是否在允许的范围内
 */
function isIPAllowed(ip, allowedRanges) {
	// 移除 IPv6 前缀（如果是 IPv4 映射）
	ip = ip.replace(/^::ffff:/, "")

	for (const range of allowedRanges) {
		if (range.includes("/")) {
			// CIDR 范围检查
			if (isIPInCIDR(ip, range)) {
				return true
			}
		} else {
			// 精确匹配
			if (ip === range) {
				return true
			}
		}
	}

	return false
}

/**
 * 检查 IP 是否在 CIDR 范围内
 */
function isIPInCIDR(ip, cidr) {
	try {
		const [range, bits] = cidr.split("/")
		const mask = ~(2 ** (32 - parseInt(bits)) - 1)

		const ipNum = ipToNumber(ip)
		const rangeNum = ipToNumber(range)

		return (ipNum & mask) === (rangeNum & mask)
	} catch (error) {
		return false
	}
}

/**
 * IP 字符串转数字
 */
function ipToNumber(ip) {
	return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
}

module.exports = k8sOnlyMiddleware
