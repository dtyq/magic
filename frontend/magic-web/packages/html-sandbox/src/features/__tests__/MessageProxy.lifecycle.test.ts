import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MessageProxy } from "../MessageProxy"

describe("MessageProxy lifecycle", () => {
	const nativeParentDescriptor = Object.getOwnPropertyDescriptor(window, "parent")
	let proxy: MessageProxy
	let parent: Window
	let postMessage: ReturnType<typeof vi.fn>
	let parentDescriptor: PropertyDescriptor | undefined

	beforeEach(() => {
		postMessage = vi.fn(function (this: Window) {
			expect(this).toBe(parent)
		})
		parent = { postMessage } as unknown as Window
		Object.defineProperty(window, "parent", { configurable: true, get: () => parent })
		parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent")
		proxy = new MessageProxy()
	})

	afterEach(() => {
		proxy.destroy()
		if (nativeParentDescriptor) Object.defineProperty(window, "parent", nativeParentDescriptor)
		else Reflect.deleteProperty(window, "parent")
	})

	it("preserves the receiver and both postMessage overloads including transferables", () => {
		proxy.enable()
		const data = { type: "TRANSFER", value: new ArrayBuffer(8) }
		const transfer = [data.value]
		window.parent.postMessage(data, "https://host.example", transfer)
		const options = { targetOrigin: "https://host.example", transfer }
		window.parent.postMessage(data, options)
		expect(postMessage.mock.calls).toEqual([
			[data, "https://host.example", transfer],
			[data, options],
		])
		expect(proxy.getEntries()).toHaveLength(2)
	})

	it("reads receiver-sensitive parent accessors with the original window", () => {
		const location = { origin: "https://host.example" }
		Object.defineProperty(parent, "location", {
			get(this: Window) {
				// Native Window accessors may reject a Proxy as an illegal receiver.
				if (this !== parent) throw new TypeError("Illegal invocation")
				return location
			},
		})
		proxy.enable()
		expect(window.parent.location).toBe(location)
	})

	it("filters foreign sources and DevTools traffic without recursive notifications", () => {
		const listener = vi.fn(() => {
			window.parent.postMessage({ type: "MAGIC_DEVTOOLS_MESSAGE_ENTRY" }, "*")
		})
		proxy.onEntry(listener)
		proxy.enable()
		const incoming = (source: Window | null, type: string) =>
			window.dispatchEvent(
				new MessageEvent("message", {
					source,
					origin: "https://host.example",
					data: { type },
				}),
			)
		incoming(null, "UNTRUSTED")
		incoming(window, "SELF")
		incoming(parent, "MAGIC_DEVTOOLS_TOGGLE")
		incoming(parent, "HOST_REPLY")
		window.parent.postMessage({ type: "APP_REQUEST" }, "*")
		expect(listener).toHaveBeenCalledTimes(2)
		expect(proxy.getEntries()).toMatchObject([
			{ direction: "incoming", type: "HOST_REPLY", origin: "https://host.example" },
			{ direction: "outgoing", type: "APP_REQUEST" },
		])
		expect(postMessage).toHaveBeenCalledTimes(3)
	})

	it("restores the exact bridge descriptor and avoids duplicate listeners after re-enabling", () => {
		proxy.enable()
		const patchedParent = window.parent
		proxy.enable()
		expect(window.parent).toBe(patchedParent)
		proxy.disable()
		proxy.disable()
		expect(Object.getOwnPropertyDescriptor(window, "parent")).toEqual(parentDescriptor)
		window.dispatchEvent(new MessageEvent("message", { source: parent, data: "disabled" }))
		expect(proxy.getEntries()).toEqual([])
		proxy.enable()
		window.dispatchEvent(new MessageEvent("message", { source: parent, data: "enabled" }))
		expect(proxy.getEntries()).toHaveLength(1)
		proxy.destroy()
		window.dispatchEvent(new MessageEvent("message", { source: parent, data: "destroyed" }))
		expect(proxy.getEntries()).toEqual([])
	})

	it("snapshots payloads, handles circular data, and retains only the latest 500 messages", () => {
		proxy.enable()
		const data = { type: "APP", value: 1 }
		window.parent.postMessage(data, "*")
		data.value = 2
		expect(proxy.getEntries()[0].payload).toEqual({ type: "APP", value: 1 })
		const circular: Record<string, unknown> = {}
		circular.self = circular
		expect(() => window.parent.postMessage(circular, "*")).not.toThrow()
		for (let index = 0; index < 501; index++) window.parent.postMessage(index, "*")
		const entries = proxy.getEntries()
		expect(entries).toHaveLength(500)
		expect(entries[0].payload).toBe(1)
		expect(entries.at(-1)?.payload).toBe(500)
		entries.pop()
		expect(proxy.getEntries()).toHaveLength(500)
		proxy.clear()
		expect(proxy.getEntries()).toEqual([])
	})
})
