import { afterEach, describe, expect, it, vi } from "vitest"
import { postMessageToParent } from "../parentOrigin"

describe("postMessageToParent", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("sends to the parent with the resolved origin", () => {
		const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})

		expect(postMessageToParent({ type: "TEST" })).toBe(true)
		expect(postMessage).toHaveBeenCalledWith({ type: "TEST" }, window.location.origin)
	})

	it("forwards a transfer list for binary payloads", () => {
		const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		const buffer = new ArrayBuffer(8)

		expect(postMessageToParent({ type: "BINARY" }, [buffer])).toBe(true)
		expect(postMessage).toHaveBeenCalledWith(
			{ type: "BINARY" },
			window.location.origin,
			[buffer],
		)
	})
})
