import { afterEach, describe, expect, it, vi } from "vitest"
import { ElementInspectorHandler } from "../features/ElementInspectorHandler"
import { startIframeRuntime } from "../index"

startIframeRuntime()

describe("iframe runtime message boundary", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("ignores inspector commands from a non-parent window", () => {
		const activate = vi.spyOn(ElementInspectorHandler.prototype, "activate")
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		try {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframe.contentWindow,
					origin: "https://attacker.example",
					data: { type: "MAGIC_INSPECTOR_START" },
				}),
			)

			expect(activate).not.toHaveBeenCalled()
		} finally {
			iframe.remove()
		}
	})

	it("accepts inspector commands from the parent window", () => {
		const activate = vi.spyOn(ElementInspectorHandler.prototype, "activate")

		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: { type: "MAGIC_INSPECTOR_START" },
			}),
		)

		expect(activate).toHaveBeenCalledOnce()

		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: { type: "MAGIC_INSPECTOR_STOP" },
			}),
		)
	})

	it("accepts parent requests to scroll inspector targets into view", () => {
		const scrollToSelector = vi.spyOn(ElementInspectorHandler.prototype, "scrollToSelector")
		const scrollToPosition = vi.spyOn(ElementInspectorHandler.prototype, "scrollToPosition")
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)

		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					type: "MAGIC_INSPECTOR_SCROLL_TO_SELECTOR",
					selector: "#hero",
				},
			}),
		)
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					type: "MAGIC_INSPECTOR_SCROLL_TO_POSITION",
					left: 40,
					top: 700,
				},
			}),
		)

		expect(scrollToSelector).toHaveBeenCalledWith("#hero")
		expect(scrollToPosition).toHaveBeenCalledWith({ left: 40, top: 700 })
	})
})
