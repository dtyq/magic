import { afterEach, describe, expect, it, vi } from "vitest"
import {
	initializeMicroAppInstallPromptCapture,
	resetMicroAppInstallPromptCapture,
	takeMicroAppInstallPrompt,
} from "../microAppInstallPrompt"

const originalPath = window.location.pathname

function dispatchInstallPrompt() {
	const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
		prompt: vi.fn().mockResolvedValue(undefined),
		userChoice: Promise.resolve({ outcome: "accepted" as const }),
	})
	const preventDefault = vi.spyOn(event, "preventDefault")
	window.dispatchEvent(event)
	return preventDefault
}

afterEach(() => {
	resetMicroAppInstallPromptCapture()
	window.history.replaceState({}, "", originalPath)
})

describe("microAppInstallPrompt", () => {
	it("does not swallow beforeinstallprompt outside micro-app routes", () => {
		window.history.replaceState({}, "", "/chat")
		initializeMicroAppInstallPromptCapture()

		const preventDefault = dispatchInstallPrompt()

		expect(preventDefault).not.toHaveBeenCalled()
		expect(takeMicroAppInstallPrompt("/chat")).toBeNull()
	})

	it("captures beforeinstallprompt on a micro-app share route", () => {
		window.history.replaceState({}, "", "/micro-app/app-1")
		initializeMicroAppInstallPromptCapture()

		const preventDefault = dispatchInstallPrompt()

		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(takeMicroAppInstallPrompt("/micro-app/app-1")).not.toBeNull()
	})

	it("reset clears captured prompt and listeners", () => {
		window.history.replaceState({}, "", "/micro-app/app-1")
		initializeMicroAppInstallPromptCapture()
		dispatchInstallPrompt()

		resetMicroAppInstallPromptCapture()

		expect(takeMicroAppInstallPrompt("/micro-app/app-1")).toBeNull()

		window.history.replaceState({}, "", "/chat")
		initializeMicroAppInstallPromptCapture()
		const preventDefault = dispatchInstallPrompt()
		expect(preventDefault).not.toHaveBeenCalled()
	})
})
