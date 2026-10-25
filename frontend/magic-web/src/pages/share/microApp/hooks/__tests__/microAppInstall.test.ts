import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	initializeMicroAppInstallPromptCapture,
	resetMicroAppInstallPromptCapture,
} from "@/services/microAppInstallPrompt"
import {
	buildExternalBrowserUrl,
	createMicroAppInstallController,
	detectMicroAppInstallEnvironment,
} from "../microAppInstall"

const originalUserAgent = navigator.userAgent
const originalPlatform = navigator.platform
const originalMaxTouchPoints = navigator.maxTouchPoints
const originalMatchMedia = window.matchMedia
const originalPath = window.location.pathname

function setNavigatorValue(key: string, value: unknown) {
	Object.defineProperty(navigator, key, { configurable: true, value })
}

beforeEach(() => {
	window.history.replaceState({}, "", "/micro-app/app-1")
	initializeMicroAppInstallPromptCapture()
})

afterEach(() => {
	resetMicroAppInstallPromptCapture()
	setNavigatorValue("userAgent", originalUserAgent)
	setNavigatorValue("platform", originalPlatform)
	setNavigatorValue("maxTouchPoints", originalMaxTouchPoints)
	window.matchMedia = originalMatchMedia
	window.history.replaceState({}, "", originalPath)
})

describe("microAppInstall", () => {
	it("detects iOS Safari manual installation and installed mode", () => {
		setNavigatorValue(
			"userAgent",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
		)
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		expect(detectMicroAppInstallEnvironment()).toMatchObject({
			isIOS: true,
			isEmbeddedWebView: false,
			isStandalone: false,
		})

		window.matchMedia = vi.fn().mockReturnValue({ matches: true })
		expect(detectMicroAppInstallEnvironment().isStandalone).toBe(true)
	})

	it("detects common embedded WebViews", () => {
		setNavigatorValue(
			"userAgent",
			"Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/124.0 Mobile Safari/537.36 MicroMessenger/8.0",
		)
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		expect(detectMicroAppInstallEnvironment().isEmbeddedWebView).toBe(true)
	})

	it("builds an Android browser intent without exposing an extra URL fragment", () => {
		expect(
			buildExternalBrowserUrl(
				"https://example.com/micro-app/1?source=share#section",
				"Mozilla/5.0 (Linux; Android 14)",
			),
		).toBe("intent://example.com/micro-app/1?source=share%23section#Intent;scheme=https;end")
		expect(buildExternalBrowserUrl("https://example.com/app", "iPhone")).toBe(
			"https://example.com/app",
		)
	})

	it("prompts only after beforeinstallprompt and handles acceptance", async () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		const statusChanges: string[] = []
		const controller = createMicroAppInstallController((status) => statusChanges.push(status))
		const prompt = vi.fn().mockResolvedValue(undefined)
		const event = Object.assign(new Event("beforeinstallprompt"), {
			prompt,
			userChoice: Promise.resolve({ outcome: "accepted" as const }),
		})

		expect(await controller.prompt()).toBe("unavailable")
		window.dispatchEvent(event)
		expect(controller.status).toBe("available")
		expect(await controller.prompt()).toBe("accepted")
		expect(prompt).toHaveBeenCalledTimes(1)
		expect(controller.status).toBe("installed")
		expect(statusChanges).toEqual(["available", "installed"])
		controller.destroy()
	})

	it("keeps a prompt dispatched before controller creation", async () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		const prompt = vi.fn().mockResolvedValue(undefined)
		window.dispatchEvent(
			Object.assign(new Event("beforeinstallprompt"), {
				prompt,
				userChoice: Promise.resolve({ outcome: "accepted" as const }),
			}),
		)

		const controller = createMicroAppInstallController()

		expect(controller.status).toBe("available")
		expect(await controller.prompt()).toBe("accepted")
		expect(prompt).toHaveBeenCalledTimes(1)
		controller.destroy()
	})

	it("does not reuse a prompt captured for another micro app route", async () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		const originalPath = window.location.pathname
		window.history.replaceState({}, "", "/micro-app/app-1")
		window.dispatchEvent(
			Object.assign(new Event("beforeinstallprompt"), {
				prompt: vi.fn().mockResolvedValue(undefined),
				userChoice: Promise.resolve({ outcome: "accepted" as const }),
			}),
		)

		window.history.replaceState({}, "", "/micro-app/app-2")
		const controller = createMicroAppInstallController()

		expect(controller.status).toBe("unsupported")
		window.dispatchEvent(
			Object.assign(new Event("beforeinstallprompt"), {
				prompt: vi.fn().mockResolvedValue(undefined),
				userChoice: Promise.resolve({ outcome: "accepted" as const }),
			}),
		)
		expect(controller.status).toBe("available")
		expect(await controller.prompt()).toBe("accepted")

		controller.destroy()
		window.history.replaceState({}, "", originalPath)
	})

	it("removes the install entry after the browser dismisses the prompt", async () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		const controller = createMicroAppInstallController()
		window.dispatchEvent(
			Object.assign(new Event("beforeinstallprompt"), {
				prompt: vi.fn().mockResolvedValue(undefined),
				userChoice: Promise.resolve({ outcome: "dismissed" as const }),
			}),
		)
		expect(await controller.prompt()).toBe("dismissed")
		expect(controller.status).toBe("unsupported")
		controller.destroy()
	})

	it("marks the app installed when the browser emits appinstalled", () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
		const statusChanges: string[] = []
		const controller = createMicroAppInstallController((status) => statusChanges.push(status))

		window.dispatchEvent(new Event("appinstalled"))

		expect(controller.status).toBe("installed")
		expect(statusChanges).toEqual(["installed"])
		controller.destroy()
	})
})
