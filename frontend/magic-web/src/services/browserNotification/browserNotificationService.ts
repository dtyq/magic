import { browserNotificationPreference } from "./browserNotificationPreference"
import type { BrowserNotificationPayload } from "./types"

type BrowserType = "edge" | "chrome" | "firefox" | "safari" | "unknown"

const MACOS_NOTIFICATION_SETTINGS_URL =
	"x-apple.systempreferences:com.apple.Notifications-Settings.extension"
const WINDOWS_NOTIFICATION_SETTINGS_URL = "ms-settings:notifications"

function getNotificationConstructor() {
	if (typeof window === "undefined") return null
	return "Notification" in window ? window.Notification : null
}

function getBrowserType(): BrowserType {
	if (typeof window === "undefined") return "unknown"

	const userAgent = window.navigator.userAgent.toLowerCase()

	if (userAgent.includes("edg/")) return "edge"
	if (userAgent.includes("firefox/")) return "firefox"
	if (userAgent.includes("chrome/") || userAgent.includes("chromium/")) return "chrome"
	if (userAgent.includes("safari/")) return "safari"

	return "unknown"
}

export const browserNotificationService = {
	isSupported(): boolean {
		return Boolean(getNotificationConstructor())
	},

	getPermission(): NotificationPermission {
		const NotificationConstructor = getNotificationConstructor()
		return NotificationConstructor?.permission ?? "denied"
	},

	canNotify(): boolean {
		return this.isSupported() && this.getPermission() === "granted"
	},

	/**
	 * 用户开关已开，且浏览器 Notification.permission 为 granted。
	 * 操作系统级通知开关前端读不到，不能据此改写用户偏好。
	 */
	isEffectivelyEnabled(): boolean {
		return browserNotificationPreference.getEnabled() && this.canNotify()
	},

	async requestPermission(): Promise<NotificationPermission> {
		const NotificationConstructor = getNotificationConstructor()
		if (!NotificationConstructor?.requestPermission) return "denied"

		return NotificationConstructor.requestPermission()
	},

	async ensurePermissionEnabled(): Promise<boolean> {
		if (!this.isSupported()) return false

		const permission = this.getPermission()
		if (permission === "granted") return true
		if (permission === "denied") return false

		const nextPermission = await this.requestPermission()
		return nextPermission === "granted"
	},

	show(payload: BrowserNotificationPayload): Notification | null {
		if (!this.isEffectivelyEnabled()) return null

		try {
			const notification = new Notification(payload.title, {
				body: payload.body,
				tag: payload.tag,
				icon: payload.icon,
				data: payload.data,
				requireInteraction: true,
			})

			notification.onclick = (event) => {
				event.preventDefault()
				window.focus()
				payload.onClick?.()
				notification.close()
			}
			notification.onerror = () => payload.onError?.()

			return notification
		} catch {
			payload.onError?.()
			return null
		}
	},

	getBrowserNotificationSettingsUrl(): string | null {
		switch (getBrowserType()) {
			case "edge":
				return "edge://settings/content/notifications"
			case "chrome":
				return "chrome://settings/content/notifications"
			case "firefox":
				return "about:preferences#privacy"
			default:
				return null
		}
	},

	getSystemNotificationSettingsUrl(): string | null {
		if (typeof window === "undefined") return null

		const platform = window.navigator.platform.toLowerCase()
		const userAgent = window.navigator.userAgent.toLowerCase()
		const isMac = platform.includes("mac")
		const isWindows = platform.includes("win") || userAgent.includes("windows")

		if (isMac) return MACOS_NOTIFICATION_SETTINGS_URL
		if (isWindows) return WINDOWS_NOTIFICATION_SETTINGS_URL

		return null
	},
}
