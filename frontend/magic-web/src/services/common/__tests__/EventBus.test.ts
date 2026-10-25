import { describe, expect, it, vi } from "vitest"
import { EventBus } from "../EventBus"

type TestEvents = {
	"value/changed": { value: number }
	ready: undefined
}

describe("EventBus", () => {
	it("keeps event names and payloads type-mapped and supports unsubscribe", () => {
		const bus = new EventBus<TestEvents>()
		const handler = vi.fn()
		const unsubscribe = bus.on("value/changed", handler)

		bus.emit("value/changed", { value: 1 })
		expect(handler).toHaveBeenCalledWith({ value: 1 })

		unsubscribe()
		bus.emit("value/changed", { value: 2 })
		expect(handler).toHaveBeenCalledTimes(1)
	})

	it("only invokes once handlers once", () => {
		const bus = new EventBus<TestEvents>()
		const handler = vi.fn()
		bus.once("ready", handler)

		bus.emit("ready", undefined)
		bus.emit("ready", undefined)

		expect(handler).toHaveBeenCalledTimes(1)
	})
})
