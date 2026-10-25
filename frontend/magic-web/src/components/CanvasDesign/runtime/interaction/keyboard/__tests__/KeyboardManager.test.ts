import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import { KeyboardManager } from "../KeyboardManager"

afterEach(() => {
	document.body.replaceChildren()
})

describe("KeyboardManager eraser history routing", () => {
	it("emits restore mode while Alt is held and resets it on keyup, blur, and hidden", () => {
		const container = document.createElement("div")
		container.tabIndex = 0
		document.body.append(container)
		container.focus()
		const eventEmitter = new EventEmitter()
		const altDown = vi.fn()
		const altUp = vi.fn()
		eventEmitter.on("keyboard:alt:down", altDown)
		eventEmitter.on("keyboard:alt:up", altUp)
		const canvas = {
			eventEmitter,
			resetKeepRatioModifier: vi.fn(),
			permissionManager: { can: () => true },
		} as unknown as Canvas
		const manager = new KeyboardManager({ canvas, container })

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", code: "AltLeft" }))
		window.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Alt", code: "AltLeft", repeat: true }),
		)
		const outsideInput = document.createElement("input")
		document.body.append(outsideInput)
		outsideInput.focus()
		window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", code: "AltLeft" }))
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
		document.dispatchEvent(new Event("visibilitychange"))
		window.dispatchEvent(new Event("blur"))

		expect(altDown).toHaveBeenCalledTimes(1)
		expect(altUp).toHaveBeenCalledTimes(3)
		manager.destroy()
	})
	it("routes undo and redo to the eraser session without emitting canvas history events", () => {
		const container = document.createElement("div")
		container.tabIndex = 0
		document.body.append(container)
		container.focus()

		const eventEmitter = new EventEmitter()
		const undoLastStroke = vi.fn()
		const redoLastStroke = vi.fn()
		let erasingElementId: string | null = "image-1"
		const canvasUndo = vi.fn()
		const canvasRedo = vi.fn()
		eventEmitter.on("keyboard:undo", canvasUndo)
		eventEmitter.on("keyboard:redo", canvasRedo)

		const canvas = {
			eventEmitter,
			resetKeepRatioModifier: vi.fn(),
			permissionManager: { can: () => true },
			eraserManager: {
				getErasingElementId: () => erasingElementId,
				undoLastStroke,
				redoLastStroke,
			},
		} as unknown as Canvas
		const manager = new KeyboardManager({ canvas, container })

		const undoEvent = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			code: "KeyZ",
			key: "z",
			ctrlKey: true,
		})
		window.dispatchEvent(undoEvent)

		const redoEvent = new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			code: "KeyZ",
			key: "z",
			ctrlKey: true,
			shiftKey: true,
		})
		window.dispatchEvent(redoEvent)

		expect(undoLastStroke).toHaveBeenCalledTimes(1)
		expect(redoLastStroke).toHaveBeenCalledTimes(1)
		expect(undoEvent.defaultPrevented).toBe(true)
		expect(redoEvent.defaultPrevented).toBe(true)
		expect(canvasUndo).not.toHaveBeenCalled()
		expect(canvasRedo).not.toHaveBeenCalled()

		erasingElementId = null
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				code: "KeyZ",
				key: "z",
				ctrlKey: true,
			}),
		)
		expect(canvasUndo).toHaveBeenCalledTimes(1)

		manager.destroy()
	})
})
