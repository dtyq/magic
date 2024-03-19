import { env } from "@/opensource/utils/env"

/**
 * 判断当前环境是否为APP
 * @returns {boolean} 是否为APP环境
 */
export function isInApp(): boolean {
	// 通过用户代理字符串检测是否为APP环境
	const userAgent = window?.navigator?.userAgent?.toLowerCase()

	// 检查特定的APP标识符
	// 这里可以根据实际的APP标识来调整
	const appIdentifiers = [
		"magic-android", // Android App标识
		"magic-ios", // iOS App标识
		// 添加其他可能的APP标识
	]

	// 检查是否存在webview标识
	const isWebView = userAgent.includes("wv") || userAgent.includes("webview")

	// 检查是否包含APP特定标识符
	const hasAppIdentifier = (identifier: string) => userAgent.includes(identifier)

	// 也可以通过自定义协议或全局变量来判断
	// 例如：APP可能会在window对象上设置一个特定变量
	const hasCustomAppFlag =
		typeof (window as any).isNativeApp !== "undefined" ||
		typeof (window as any).ReactNativeWebView !== "undefined"
	return isWebView || appIdentifiers.some(hasAppIdentifier) || hasCustomAppFlag
}

export function getBaseUrl() {
	if (isInApp()) {
		return env("MAGIC_WEB_URL")
	}
	return window?.location?.origin
}
