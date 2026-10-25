import UAParser from "ua-parser-js"
import CryptoJS from "@/utils/crypto"
import type { i18n } from "i18next"
import { magic } from "@/enhance/magicElectron"
import { getNativePort } from "@/platform/native"
import { Common } from "@/types/common"

interface NavigatorWithUserAgentData extends Navigator {
	userAgentData?: {
		mobile?: boolean
		platform?: string
	}
}

/** Detects Apple desktop and mobile systems. */
export const isMac = (() => {
	return /macintosh|mac os x/i.test(navigator.userAgent)
})()

/** Detects Windows systems. */
export const isWindows = (() => {
	return /windows|win32/i.test(navigator.userAgent)
})()

/** Is it a DingTalk environment */
export const isInDingTalkEnvironment = (() => {
	// DingTalk embeds its identifier in the browser user agent.
	const ua = navigator.userAgent.toLowerCase()
	return /dingtalk/i.test(ua)
})()

/** Detects iOS systems. */
export const isIos = (() => {
	return /iphone|ipad/i.test(navigator.userAgent)
})()

export const isSmallViewport = () => {
	return window.innerWidth <= 768
}

/** Detects mobile layouts. */
export const isMobile = (() => {
	// Primary check: UserAgent based detection
	const userAgentMobile = /android|iphone|ipad|mobile|phone|tablet/i.test(navigator.userAgent)

	// Secondary check: Touch capability and viewport size (for better accuracy)
	const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0

	// Return true if UserAgent indicates mobile OR if it has touch + small viewport
	return userAgentMobile || (hasTouchScreen && isSmallViewport())
})()

/**
 * Determines whether message input should follow desktop Enter behavior.
 * Only confidently identified desktop systems enable Enter-to-send.
 */
export function shouldUseDesktopEnterBehavior(): boolean {
	if (typeof navigator === "undefined") return false

	const currentNavigator = navigator as NavigatorWithUserAgentData
	const userAgent = navigator.userAgent
	const platform = navigator.platform
	const maxTouchPoints = navigator.maxTouchPoints ?? 0

	// Magic mobile WebViews always retain mobile message input behavior.
	if (/magic-(ios|android)/i.test(userAgent)) return false

	// Prefer Chromium's explicit mobile hint when the browser exposes it.
	if (currentNavigator.userAgentData?.mobile === true) return false

	// iPadOS may expose a macOS-like user agent when desktop browsing is enabled.
	const isIPadOS = /iPad/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)
	if (isIPadOS) return false

	// Known phone and tablet platforms retain newline-on-Enter behavior.
	if (/Android|iPhone|iPod|Mobile|Tablet/i.test(userAgent)) return false

	// Enable desktop behavior only for known desktop operating systems.
	return /Windows NT|Macintosh|X11|CrOS/i.test(userAgent)
}

/**
 * Detects touch-first layouts that cannot rely on CSS hover to reveal row actions.
 */
export function isNoHoverCoarsePointer(): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
	return window.matchMedia("(hover: none) and (pointer: coarse)").matches
}

/** Detects the Magic mobile app. */
export const isMagicApp = (() => {
	return /magic-ios|magic-android/i.test(navigator.userAgent)
})()

/** Detects the Magic iOS app. */
export const isIosMagicApp = (() => {
	return /magic-ios/i.test(navigator.userAgent)
})()

/** Detects the Magic Android app. */
export const isAndroidMagicApp = (() => {
	return /magic-android/i.test(navigator.userAgent)
})()

/**
 * Checks whether the native app is in its review process.
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
 * Extracts the Magic App version from the user agent.
 * @returns A version such as "1.0.5" or "2.0", or null when absent.
 */
function extractMagicAppVersion(): string | null {
	const ua = navigator.userAgent.toLowerCase()
	// Native clients publish either two-part or three-part versions.
	const match = ua.match(/magic-(android|ios)-(\d+\.\d+(?:\.\d+)?)/i)
	return match ? match[2] : null
}

/**
 * Compares two semantic versions.
 * @param version1 The first version.
 * @param version2 The second version.
 * @returns Whether version1 is at least version2.
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

	return true // Equal versions satisfy the minimum.
}

/**
 * Checks whether the Magic App meets a minimum version.
 * @param targetVersion The minimum supported version, such as "1.1.0".
 * @returns Whether the current app version meets the minimum.
 * @example
 * // The current user agent contains magic-Android-1.0.5.
 * isMagicAppVersionAtLeast("1.0.5") // true
 * isMagicAppVersionAtLeast("1.0.4") // true
 * isMagicAppVersionAtLeast("1.1.0") // false
 *
 * // The current user agent contains magic-ios-2.0, treated as 2.0.0.
 * isMagicAppVersionAtLeast("1.10.0") // true - 2.0.0 > 1.10.0
 * isMagicAppVersionAtLeast("2.0.0") // true
 * isMagicAppVersionAtLeast("2.0.1") // false
 */
export function isMagicAppVersionAtLeast(targetVersion: string): boolean {
	const currentVersion = extractMagicAppVersion()

	// A browser without a native app version cannot meet the requirement.
	if (!currentVersion) {
		return false
	}

	return compareVersion(currentVersion, targetVersion)
}

/**
 * Returns the browser fingerprint, device name, operating system and version.
 */
export async function getDeviceInfo(i18n: i18n): Promise<Common.DeviceInfo> {
	// Device identity and fallback names must not depend on a locale chunk loading.
	const ua = new UAParser()
	const { userAgent } = window.navigator
	const { device, browser, os } = ua.getResult()
	const hardwareInfo = [device.vendor, device.model].filter(Boolean).join(" ")
	const browserInfo = [browser.name, browser.version].filter(Boolean).join(" ")
	const runtimeFallback = hardwareInfo || browserInfo || userAgent

	// Login services and settings can reach this helper before their locale is ready.
	if (!i18n.isInitialized) {
		await new Promise<void>((resolve) => {
			const onInitialized = () => {
				i18n.off("initialized", onInitialized)
				resolve()
			}
			i18n.on("initialized", onInitialized)
		})
	}

	try {
		await new Promise<void>((resolve, reject) => {
			void i18n.loadNamespaces("login", (error) => {
				if (error) {
					reject(error)
					return
				}
				resolve()
			})
		})
	} catch {
		// Display translations are optional; preserve device identity on chunk failures.
	}
	const t = i18n.getFixedT(i18n.language, "login")
	const appLabel = t("device.app", { defaultValue: "" })

	// Keep platform labels in the login namespace for every caller.
	const platformMapping = {
		DingTalk: t("device.dingTalk", { defaultValue: runtimeFallback }),
		DingTalkAvoid: t("device.dingTalk", { defaultValue: runtimeFallback }),
		TeamshareWebAPP: appLabel ? `Teamshare {${appLabel}}` : runtimeFallback,
	}

	const currentPlatform = Object.keys(platformMapping).find(
		(platform) => userAgent.indexOf(platform) > -1,
	)
	const platformLabel = currentPlatform
		? platformMapping[currentPlatform as keyof typeof platformMapping]
		: ""

	// A failed translation may already contain the hardware name, so do not repeat it.
	let deviceInfo = [hardwareInfo, platformLabel === hardwareInfo ? "" : platformLabel]
		.filter((attr) => !!attr)
		.join(" ")

	if (currentPlatform === "TeamshareWebAPP") deviceInfo = platformMapping[currentPlatform]

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

		// Mobile devices and embedded platforms prefer device details over browser details.
		name:
			device.type === "mobile" || device.type === "tablet" || currentPlatform
				? deviceInfo || t("device.unknown", { defaultValue: runtimeFallback })
				: browserInfo || runtimeFallback,
		os: os.name || "",
		os_version: os.version || "",
	}
}
