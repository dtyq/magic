const { baseUrl } = require("../config")

// 缓存配置
const CACHE_DURATION = 10 * 60 * 1000 // 10分钟
let cachedData = null
let cacheTimestamp = null
let pendingRequest = null

/** 获取全局平台信息 */
module.exports = async () => {
	// 检查缓存是否有效（小于10分钟）
	const now = Date.now()
	if (cachedData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
		return cachedData
	}

	// 如果有正在进行的请求，返回该 Promise（共享读取锁）
	if (pendingRequest) {
		return pendingRequest
	}

	// 创建新请求
	pendingRequest = (async () => {
		try {
			const apiUrl = `${baseUrl}/api/v1/settings/global`
			const response = await fetch(apiUrl, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})
			const result = await response.json()
			const data = result?.data || {}

			// 更新缓存
			cachedData = data
			cacheTimestamp = Date.now()

			return data
		} finally {
			// 请求完成后清除 pending 状态
			pendingRequest = null
		}
	})()

	return pendingRequest
}
