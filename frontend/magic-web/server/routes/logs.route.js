const { logger } = require("../logger.cjs")

class Logs {
	async report(req, res) {
		try {
			// 检查请求体是否存在
			if (!req.body) {
				return res.status(400).json({
					code: 4002,
					message: "Request body is empty",
				})
			}

			// 获取完整的代理链 IP
			const proxyChain = req.headers["x-forwarded-for"]
				? req.headers["x-forwarded-for"].split(",")
				: []

			// 清洗空格并反转顺序（客户端真实 IP 在最前面）
			const ips = proxyChain.map((ip) => ip.trim()).reverse()

			// 设置到 req 对象
			const ipMeta = {
				ips,
				remoteAddress: req.socket.remoteAddress.replace("::ffff:", ""),
			}

			const logs = req.body
			if (Array.isArray(logs)) {
				logs.forEach((log) => {
					log.ipMeta = ipMeta
					logger.error(log)
				})
			} else {
				logs.ipMeta = ipMeta
				logger.error(logs)
			}

			res.status(200).json({
				code: 1000,
				message: "Logs reported successfully.",
			})
		} catch (error) {
			console.error("Error processing log report:", error)
			res.status(500).json({
				code: 5000,
				message: "Internal server error while processing logs",
			})
		}
	}
}

module.exports = Logs
