import UAParser from "ua-parser-js"
import CryptoJS from "@/opensource/utils/crypto"
import type { i18n } from "i18next"
import { magic } from "@/opensource/enhance/magicElectron"
import { getNativePort } from "@/opensource/platform/native"
import { Common } from "@/opensource/types/common"

/** * 是否为mac系统（包含iphone手机） * */
export const isMac = (() => {
	return /macintosh|mac os x/i.test(navigator.userAgent)
})()

/** * 是否为windows系统 * */
export const isWindows = (() => {
	return /windows|win32/i.test(navigator.userAgent)
})()

/** Is it a DingTalk environment */
export const isInDingTalkEnvironment = (() => {
	// 检测是否在钉钉环境中
	const ua = navigator.userAgent.toLowerCase()
	return /dingtalk/i.test(ua)
})()

/** * 是否为ios系统 * */
export const isIos = (() => {
	return /iphone|ipad/i.test(navigator.userAgent)
})()

export const isSmallViewport = () => {
	return window.innerWidth <= 768
}

/** * 是否为移动端 * */
export const isMobile = (() => {
	// Primary check: UserAgent based detection
	const userAgentMobile = /android|iphone|ipad|mobile|phone|tablet/i.test(navigator.userAgent)

	// Secondary check: Touch capability and viewport size (for better accuracy)
	const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0

	// Return true if UserAgent indicates mobile OR if it has touch + small viewport
	return userAgentMobile || (hasTouchScreen && isSmallViewport())
})()

/** * 是否在 Magic 移动客户端下 * */
export const isMagicApp = (() => {
	return /magic-ios|magic-android/i.test(navigator.userAgent)
})()

/** * 是否在 Magic IOS 移动客户端下 * */
export const isIosMagicApp = (() => {
	return /magic-ios/i.test(navigator.userAgent)
})()

/** * 是否在 Magic Android 移动客户端下 * */
export const isAndroidMagicApp = (() => {
	return /magic-android/i.test(navigator.userAgent)
})()

/**
 * 是否在审核流程中
 * @returns Promise<boolean>
 */
export const isInReviewProgress = () => {
	return getNativePort()
		.environment.getEnv()
		.then((env) => {
			return env.is_review_progress
		})
		.catch(() => {
			return false
		})
}

/**
 * 从 userAgent 中提取 Magic App 版本号
 * @returns 版本号字符串，如 "1.0.5" 或 "2.0"，如果未找到则返回 null
 */
function extractMagicAppVersion(): string | null {
	const ua = navigator.userAgent.toLowerCase()
	// 匹配两位或三位版本号格式：2.0 或 2.0.0
	const match = ua.match(/magic-(android|ios)-(\d+\.\d+(?:\.\d+)?)/i)
	return match ? match[2] : null
}

/**
 * 比较两个语义化版本号
 * @param version1 第一个版本号
 * @param version2 第二个版本号
 * @returns version1 >= version2 返回 true，否则返回 false
 */
function compareVersion(version1: string, version2: string): boolean {
	const v1Parts = version1.split(".").map(Number)
	const v2Parts = version2.split(".").map(Number)

	for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
		const v1 = v1Parts[i] || 0
		const v2 = v2Parts[i] || 0

		if (v1 > v2) return true
		if (v1 < v2) return false
	}

	return true // 相等
}

/**
 * 判断当前是否处于某个版本号之后（包含该版本号）的 Magic App 平台
 * @param targetVersion 目标版本号，如 "1.1.0"
 * @returns 如果当前版本 >= 目标版本返回 true，否则返回 false
 * @example
 * // 当前 userAgent 包含 magic-Android-1.0.5
 * isMagicAppVersionAtLeast("1.0.5") // true
 * isMagicAppVersionAtLeast("1.0.4") // true
 * isMagicAppVersionAtLeast("1.1.0") // false
 *
 * // 当前 userAgent 包含 magic-ios-2.0 (两位数版本号会被当作 2.0.0 处理)
 * isMagicAppVersionAtLeast("1.10.0") // true - 2.0.0 > 1.10.0
 * isMagicAppVersionAtLeast("2.0.0") // true
 * isMagicAppVersionAtLeast("2.0.1") // false
 */
export function isMagicAppVersionAtLeast(targetVersion: string): boolean {
	const currentVersion = extractMagicAppVersion()

	// 如果不在 Magic App 环境中，返回 false
	if (!currentVersion) {
		return false
	}

	return compareVersion(currentVersion, targetVersion)
}

/**
 * @description 获取浏览器指纹，设备信息，os, os版本等信息
 */
export async function getDeviceInfo(i18n: i18n): Promise<Common.DeviceInfo> {
	// 平台映射
	const platformMapping = {
		DingTalk: i18n.t("device.dingTalk", { ns: "interface" }),
		DingTalkAvoid: i18n.t("device.dingTalk", { ns: "interface" }),
		TeamshareWebAPP: `Teamshare {${i18n.t("device.app")}}`,
	}

	// 实例化UA解析器
	const ua = new UAParser()
	const { userAgent } = window.navigator
	const currentPlatform = Object.keys(platformMapping).find(
		(platform) => userAgent.indexOf(platform) > -1,
	)
	const { device, browser, os } = ua.getResult()

	// 组装 - 设备信息
	let deviceInfo = [
		device.vendor,
		device.model,
		`${
			currentPlatform ? platformMapping[currentPlatform as keyof typeof platformMapping] : ""
		}`,
	]
		.filter((attr) => !!attr)
		.join(" ")

	if (currentPlatform === "TeamshareWebAPP") deviceInfo = platformMapping[currentPlatform]

	// 组装 - 浏览器信息
	const browserInfo = `${browser.name} ${browser.version}`

	if (magic?.os?.getSystemInfo) {
		const systemInfo = await magic?.os?.getSystemInfo?.()
		return {
			id: systemInfo?.mac,
			name: systemInfo?.systemVersion,
			os: os.name || "",
			os_version: os.version || "",
		}
	}

	return {
		id: CryptoJS.MD5encryption(JSON.stringify(ua.getResult())),

		// 移动端/平板/platform，优先显示设备信息, 否则显示浏览器信息
		name:
			device.type === "mobile" || device.type === "tablet" || currentPlatform
				? deviceInfo || i18n.t("device.unknown")
				: browserInfo,
		os: os.name || "",
		os_version: os.version || "",
	}
}
