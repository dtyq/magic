import { describe, it, expect, vi } from "vitest"
import { TypedEventEmitter } from "../TypedEventEmitter"

interface TestEvents {
	foo: (data: string) => void
	bar: (num: number, str: string) => void
	error: () => void
}

describe("TypedEventEmitter", () => {
	it("should register and emit events to a single listener", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener = vi.fn()

		emitter.on("foo", listener)
		emitter.emit("foo", "test")

		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith("test")
	})

	it("should support multiple listeners for the same event", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener1 = vi.fn()
		const listener2 = vi.fn()
		const listener3 = vi.fn()

		emitter.on("foo", listener1)
		emitter.on("foo", listener2)
		emitter.on("foo", listener3)

		emitter.emit("foo", "data")

		expect(listener1).toHaveBeenCalledWith("data")
		expect(listener2).toHaveBeenCalledWith("data")
		expect(listener3).toHaveBeenCalledWith("data")
	})

	it("should support multiple parameters", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener = vi.fn()

		emitter.on("bar", listener)
		emitter.emit("bar", 42, "hello")

		expect(listener).toHaveBeenCalledWith(42, "hello")
	})

	it("should return an unsubscribe function", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener = vi.fn()

		const unsubscribe = emitter.on("foo", listener)

		emitter.emit("foo", "before")
		expect(listener).toHaveBeenCalledTimes(1)

		unsubscribe()

		emitter.emit("foo", "after")
		expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
	})

	it("should isolate errors in listeners", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener1 = vi.fn(() => {
			throw new Error("Listener 1 error")
		})
		const listener2 = vi.fn()
		const listener3 = vi.fn()

		emitter.on("error", listener1)
		emitter.on("error", listener2)
		emitter.on("error", listener3)

		// Should not throw
		expect(() => emitter.emit("error")).not.toThrow()

		// All listeners should be called despite the error
		expect(listener1).toHaveBeenCalledTimes(1)
		expect(listener2).toHaveBeenCalledTimes(1)
		expect(listener3).toHaveBeenCalledTimes(1)
	})

	it("should handle emitting events with no listeners", () => {
		const emitter = new TypedEventEmitter<TestEvents>()

		expect(() => emitter.emit("foo", "test")).not.toThrow()
	})

	it("should correctly report listener count", () => {
		const emitter = new TypedEventEmitter<TestEvents>()

		expect(emitter.listenerCount("foo")).toBe(0)

		const unsub1 = emitter.on("foo", () => {})
		expect(emitter.listenerCount("foo")).toBe(1)

		const unsub2 = emitter.on("foo", () => {})
		expect(emitter.listenerCount("foo")).toBe(2)

		unsub1()
		expect(emitter.listenerCount("foo")).toBe(1)

		unsub2()
		expect(emitter.listenerCount("foo")).toBe(0)
	})

	it("should handle multiple unsubscribes safely", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const listener = vi.fn()

		const unsubscribe = emitter.on("foo", listener)

		unsubscribe()
		unsubscribe() // Should not throw

		expect(emitter.listenerCount("foo")).toBe(0)
	})

	it("should support different event types independently", () => {
		const emitter = new TypedEventEmitter<TestEvents>()
		const fooListener = vi.fn()
		const barListener = vi.fn()

		emitter.on("foo", fooListener)
		emitter.on("bar", barListener)

		emitter.emit("foo", "test")

		expect(fooListener).toHaveBeenCalledTimes(1)
		expect(barListener).not.toHaveBeenCalled()

		emitter.emit("bar", 123, "world")

		expect(fooListener).toHaveBeenCalledTimes(1)
		expect(barListener).toHaveBeenCalledWith(123, "world")
	})
})
