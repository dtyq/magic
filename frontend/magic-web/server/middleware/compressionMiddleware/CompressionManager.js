const zlib = require("node:zlib")
const LZString = require("lz-string")

/**
 * 压缩策略基类
 */
class CompressionStrategy {
	/**
	 * 检查是否支持该压缩类型
	 * @param {Object} headers - 请求头
	 * @returns {boolean}
	 */
	supports(headers) {
		throw new Error("supports method must be implemented")
	}
	
	/**
	 * 解压缩数据
	 * @param {Object} req - 请求对象
	 * @param {Object} res - 响应对象
	 * @param {Function} next - next 函数
	 */
	decompress(req, res, next) {
		throw new Error("decompress method must be implemented")
	}
}

/**
 * Gzip 解压缩策略
 */
class GzipStrategy extends CompressionStrategy {
	supports(headers) {
		return headers["content-encoding"]?.toLowerCase() === "gzip"
	}
	
	decompress(req, res, next) {
		const chunks = []
		
		req.on("data", (chunk) => {
			chunks.push(chunk)
		})
		
		req.on("end", () => {
			try {
				const buffer = Buffer.concat(chunks)
				const decompressed = zlib.gunzipSync(buffer)
				req.body = JSON.parse(decompressed.toString("utf8"))
				
				next()
			} catch (error) {
				console.error("Failed to decompress gzip data:", error)
				return res.status(400).json({
					code: 4000,
					message: "Invalid gzip compressed data",
					error: error.message,
				})
			}
		})
		
		req.on("error", (error) => {
			console.error("Request stream error:", error)
			return res.status(400).json({
				code: 4000,
				message: "Request processing error in gzip strategy",
			})
		})
	}
}

/**
 * LZ-String 解压缩策略
 */
class LZStringStrategy extends CompressionStrategy {
	supports(headers) {
		return headers["x-compression"]?.toLowerCase() === "lz-string"
	}
	
	decompress(req, res, next) {
		let body = ""
		req.setEncoding("utf8")
		
		req.on("data", (chunk) => {
			body += chunk
		})
		
		req.on("end", () => {
			try {
				// LZ-String 解压缩
				const decompressed = LZString.decompress(body)
				
				if (decompressed === null || decompressed === undefined) {
					throw new Error("LZ-String decompression returned null/undefined")
				}
				
				req.body = JSON.parse(decompressed)
				
				next()
			} catch (error) {
				console.error("Failed to decompress LZ-String data:", error)
				return res.status(400).json({
					code: 4001,
					message: "Invalid LZ-String compressed data",
					error: error.message,
				})
			}
		})
		
		req.on("error", (error) => {
			console.error("Request stream error:", error)
			return res.status(400).json({
				code: 4001,
				message: "Request processing error in lz-string strategy",
			})
		})
	}
}

/**
 * 无压缩策略（直接通过）
 */
class NoCompressionStrategy extends CompressionStrategy {
	supports(headers) {
		return !headers["content-encoding"] && !headers["x-compression"]
	}
	
	decompress(req, res, next) {
		next()
	}
}

/**
 * 压缩策略管理器
 */
class CompressionManager {
	constructor() {
		this.strategies = [
			new GzipStrategy(),
			new LZStringStrategy(),
			new NoCompressionStrategy(), // 放在最后作为默认策略
		]
	}
	
	/**
	 * 添加新的压缩策略
	 * @param {CompressionStrategy} strategy
	 */
	addStrategy(strategy) {
		if (!(strategy instanceof CompressionStrategy)) {
			throw new Error("Strategy must extend CompressionStrategy")
		}
		// 插入到无压缩策略之前
		this.strategies.splice(-1, 0, strategy)
	}
	
	/**
	 * 根据请求头选择合适的策略
	 * @param {Object} headers
	 * @returns {CompressionStrategy|null}
	 */
	parser(headers) {
		return this.strategies.find((strategy) => strategy.supports(headers)) || null
	}
}

// 创建全局策略管理器实例
const compression = new CompressionManager()

module.exports = compression
