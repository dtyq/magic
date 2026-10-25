import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import install from "../content-metrics"

describe("content metrics runtime", () => {
	let iframe: HTMLIFrameElement
	let resize: () => void
	let mutate: () => void
	const resizeObserve = vi.fn()
	const mutationObserve = vi.fn()
	let postMessage: ReturnType<typeof spyOnParent>

	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		iframe = document.createElement("iframe")
		document.body.append(iframe)
		const sandbox = iframe.contentWindow as Window
		postMessage = spyOnParent(sandbox.parent)
		vi.stubGlobal("window", sandbox)
		vi.stubGlobal("document", sandbox.document)
		vi.spyOn(document, "readyState", "get").mockReturnValue("complete")
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
			setTimeout(() => callback(0), 16),
		)
		vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn().mockImplementation((callback: () => void) => {
				resize = callback
				return { observe: resizeObserve }
			}),
		)
		vi.stubGlobal(
			"MutationObserver",
			vi.fn().mockImplementation((callback: () => void) => {
				mutate = callback
				return { observe: mutationObserve }
			}),
		)
	})
	afterEach(() => {
		vi.clearAllTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		vi.useRealTimers()
		iframe.remove()
	})

	it("reports natural dimensions rounded up to the configured parent origin", () => {
		Object.defineProperty(document.documentElement, "scrollWidth", {
			configurable: true,
			value: 800,
		})
		Object.defineProperty(document.body, "scrollHeight", { configurable: true, value: 1000 })
		vi.spyOn(document.body, "getBoundingClientRect").mockReturnValue({
			width: 801.2,
			height: 1001.4,
		} as DOMRect)
		install({ parentOrigin: "https://host.example" })
		vi.advanceTimersByTime(16)
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "contentMetrics", contentWidth: 802, contentHeight: 1002, phase: "initial" },
			"https://host.example",
		)
		vi.advanceTimersByTime(184)
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "contentMetrics", contentWidth: 802, contentHeight: 1002, phase: "settled" },
			"https://host.example",
		)
		expect(resizeObserve.mock.calls).toEqual([[document.documentElement], [document.body]])
		expect(mutationObserve).toHaveBeenCalledWith(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
			childList: true,
			subtree: true,
			characterData: true,
		})
	})

	it("coalesces repeated resize/mutation signals and resets the settled deadline", () => {
		install({ parentOrigin: "*" })
		resize()
		mutate()
		vi.advanceTimersByTime(16)
		expect(postMessage).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(84)
		mutate()
		vi.advanceTimersByTime(100)
		expect(postMessage.mock.calls.map(([message]) => message.phase)).toEqual([
			"initial",
			"initial",
		])
		vi.advanceTimersByTime(100)
		expect(postMessage.mock.calls.map(([message]) => message.phase)).toEqual([
			"initial",
			"initial",
			"settled",
		])
	})

	it("waits for DOM content and observes only once across repeated installation", () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("loading")
		install({ parentOrigin: "https://first.example" })
		install({ parentOrigin: "https://second.example" })
		expect(resizeObserve).not.toHaveBeenCalled()
		document.dispatchEvent(new Event("DOMContentLoaded"))
		document.dispatchEvent(new Event("DOMContentLoaded"))
		vi.advanceTimersByTime(200)
		expect(resizeObserve).toHaveBeenCalledTimes(2)
		expect(postMessage).toHaveBeenCalledTimes(2)
		expect(
			postMessage.mock.calls.every(
				(call) => (call as unknown[])[1] === "https://first.example",
			),
		).toBe(true)
	})

	it("still reports without observers and tolerates an unavailable parent receiver", () => {
		vi.stubGlobal("ResizeObserver", undefined)
		vi.stubGlobal("MutationObserver", undefined)
		postMessage.mockImplementation(() => {
			throw new Error("unavailable")
		})
		install({ parentOrigin: "https://host.example" })
		expect(() => vi.advanceTimersByTime(200)).not.toThrow()
		expect(postMessage).toHaveBeenCalledTimes(2)
	})
})

function spyOnParent(parent: Window) {
	return vi.spyOn(parent, "postMessage").mockImplementation(() => undefined)
}
