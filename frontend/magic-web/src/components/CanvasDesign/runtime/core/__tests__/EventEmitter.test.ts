import { describe, expect, it, vi } from "vitest"
import { EventEmitter, type CanvasEventMap } from "../EventEmitter"

describe("EventEmitter", () => {
	it("reuses a listener snapshot until subscriptions change", () => {
		const emitter = new EventEmitter()
		const listener = vi.fn()
		const snapshots = (
			emitter as unknown as {
				listenerSnapshots: Map<keyof CanvasEventMap, Array<(event: unknown) => void>>
			}
		).listenerSnapshots

		emitter.on("viewport:scale", listener)
		emitter.emit({ type: "viewport:scale", data: { scale: 1 } })
		const firstSnapshot = snapshots.get("viewport:scale")

		emitter.emit({ type: "viewport:scale", data: { scale: 2 } })
		expect(snapshots.get("viewport:scale")).toBe(firstSnapshot)

		emitter.on("viewport:scale", vi.fn())
		expect(snapshots.has("viewport:scale")).toBe(false)
		emitter.emit({ type: "viewport:scale", data: { scale: 3 } })
		expect(snapshots.get("viewport:scale")).not.toBe(firstSnapshot)
	})

	it("keeps the current dispatch stable when a listener unsubscribes another listener", () => {
		const emitter = new EventEmitter()
		const second = vi.fn()
		const first = vi.fn(() => emitter.off("viewport:scale", second))
		emitter.on("viewport:scale", first)
		emitter.on("viewport:scale", second)

		emitter.emit({ type: "viewport:scale", data: { scale: 1 } })
		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)

		emitter.emit({ type: "viewport:scale", data: { scale: 2 } })
		expect(first).toHaveBeenCalledTimes(2)
		expect(second).toHaveBeenCalledTimes(1)
	})

	it("defers a listener added during dispatch until the next event", () => {
		const emitter = new EventEmitter()
		const addedDuringDispatch = vi.fn()
		const first = vi.fn(() => emitter.on("viewport:scale", addedDuringDispatch))
		emitter.on("viewport:scale", first)

		emitter.emit({ type: "viewport:scale", data: { scale: 1 } })
		expect(addedDuringDispatch).not.toHaveBeenCalled()

		emitter.emit({ type: "viewport:scale", data: { scale: 2 } })
		expect(addedDuringDispatch).toHaveBeenCalledTimes(1)
	})

	it("invalidates the cached snapshot when a once listener unsubscribes", () => {
		const emitter = new EventEmitter()
		const onceListener = vi.fn()
		emitter.once("viewport:scale", onceListener)

		emitter.emit({ type: "viewport:scale", data: { scale: 1 } })
		emitter.emit({ type: "viewport:scale", data: { scale: 2 } })

		expect(onceListener).toHaveBeenCalledTimes(1)
		expect(emitter.listenerCount("viewport:scale")).toBe(0)
	})

	it("keeps the current dispatch stable when all listeners are removed", () => {
		const emitter = new EventEmitter()
		const second = vi.fn()
		const first = vi.fn(() => emitter.removeAllListeners())
		emitter.on("viewport:scale", first)
		emitter.on("viewport:scale", second)

		emitter.emit({ type: "viewport:scale", data: { scale: 1 } })
		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)

		emitter.emit({ type: "viewport:scale", data: { scale: 2 } })
		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)
	})
})
