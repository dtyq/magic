import { act, render, renderHook } from "@testing-library/react"
import { createElement, useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePPTPresenterWindow } from "../usePPTPresenterWindow"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const home = { left: 0, top: 0, availLeft: 0, availTop: 24, availWidth: 1440, availHeight: 876 }
const external = { left: 1440, top: 0, width: 1920, height: 1080 }
let fullscreenElement: Element | null
let target: HTMLDivElement
let requestFullscreen: ReturnType<typeof vi.fn>
let popup: Window
let getScreenDetails: ReturnType<typeof vi.fn>

beforeEach(() => {
	fullscreenElement = null
	target = document.createElement("div")
	requestFullscreen = vi.fn(async () => {
		fullscreenElement = target
	})
	Object.assign(target, { requestFullscreen })
	Object.defineProperty(document, "fullscreenElement", {
		configurable: true,
		get: () => fullscreenElement,
	})
	Object.defineProperty(document, "exitFullscreen", {
		configurable: true,
		value: vi.fn(async () => {
			fullscreenElement = null
		}),
	})
	Object.defineProperty(window.screen, "isExtended", { configurable: true, value: true })
	getScreenDetails = vi.fn(async () => ({ currentScreen: home, screens: [home, external] }))
	Object.assign(window, { getScreenDetails })
	popup = {
		closed: false,
		document: document.implementation.createHTMLDocument(),
		focus: vi.fn(),
		moveTo: vi.fn(),
		resizeTo: vi.fn(),
		close: vi.fn(),
	} as unknown as Window
	vi.spyOn(window, "open").mockReturnValue(popup)
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.useRealTimers()
})
const setup = () => {
	const ref = { current: target }
	return renderHook(() => usePPTPresenterWindow(ref))
}

describe("fullscreen-first presenter", () => {
	it("does not call a missing exit API when a DOM ref is cleared during unmount", () => {
		Object.defineProperty(document, "exitFullscreen", { configurable: true, value: undefined })
		function Preview() {
			const ref = useRef<HTMLDivElement>(null)
			usePPTPresenterWindow(ref)
			return createElement("div", { ref })
		}
		const preview = render(createElement(Preview))
		expect(() => preview.unmount()).not.toThrow()
	})
	it("does not exit fullscreen when both the fullscreen element and target are empty", () => {
		const ref = { current: null }
		const { result } = renderHook(() => usePPTPresenterWindow(ref))
		act(() => result.current.close())
		expect(document.exitFullscreen).not.toHaveBeenCalled()
	})
	it("falls back without opening a popup when the standard exit API is missing", async () => {
		Object.defineProperty(document, "exitFullscreen", { configurable: true, value: undefined })
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("fallback")
		})
		expect(window.open).not.toHaveBeenCalled()
		expect(requestFullscreen).not.toHaveBeenCalled()
	})
	it("does not exit fullscreen owned by another element", () => {
		fullscreenElement = document.createElement("div")
		const { result } = setup()
		act(() => result.current.close())
		expect(document.exitFullscreen).not.toHaveBeenCalled()
	})
	it.each(["missing", "throws", "rejects"])(
		"cleans up safely when the exit API %s",
		async (failure) => {
			const { result } = setup()
			await act(async () => {
				await result.current.open()
			})
			Object.defineProperty(document, "exitFullscreen", {
				configurable: true,
				value:
					failure === "missing"
						? undefined
						: vi.fn(() => {
								if (failure === "throws") throw new Error("exit failed")
								return Promise.reject(new Error("exit failed"))
							}),
			})
			await act(async () => {
				expect(() => result.current.close()).not.toThrow()
			})
			expect(popup.close).toHaveBeenCalled()
			expect(result.current.isOpen).toBe(false)
			expect(result.current.consoleContainer).toBeNull()
		},
	)
	it("requests fullscreen before window.open consumes activation and renders only a console shell", async () => {
		let activation = true
		requestFullscreen.mockImplementation(async () => {
			if (!activation) throw new Error("activation consumed")
			fullscreenElement = target
		})
		vi.mocked(window.open).mockImplementation(() => {
			activation = false
			return popup
		})
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("opened")
		})
		expect(requestFullscreen).toHaveBeenCalledWith({ screen: external })
		expect(window.open).toHaveBeenCalledWith(
			"",
			"_blank",
			"popup,left=0,top=24,width=1440,height=876",
		)
		expect(result.current.consoleContainer?.ownerDocument).toBe(popup.document)
		expect(popup.document.querySelector("iframe")).toBeNull()
		expect(result.current.selectedScreen).toBe(1)
	})
	it("keeps native fullscreen when the companion popup is blocked", async () => {
		vi.mocked(window.open).mockReturnValue(null)
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("opened")
		})
		expect(fullscreenElement).toBe(target)
		expect(result.current.consoleContainer).toBeNull()
	})
	it("does not create a popup on a single display", async () => {
		Object.defineProperty(window.screen, "isExtended", { configurable: true, value: false })
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("fallback")
		})
		expect(window.open).not.toHaveBeenCalled()
		expect(requestFullscreen).not.toHaveBeenCalled()
	})
	it("does not open a popup if screen permission is rejected", async () => {
		getScreenDetails.mockRejectedValue(new Error("denied"))
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("fallback")
		})
		expect(window.open).not.toHaveBeenCalled()
		expect(result.current.isFallbackOnly).toBe(true)
	})
	it("closes the companion if native fullscreen fails", async () => {
		requestFullscreen.mockRejectedValue(new Error("denied"))
		const { result } = setup()
		await act(async () => {
			expect(await result.current.open()).toBe("fallback")
		})
		expect(popup.close).toHaveBeenCalled()
		expect(result.current.isOpen).toBe(false)
	})
	it("cancels pending permission without creating a late window", async () => {
		let resolve!: (value: unknown) => void
		getScreenDetails.mockReturnValue(
			new Promise((r) => {
				resolve = r
			}),
		)
		const { result } = setup()
		let operation!: Promise<unknown>
		act(() => {
			operation = result.current.open()
			result.current.close()
		})
		await act(async () => {
			resolve({ currentScreen: home, screens: [home, external] })
			expect(await operation).toBe("cancelled")
		})
		expect(window.open).not.toHaveBeenCalled()
	})
	it("ends fullscreen when the console is closed", async () => {
		const { result } = setup()
		await act(async () => {
			await result.current.open()
		})
		await act(async () => {
			result.current.close()
		})
		expect(popup.close).toHaveBeenCalled()
		expect(document.exitFullscreen).toHaveBeenCalled()
		expect(result.current.isOpen).toBe(false)
	})
	it("closes the console on native Escape and on unmount", async () => {
		const { result, unmount } = setup()
		await act(async () => {
			await result.current.open()
		})
		act(() => {
			fullscreenElement = null
			document.dispatchEvent(new Event("fullscreenchange"))
		})
		expect(result.current.isOpen).toBe(false)
		expect(popup.close).toHaveBeenCalledOnce()
		unmount()
	})
	it("accepts screen requests only from the same-origin companion", async () => {
		const { result } = setup()
		await act(async () => {
			await result.current.open()
		})
		requestFullscreen.mockClear()
		const send = (origin: string, source: Window | null, index: number) =>
			window.dispatchEvent(
				new MessageEvent("message", {
					origin,
					source,
					data: { type: "ppt-presenter:screen", index },
				}),
			)
		await act(async () => {
			send("https://untrusted.example", popup, 0)
			send(window.location.origin, null, 0)
			send(window.location.origin, popup, -1)
		})
		expect(requestFullscreen).not.toHaveBeenCalled()
		await act(async () => {
			send(window.location.origin, popup, 0)
		})
		expect(requestFullscreen).toHaveBeenCalledWith({ screen: home })
		expect(result.current.selectedScreen).toBe(0)
		expect(popup.moveTo).toHaveBeenCalledWith(1440, 0)
	})
	it("cancels fullscreen that completes after the user closes the session", async () => {
		let finish!: () => void
		requestFullscreen.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = () => {
						fullscreenElement = target
						resolve()
					}
				}),
		)
		const { result } = setup()
		let opening!: Promise<unknown>
		await act(async () => {
			opening = result.current.open()
			await Promise.resolve()
		})
		act(() => result.current.close())
		await act(async () => {
			finish()
			expect(await opening).toBe("cancelled")
		})
		expect(fullscreenElement).toBeNull()
		expect(result.current.consoleContainer).toBeNull()
	})
	it("ends the presentation when the companion window is closed externally", async () => {
		vi.useFakeTimers()
		const { result } = setup()
		await act(async () => {
			await result.current.open()
		})
		Object.assign(popup, { closed: true })
		await act(async () => {
			vi.advanceTimersByTime(500)
		})
		expect(document.exitFullscreen).toHaveBeenCalled()
		expect(result.current.isOpen).toBe(false)
	})
	it("does not fall back when a cancelled permission request rejects", async () => {
		let reject!: (reason: Error) => void
		getScreenDetails.mockReturnValue(
			new Promise((_, fail) => {
				reject = fail
			}),
		)
		const { result } = setup()
		let opening!: Promise<unknown>
		act(() => {
			opening = result.current.open()
			result.current.close()
		})
		await act(async () => {
			reject(new Error("permission denied"))
			expect(await opening).toBe("cancelled")
		})
		expect(result.current.isFallbackOnly).toBe(false)
		expect(window.open).not.toHaveBeenCalled()
	})
	it("does not reenter fullscreen when a cancelled screen switch completes", async () => {
		const { result } = setup()
		await act(async () => {
			await result.current.open()
		})
		let finish!: () => void
		requestFullscreen.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = () => {
						fullscreenElement = target
						resolve()
					}
				}),
		)
		let switching!: Promise<boolean>
		act(() => {
			switching = result.current.moveToScreen(0)
			result.current.close()
		})
		await act(async () => {
			finish()
			expect(await switching).toBe(false)
		})
		expect(fullscreenElement).toBeNull()
		expect(result.current.isOpen).toBe(false)
		expect(result.current.selectedScreen).toBe(1)
	})
})
