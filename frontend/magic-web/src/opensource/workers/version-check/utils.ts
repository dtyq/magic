/**
 * 使用函数生成一个UUID
 * @returns string
 */
export function generateUUID() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1)
	}
	return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

/**
 * 获取当前etag
 * @returns string
 */
export const getETag = async () => {
	try {
		const response = await fetch(self.location.origin, {
			method: "HEAD",
			cache: "no-cache",
		})
		return response.headers.get("etag") || response.headers.get("last-modified")
	} catch (error: any) {
		throw new Error(`Fetch failed: ${error?.message}`)
	}
}

/**
 * 获取最新APP版本号
 * @description 通过网络请求获取应用的最新版本号
 * @returns {Promise<string|undefined>} 成功返回版本号字符串，失败返回undefined
 */

export const getLatestAppVersion = async () => {
	try {
		const response = await fetch(`${self.location.origin}/config.js`, {
			method: "GET",
			cache: "no-cache",
		})
		const jsContent = await response.text()
		const config = JSON.parse(jsContent.replace("window.CONFIG = ", "")) as ImportMetaEnv
		return config.MAGIC_APP_VERSION
	} catch (error: any) {
		console.error(error)
		return undefined
	}
}

// 缓存正则表达式，避免重复创建
const VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/

/**
 * 判断两个版本号之间是否存在破坏性更新
 * @param currentVersion 当前版本号，格式为x.y或x.y.z
 * @param newVersion 新版本号，格式为x.y或x.y.z
 * @returns boolean 如果是破坏性更新返回true，否则返回false
 * @throws Error 当版本号格式无效时抛出错误
 */
export const isBreakingVersion = (currentVersion: string, newVersion: string): boolean => {
	// 验证版本号格式
	if (!VERSION_REGEX.test(currentVersion) || !VERSION_REGEX.test(newVersion)) {
		throw new Error("Invalid version format. Expected format: x.y[.z]")
	}

	// 将版本号分割为数组并转换为数字
	const [currentMajor = 0, currentMinor = 0] = currentVersion.split(".").map(Number)
	const [newMajor = 0, newMinor = 0] = newVersion.split(".").map(Number)

	// 只有当新版本大于当前版本时才是破坏性更新
	return newMajor > currentMajor || (newMajor === currentMajor && newMinor > currentMinor)
}
