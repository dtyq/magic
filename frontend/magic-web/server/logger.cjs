const bunyan = require("node-bunyan")
const morgan = require("morgan")

// 创建Bunyan日志记录器
const logger = bunyan.createLogger({
	name: "magic-web",
	streams: [
		// 输出到文件
		{ level: "info", path: "./error.log" },
		// 输出到控制台
		{ level: "error", stream: process.stdout },
	],
})

// 创建Morgan日志中间件
const morganMiddleware = morgan("combined", {
	stream: { write: (message) => logger.error(message) },
})

module.exports = { logger, morganMiddleware }
