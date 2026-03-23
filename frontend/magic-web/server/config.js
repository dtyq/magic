const path = require("node:path")

/** 禁止使用公网域名，由于集群内域名请求不通，等运维处理 */

/** magic service(official service) */
module.exports.baseUrl = "http://magic-service:9501"

/** teamshare service(official service) */
module.exports.teamshareUrl = "http://teamshare-service.teamshare:9501"

/** keewood service(official service) */
module.exports.keewoodUrl = "http://keewood-v2-service.teamshare:9501"

/** CDN 地址 */
module.exports.CDNUrl = process.env.MAGIC_CDNHOST || "/packages"

/** 用户行为分析功能 */
const behaviorAnalysis = process.env?.MAGIC_USER_BEHAVIOR_ANALYSIS || "[]"
module.exports.behaviorAnalysis = JSON.parse(behaviorAnalysis)

/** 项目根路径 */
module.exports.rootPath = path.resolve(__dirname)
