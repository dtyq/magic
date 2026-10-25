import {
	getMicroAppInstallRouteKey,
	subscribeToMicroAppInstallPrompt,
	takeMicroAppInstallPrompt,
} from "@/services/microAppInstallPrompt"

export type MicroAppInstallStatus = "unsupported" | "available" | "installed" | "ios-manual"
export type MicroAppInstallDialogMode = "browser" | "ios" | "webview"

export interface MicroAppInstallController {
	status: MicroAppInstallStatus
	prompt(): Promise<"accepted" | "dismissed" | "unavailable">
}

export interface MicroAppInstallEnvironment {
	isEmbeddedWebView: boolean
	isIOS: boolean
	isStandalone: boolean
}

export function getInitialMicroAppInstallStatus(
	environment: MicroAppInstallEnvironment,
): MicroAppInstallStatus {
	if (environment.isStandalone) return "installed"
	if (environment.isIOS && !environment.isEmbeddedWebView) return "ios-manual"
	return "unsupported"
}

export function buildExternalBrowserUrl(href: string, userAgent: string): string {
	const url = new URL(href)
	if (!/Android/i.test(userAgent)) return url.toString()
	const scheme = url.protocol.replace(":", "")
	const encodedHash = url.hash ? `%23${encodeURIComponent(url.hash.slice(1))}` : ""
	return `intent://${url.host}${url.pathname}${url.search}${encodedHash}#Intent;scheme=${scheme};end`
}

export function detectMicroAppInstallEnvironment(): MicroAppInstallEnvironment {
	if (typeof window === "undefined" || typeof navigator === "undefined") {
		return { isEmbeddedWebView: false, isIOS: false, isStandalone: false }
	}

	const userAgent = navigator.userAgent || ""
	const platform = navigator.platform || ""
	const isIOS =
		/iPhone|iPad|iPod/i.test(userAgent) ||
		(platform === "MacIntel" && navigator.maxTouchPoints > 1)
	const isStandalone =
		window.matchMedia?.("(display-mode: standalone)").matches === true ||
		// iOS Safari exposes this non-standard flag for installed web apps.
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	const isIOSWebView = isIOS && !/Safari/i.test(userAgent)
	const isAndroidWebView =
		/; wv\)|\bVersion\/\d[\d.]* Chrome\/|\bFBAN\b|\bMicroMessenger\b/i.test(userAgent)

	return { isEmbeddedWebView: isIOSWebView || isAndroidWebView, isIOS, isStandalone }
}

export function createMicroAppInstallController(
	onStatusChange?: (status: MicroAppInstallStatus) => void,
	appId?: string,
): MicroAppInstallController & {
	destroy(): void
	environment: MicroAppInstallEnvironment
} {
	const environment = detectMicroAppInstallEnvironment()
	const routeKey = appId
		? getMicroAppInstallRouteKey(`/micro-app/${appId}`)
		: getMicroAppInstallRouteKey()
	let status = getInitialMicroAppInstallStatus(environment)

	const setStatus = (nextStatus: MicroAppInstallStatus) => {
		status = nextStatus
		onStatusChange?.(nextStatus)
	}

	const unsubscribe = subscribeToMicroAppInstallPrompt((signal, signalRouteKey) => {
		if (signal === "installed") {
			setStatus("installed")
		} else if (!environment.isStandalone && signalRouteKey === routeKey) {
			setStatus("available")
		}
	}, routeKey)

	return {
		environment,
		get status() {
			return status
		},
		async prompt() {
			const promptEvent = takeMicroAppInstallPrompt(routeKey)
			if (!promptEvent) return "unavailable"
			await promptEvent.prompt()
			const choice = await promptEvent.userChoice
			if (choice.outcome === "accepted") {
				setStatus("installed")
				return "accepted"
			}
			if (!environment.isStandalone) setStatus("unsupported")
			return "dismissed"
		},
		destroy() {
			unsubscribe()
		},
	}
}
