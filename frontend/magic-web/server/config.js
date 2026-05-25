const path = require("node:path")

/** 禁止使用公网域名，由于集群内域名请求不通，等运维处理 */

/** magic service(official service) */
module.exports.baseUrl = "http://magic-service:9501"

/** teamshare service(official service) */
module.exports.teamshareUrl = ""

/** keewood service(official service) */
module.exports.keewoodUrl = ""

/** CDN 地址 */
module.exports.CDNUrl = process.env.MAGIC_CDNHOST

/** 用户行为分析功能 */
const behaviorAnalysis = process.env?.MAGIC_USER_BEHAVIOR_ANALYSIS || "[]"
module.exports.behaviorAnalysis = JSON.parse(behaviorAnalysis)

/** 项目根路径 */
module.exports.rootPath = path.resolve(__dirname)

/** 暴露给前端的环境变量白名单 */
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
	"MAGIC_LOGIN_AUTHORIZATION_WHITELIST",
	"MAGIC_DEPLOYMENT_ID",
	"MAGIC_ENABLE_API_CACHE",
]

/**
 * @description 获取经过白名单过滤的安全环境变量
 * @returns {Record<string, string>}
 */
function getSafeEnvVars() {
	const safeEnvVars = {}
	for (const key of envVarWhitelist) {
		if (process.env[key] !== undefined) {
			safeEnvVars[key] = process.env[key]
		}
	}
	return safeEnvVars
}

module.exports.envVarWhitelist = envVarWhitelist
module.exports.getSafeEnvVars = getSafeEnvVars

