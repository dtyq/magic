const compression = require("./CompressionManager")

/**
 * 压缩中间件主函数
 */
function compressionMiddleware(req, res, next) {
	const strategy = compression.parser(req.headers)
	
	if (!strategy) {
		return res.status(400).json({
			code: 4003,
			message: "Unsupported compression type",
		})
	}
	
	// 执行解压缩
	strategy.decompress(req, res, next)
}

// 导出中间件和管理器（用于测试和扩展）
module.exports = compressionMiddleware
