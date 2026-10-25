import { afterEach, describe, expect, it, vi } from "vitest"
import { createIframeRuntimeScript } from "../create-script"

const origin = "https://app.example.test"

function setup(sameOrigin = false) {
	const target = new EventTarget()
	const parent = {
		postMessage: vi.fn(),
		get document() {
			if (!sameOrigin) throw new DOMException("Cross-origin", "SecurityError")
			return document
		},
	}
	const sandbox = Object.assign(new EventTarget(), {
		parent,
		__MAGIC_PREVIEW_PINCH_CLEANUP__: undefined as (() => void) | undefined,
	})
	const execute = () =>
		new Function(
			"window",
			"document",
			createIframeRuntimeScript("touch-pinch", { parentOrigin: origin }),
		)(sandbox, target)
	const state = (enabled: boolean, source: unknown = parent, eventOrigin = origin) => {
		const event = new Event("message")
		Object.assign(event, {
			source,
			origin: eventOrigin,
			data: { type: "magic-preview-pinch-state", enabled },
		})
		sandbox.dispatchEvent(event)
	}
	const touch = (type: string, count = 2) => {
		const event = new Event(type, { cancelable: true })
		Object.defineProperty(event, "touches", {
			value: Array.from({ length: count }, (_, id) => ({
				identifier: id,
				clientX: id * 100,
				clientY: 100,
			})),
		})
		target.dispatchEvent(event)
		return event
	}
	return { parent, sandbox, execute, state, touch }
}

afterEach(() => vi.restoreAllMocks())

describe("compiled touch pinch installer", () => {
	it("uses a trusted handshake and suppresses native pinch only while enabled", () => {
		const { parent, sandbox, execute, state, touch } = setup()
		execute()
		expect(parent.postMessage).toHaveBeenCalledWith(
			{ type: "magic-preview-pinch-ready" },
			origin,
		)
		expect(touch("touchstart").defaultPrevented).toBe(false)
		state(true, {}, origin)
		state(true, undefined, "https://wrong.example.test")
		expect(touch("touchstart").defaultPrevented).toBe(false)
		state(true)
		expect(touch("touchstart").defaultPrevented).toBe(true)
		touch("touchmove")
		expect(parent.postMessage).toHaveBeenLastCalledWith(
			{
				type: "magic-preview-pinch",
				phase: "move",
				points: [
					{ id: 0, x: 0, y: 100 },
					{ id: 1, x: 100, y: 100 },
				],
			},
			origin,
		)
		state(false)
		expect(touch("touchstart").defaultPrevented).toBe(false)
		sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__?.()
	})

	it("cleans up old bindings before refreshing and leaves single-finger scrolling untouched", () => {
		const { parent, sandbox, execute, state, touch } = setup()
		execute()
		state(true)
		execute()
		state(true)
		parent.postMessage.mockClear()
		expect(touch("touchstart", 1).defaultPrevented).toBe(false)
		touch("touchstart")
		expect(parent.postMessage).toHaveBeenCalledTimes(1)
		sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__?.()
		expect(touch("touchmove").defaultPrevented).toBe(false)
	})

	it("does not duplicate the host listener in same-origin frames", () => {
		const { parent, execute, state, touch } = setup(true)
		execute()
		state(true)
		expect(touch("touchstart").defaultPrevented).toBe(false)
		expect(parent.postMessage).not.toHaveBeenCalled()
	})
	it("reports transform-independent screen coordinates from the compiled bridge", () => {
		const { parent, sandbox, execute, state, touch } = setup()
		execute()
		state(true)
		// The native Touch shape includes screen pixels even though iframe CSS pixels differ.
		const event = new Event("touchstart", { cancelable: true })
		const documentTarget = new EventTarget()
		const targetScript = createIframeRuntimeScript("touch-pinch", { parentOrigin: origin })
		new Function("window", "document", targetScript)(sandbox, documentTarget)
		state(true)
		Object.defineProperty(event, "touches", {
			value: [0, 1].map((id) => ({
				identifier: id,
				clientX: id * 200,
				clientY: 100,
				screenX: 250 + id * 100,
				screenY: 300,
			})),
		})
		documentTarget.dispatchEvent(event)
		expect(parent.postMessage).toHaveBeenLastCalledWith(
			{
				type: "magic-preview-pinch",
				phase: "start",
				points: [
					{ id: 0, x: 0, y: 100, screenX: 250, screenY: 300 },
					{ id: 1, x: 200, y: 100, screenX: 350, screenY: 300 },
				],
			},
			origin,
		)
		sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__?.()
		expect(touch("touchmove").defaultPrevented).toBe(false)
	})
})
