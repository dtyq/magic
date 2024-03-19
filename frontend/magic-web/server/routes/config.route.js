const R = require("ramda")
const crypto = require("node:crypto")

/**
 * @description 环境变脸白名单
 * @type {string[]}
 */
const envVarWhitelist = [
	"MAGIC_APP_ENV",
	"MAGIC_IS_PRIVATE_DEPLOY",
	"MAGIC_TEAMSHARE_BASE_URL",
	"MAGIC_SOCKET_BASE_URL",
	"MAGIC_SERVICE_BASE_URL",
	"MAGIC_SERVICE_KEEWOOD_BASE_URL",
	"MAGIC_SERVICE_TEAMSHARE_BASE_URL",
	"MAGIC_AMAP_KEY",
	"MAGIC_GATEWAY_ADDRESS",
	"MAGIC_TEAMSHARE_WEB_URL",
	"MAGIC_KEEWOOD_WEB_URL",
	"MAGIC_WEB_URL",
	"MAGIC_APP_VERSION",
	"MAGIC_APP_SHA",
	"MAGIC_EDITION",
	"MAGIC_ICP_CODE",
	"MAGIC_COPYRIGHT",
	"MAGIC_PRIVATE_DEPLOYMENT_CONFIG",
	"MAGIC_DEFAULT_LANGUAGE",
	"MAGIC_LOGIN_CONFIG",
	"MAGIC_PAYMENT_METHOD",
	"MAGIC_PUBLIC_CDN_URL",
	"MAGIC_CDNHOST",
	"MAGIC_USER_BEHAVIOR_ANALYSIS",
	"MAGIC_APM",
]

class Config {
	constructor() {
		// 在 Pod 启动时生成一次 ETag
		this.configETag = this._generateConfigETag()
		this.versionETag = this._generateVersionETag()
	}

	_generateConfigETag() {
		try {
			const safeEnvVars = R.pickBy(
				(_, key) => key.startsWith("MAGIC_") && envVarWhitelist.includes(key),
				process.env,
			)
			const content = JSON.stringify(safeEnvVars)
			return `"${crypto.createHash("md5").update(content).digest("hex")}"`
		} catch (error) {
			console.error("nodeServer", "Config", "Failed to generate config ETag:", error)
			return `"config-${Date.now()}"` // 降级：使用时间戳
		}
	}

	_generateVersionETag() {
		try {
			const version = process.env?.MAGIC_APP_VERSION ?? ""
			const sha = process.env?.MAGIC_APP_SHA ?? ""
			const content = JSON.stringify({ version, sha })
			return `"${crypto.createHash("md5").update(content).digest("hex")}"`
		} catch (error) {
			console.error("nodeServer", "Config", "Failed to generate version ETag:", error)
			return `"version-${Date.now()}"` // 降级：使用时间戳
		}
	}

	getConfigJs = (req, res) => {
		try {
			// 检查缓存（无需重新计算 ETag）
			if (req.headers?.["if-none-match"] === this.configETag) {
				return res.status(304).end()
			}

			const isSafeEnvironmentVariable = (key) => {
				// Only expose environment variables starting with MAGIC_ and in whitelist
				return key.startsWith("MAGIC_") && envVarWhitelist.includes(key)
			}

			const safeEnvVars = R.pickBy((_, key) => isSafeEnvironmentVariable(key), process.env)

			res.set("Content-Type", "text/javascript")
			res.setHeader("Cache-Control", "no-cache")
			res.setHeader("ETag", this.configETag)
			res.send(`window.CONFIG = ${JSON.stringify(safeEnvVars)}`)
		} catch (error) {
			console.error("nodeServer", "Config.getConfigJs", "Error:", error)
			res.status(500).json({
				code: 5000,
				message: "Failed to get config.js",
			})
		}
	}

	getConfig = (req, res) => {
		try {
			// 检查缓存
			if (req.headers?.["if-none-match"] === this.versionETag) {
				return res.status(304).end()
			}

			const versionWhitelist = ["MAGIC_APP_VERSION", "MAGIC_APP_SHA"]

			const isSafeEnvironmentVariable = (key) => {
				// Only expose environment variables starting with MAGIC_ and in whitelist
				return key.startsWith("MAGIC_") && versionWhitelist.includes(key)
			}

			const safeEnvVars = R.pickBy((_, key) => isSafeEnvironmentVariable(key), process.env)

			res.set("Content-Type", "application/json; charset=utf-8")
			res.setHeader("Cache-Control", "no-cache")
			res.setHeader("ETag", this.versionETag)
			res.send(JSON.stringify(safeEnvVars))
		} catch (error) {
			console.error("nodeServer", "Config.getConfig", "Error:", error)
			res.status(500).json({
				code: 5000,
				message: "Failed to get config",
			})
		}
	}

	heartbeat = (req, res) => {
		res.status(200).json({ data: 200 })
	}

	/**
	 * Kubernetes Liveness Probe - 检测容器是否存活
	 * 失败会导致容器重启
	 */
	liveness = (req, res) => {
		// 只检查进程是否响应
		res.status(200).json({
			status: "alive",
			timestamp: Date.now(),
			uptime: process.uptime(),
		})
	}

	/**
	 * Kubernetes Readiness Probe - 检测容器是否就绪
	 * 失败会从 Service 负载均衡中摘除
	 */
	readiness = async (req, res) => {
		const usage = process.memoryUsage()
		const heapUsedPercent = usage.heapUsed / usage.heapTotal
		const checks = {
			healthy: heapUsedPercent < 0.9,
			heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
			heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
			percentage: Math.round(heapUsedPercent * 100),
		}

		if (checks.healthy) {
			res.status(200).json({
				status: "ready",
				timestamp: Date.now(),
				checks,
			})
		} else {
			res.status(503).json({
				status: "not_ready",
				timestamp: Date.now(),
				checks,
			})
		}
	}

	/**
	 * Startup Probe - 检测容器启动完成（可选，用于慢启动应用）
	 */
	startup = (req, res) => {
		// 检查应用初始化是否完成
		// if (global.appInitialized) {
		res.status(200).json({ status: "started" })
		// } else {
		// 	res.status(503).json({ status: "starting" })
		// }
	}
}

module.exports = Config
