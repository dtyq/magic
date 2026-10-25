import { describe, expect, it, vi } from "vitest"
import { injectPPTSwipeBridge } from "../pptSwipeBridge"
import { filterInjectedTags } from "../../../../contents/HTML/utils"

function setup(crossOrigin = true) {
	const content = injectPPTSwipeBridge(
		"<html><body><p>Slide</p></body></html>",
		"https://app.example.test",
	)
	const doc = new DOMParser().parseFromString(content, "text/html")
	const postMessage = vi.fn()
	const parent = {
		get document() {
			if (crossOrigin) throw new DOMException("Cross-origin", "SecurityError")
			return doc
		},
		postMessage,
	}
	const frame = { parent }
	const install = () =>
		new Function("document", "window", doc.querySelector("script")!.textContent!)(doc, frame)
	install()
	const touch = (type: string, x = 0, y = 0, count = 1) => {
		const event = new Event(type)
		const touches = Array.from({ length: count }, () => ({ clientX: x, clientY: y }))
		Object.defineProperties(event, {
			touches: { value: touches },
			changedTouches: { value: touches },
		})
		doc.dispatchEvent(event)
	}
	return { content, postMessage, install, touch }
}

describe("PPT preview swipe bridge", () => {
	it("reports both directions to the exact parent origin without duplicate refresh listeners", () => {
		const { install, touch, postMessage } = setup()
		install()
		touch("touchstart", 200, 40)
		touch("touchend", 100, 42)
		touch("touchstart", 100, 40)
		touch("touchend", 200, 42)
		expect(postMessage.mock.calls).toEqual([
			[{ type: "ppt-slide-swipe", direction: "next" }, "https://app.example.test"],
			[{ type: "ppt-slide-swipe", direction: "prev" }, "https://app.example.test"],
		])
	})

	it("ignores taps, vertical movement, multi-touch and cancelled gestures", () => {
		const { touch, postMessage } = setup()
		touch("touchstart", 100, 100)
		touch("touchend", 120, 100)
		touch("touchstart", 100, 100)
		touch("touchend", 200, 250)
		touch("touchstart", 100, 100, 2)
		touch("touchend", 200, 100)
		touch("touchstart", 100, 100)
		touch("touchcancel")
		touch("touchend", 200, 100)
		expect(postMessage).not.toHaveBeenCalled()
	})

	it("leaves same-origin gestures to the existing document listeners", () => {
		const { touch, postMessage } = setup(false)
		touch("touchstart", 200, 40)
		touch("touchend", 100, 40)
		expect(postMessage).not.toHaveBeenCalled()
	})

	it("removes the runtime bridge when serializing a saved slide", () => {
		const { content } = setup()
		const saved = filterInjectedTags(content, new Map())
		expect(saved).toContain("<p>Slide</p>")
		expect(saved).not.toContain("ppt-slide-swipe")
		expect(saved).not.toContain("__magicPptSwipeCleanup")
	})
})
