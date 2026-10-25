import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useFullscreen } from "../hooks/useFullscreen"

const appEnv = vi.hoisted(() => ({
	isMagicApp: false,
}))

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return appEnv.isMagicApp
	},
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null
	webkitExitFullscreen?: () => Promise<void>
}

type FullscreenElement = HTMLElement & {
	requestFullscreen?: (options?: FullscreenOptions & { screen?: object }) => Promise<void>
	webkitRequestFullscreen?: () => Promise<void>
}

type WindowWithScreenDetails = Window & {
	getScreenDetails?: () => Promise<{
		currentScreen: object
		screens: object[]
	}>
}

function defineFullscreenState(
	key: "fullscreenElement" | "webkitFullscreenElement",
	value: Element | null,
) {
	Object.defineProperty(document, key, {
		configurable: true,
		get: () => value,
	})
}

function renderFullscreenHook(
	container: FullscreenElement,
	options?: {
		presenterTarget?: FullscreenElement
		presenterEnabled?: boolean
		beforeEnter?: () => boolean | Promise<boolean>
	},
) {
	return renderHook(() =>
		useFullscreen({
			containerRef: { current: container },
			presenterTargetRef: options?.presenterTarget
				? { current: options.presenterTarget }
				: undefined,
			presenterEnabled: options?.presenterEnabled,
			beforeEnter: options?.beforeEnter,
		}),
	)
}

describe("useFullscreen", () => {
	beforeEach(() => {
		appEnv.isMagicApp = false
		defineFullscreenState("fullscreenElement", null)
		defineFullscreenState("webkitFullscreenElement", null)
		delete (document as FullscreenDocument).webkitExitFullscreen
		delete (window as WindowWithScreenDetails).getScreenDetails
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: undefined,
		})
		Object.defineProperty(navigator, "permissions", {
			configurable: true,
			value: undefined,
		})
		vi.restoreAllMocks()
	})

	it("guards keyboard and iframe entry when the deck has no visible slides", async () => {
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const beforeEnter = vi.fn(() => false)
		const { result } = renderFullscreenHook(container, { beforeEnter })
		await act(async () => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "F11" }))
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "keyboardEvent", direction: "fullscreen" },
				}),
			)
		})
		expect(beforeEnter).toHaveBeenCalledTimes(2)
		expect(container.requestFullscreen).not.toHaveBeenCalled()
		expect(result.current.isFullscreen).toBe(false)
	})

	it("does not fall back to mobile fullscreen when the entry guard rejects", async () => {
		appEnv.isMagicApp = true
		const container = document.createElement("div") as FullscreenElement
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const { result } = renderFullscreenHook(container, {
			beforeEnter: () => Promise.reject(new Error("invalid config")),
		})
		await act(async () => {
			await result.current.toggleFullscreen()
		})
		expect(result.current.isFullscreen).toBe(false)
		error.mockRestore()
	})

	it("uses CSS fullscreen state in Magic App WebView without calling native fullscreen", async () => {
		appEnv.isMagicApp = true
		const lock = vi.fn(async () => undefined)
		Object.defineProperty(window.screen, "orientation", {
			configurable: true,
			value: { lock, unlock: vi.fn() },
		})
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)

		const { result } = renderFullscreenHook(container)

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(container.requestFullscreen).not.toHaveBeenCalled()
		expect(result.current.isFullscreen).toBe(true)
		expect(lock).toHaveBeenCalledWith("landscape")

		await act(async () => {
			await result.current.exitFullscreen()
		})

		expect(result.current.isFullscreen).toBe(false)
	})

	it("keeps native fullscreen behavior in normal browsers", async () => {
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)

		const { result } = renderFullscreenHook(container)

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(container.requestFullscreen).toHaveBeenCalledTimes(1)
		expect(result.current.isFullscreen).toBe(true)
	})

	it("syncs standard fullscreenchange events from the active container", () => {
		const container = document.createElement("div") as FullscreenElement
		const { result } = renderFullscreenHook(container)

		defineFullscreenState("fullscreenElement", container)

		act(() => {
			document.dispatchEvent(new Event("fullscreenchange"))
		})

		expect(result.current.isFullscreen).toBe(true)
	})

	it("syncs WebKit fullscreenchange events from the active container", () => {
		const container = document.createElement("div") as FullscreenElement
		const { result } = renderFullscreenHook(container)

		defineFullscreenState("webkitFullscreenElement", container)

		act(() => {
			document.dispatchEvent(new Event("webkitfullscreenchange"))
		})

		expect(result.current.isFullscreen).toBe(true)
	})

	it("falls back to CSS fullscreen and requests landscape when native API is unavailable", async () => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({ matches: true }),
		})
		const lock = vi.fn(async () => undefined)
		Object.defineProperty(window.screen, "orientation", {
			configurable: true,
			value: { lock, unlock: vi.fn() },
		})
		const container = document.createElement("div") as FullscreenElement
		const { result } = renderFullscreenHook(container)

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(result.current.isFullscreen).toBe(true)
		expect(lock).toHaveBeenCalledWith("landscape")
	})

	it("does not report desktop fullscreen when the native request is rejected", async () => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({ matches: false }),
		})
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => {
			throw new Error("permission denied")
		})
		const { result } = renderFullscreenHook(container)

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(result.current.isFullscreen).toBe(false)
	})

	it("presents only the slide stage on an external screen", async () => {
		const currentScreen = { left: 0, top: 0, width: 1440, height: 900 }
		const externalScreen = { left: 1440, top: 0, width: 1920, height: 1080 }
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: true,
		})
		;(window as WindowWithScreenDetails).getScreenDetails = vi.fn(async () => ({
			currentScreen,
			screens: [currentScreen, externalScreen],
		}))
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi.fn(async () => undefined)
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(stage.requestFullscreen).toHaveBeenCalledWith({ screen: externalScreen })
		expect(container.requestFullscreen).not.toHaveBeenCalled()
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(true)
	})

	it("uses ordinary fullscreen when window management is unsupported", async () => {
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi.fn(async () => undefined)
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(stage.requestFullscreen).not.toHaveBeenCalled()
		expect(container.requestFullscreen).toHaveBeenCalledWith()
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(false)
	})

	it("skips screen enumeration when the browser reports a single display", async () => {
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: false,
		})
		const getScreenDetails = vi.fn()
		;(window as WindowWithScreenDetails).getScreenDetails = getScreenDetails
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi.fn(async () => undefined)
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(getScreenDetails).not.toHaveBeenCalled()
		expect(stage.requestFullscreen).not.toHaveBeenCalled()
		expect(container.requestFullscreen).toHaveBeenCalledWith()
		expect(result.current.isPresenterView).toBe(false)
	})

	it("skips screen enumeration when window management permission is denied", async () => {
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: true,
		})
		Object.defineProperty(navigator, "permissions", {
			configurable: true,
			value: { query: vi.fn(async () => ({ state: "denied" })) },
		})
		const getScreenDetails = vi.fn()
		;(window as WindowWithScreenDetails).getScreenDetails = getScreenDetails
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi.fn(async () => undefined)
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(getScreenDetails).not.toHaveBeenCalled()
		expect(container.requestFullscreen).toHaveBeenCalledWith()
		expect(result.current.isPresenterView).toBe(false)
	})

	it.each([
		["permission rejection", "reject"],
		["single enumerated screen", "single"],
		["targeted fullscreen failure", "fullscreen"],
	] as const)("falls back to ordinary fullscreen after %s", async (_name, failure) => {
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: true,
		})
		const currentScreen = { left: 0, top: 0, width: 1440, height: 900 }
		const externalScreen = { left: 1440, top: 0, width: 1920, height: 1080 }
		;(window as WindowWithScreenDetails).getScreenDetails = vi.fn(async () => {
			if (failure === "reject") throw new Error("permission denied")
			return {
				currentScreen,
				screens: failure === "single" ? [currentScreen] : [currentScreen, externalScreen],
			}
		})
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi.fn(async () => undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi.fn(async () => {
			if (failure === "fullscreen") throw new Error("target rejected")
		})
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(container.requestFullscreen).toHaveBeenCalledWith()
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(false)
	})

	it("retries presenter after the recovered ordinary fullscreen exits", async () => {
		Object.defineProperty(window.screen, "isExtended", {
			configurable: true,
			value: true,
		})
		const currentScreen = { left: 0, top: 0, width: 1440, height: 900 }
		const externalScreen = { left: 1440, top: 0, width: 1920, height: 1080 }
		const getScreenDetails = vi.fn(async () => ({
			currentScreen,
			screens: [currentScreen, externalScreen],
		}))
		;(window as WindowWithScreenDetails).getScreenDetails = getScreenDetails
		const container = document.createElement("div") as FullscreenElement
		container.requestFullscreen = vi
			.fn()
			.mockRejectedValueOnce(new Error("activation consumed"))
			.mockResolvedValueOnce(undefined)
		const stage = document.createElement("div") as FullscreenElement
		stage.requestFullscreen = vi
			.fn()
			.mockRejectedValueOnce(new Error("target rejected"))
			.mockResolvedValueOnce(undefined)
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		await act(async () => {
			await result.current.toggleFullscreen()
		})
		expect(result.current.isFullscreen).toBe(false)

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(getScreenDetails).toHaveBeenCalledTimes(1)
		expect(stage.requestFullscreen).toHaveBeenCalledTimes(1)
		expect(container.requestFullscreen).toHaveBeenCalledTimes(2)
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(false)

		defineFullscreenState("fullscreenElement", container)
		act(() => document.dispatchEvent(new Event("fullscreenchange")))
		defineFullscreenState("fullscreenElement", null)
		act(() => document.dispatchEvent(new Event("fullscreenchange")))

		await act(async () => {
			await result.current.toggleFullscreen()
		})

		expect(getScreenDetails).toHaveBeenCalledTimes(2)
		expect(stage.requestFullscreen).toHaveBeenCalledTimes(2)
		expect(container.requestFullscreen).toHaveBeenCalledTimes(2)
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(true)
	})

	it("syncs presenter state from fullscreenchange and clears it on exit", () => {
		const container = document.createElement("div") as FullscreenElement
		const stage = document.createElement("div") as FullscreenElement
		const { result } = renderFullscreenHook(container, {
			presenterTarget: stage,
			presenterEnabled: true,
		})

		defineFullscreenState("fullscreenElement", stage)
		act(() => document.dispatchEvent(new Event("fullscreenchange")))
		expect(result.current.isFullscreen).toBe(true)
		expect(result.current.isPresenterView).toBe(true)

		defineFullscreenState("fullscreenElement", null)
		act(() => document.dispatchEvent(new Event("fullscreenchange")))
		expect(result.current.isFullscreen).toBe(false)
		expect(result.current.isPresenterView).toBe(false)
	})
})
