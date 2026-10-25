import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import install, { type LegacyIndexedDBFactory, type LegacyDatabase } from "../legacy-indexed-db"

describe("standalone legacy IndexedDB installer", () => {
	const original = Object.getOwnPropertyDescriptor(window, "indexedDB")
	let factory: LegacyIndexedDBFactory
	beforeEach(() => {
		vi.useFakeTimers()
		Reflect.deleteProperty(window, "memoryIndexedDB")
		install({})
		factory = Reflect.get(window, "indexedDB") as LegacyIndexedDBFactory
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		if (original) Object.defineProperty(window, "indexedDB", original)
		else Reflect.deleteProperty(window, "indexedDB")
		Reflect.deleteProperty(window, "memoryIndexedDB")
		vi.restoreAllMocks()
		vi.useRealTimers()
	})
	function open(name = "app", version?: number): LegacyDatabase {
		const request = factory.open(name, version)
		vi.runAllTimers()
		if (!request.result) throw new Error("Database did not open")
		return request.result
	}

	it("returns a real EventTarget and dispatches success after result is available", () => {
		const request = factory.open("app", 2)
		const success = vi.fn((event: Event) => {
			expect(event.target).toBe(request)
			expect(request.result?.name).toBe("app")
			expect(request.result?.version).toBe(2)
		})
		expect(request).toBeInstanceOf(EventTarget)
		expect(request.result).toBeNull()
		request.addEventListener("success", success)
		expect(success).not.toHaveBeenCalled()
		vi.runAllTimers()
		expect(success).toHaveBeenCalledOnce()
	})

	it("keeps the legacy event-only API without inventing upgrade or onsuccess callbacks", () => {
		const request = factory.open("app")
		const onSuccess = vi.fn()
		const onUpgrade = vi.fn()
		Object.assign(request, { onsuccess: onSuccess, onupgradeneeded: onUpgrade })
		vi.runAllTimers()
		expect(request.result?.version).toBe(1)
		expect(onSuccess).not.toHaveBeenCalled()
		expect(onUpgrade).not.toHaveBeenCalled()
	})

	it("supports synchronous object-store CRUD with inline and explicit keys", () => {
		const database = open()
		const store = database.createObjectStore("rows", { keyPath: "id", autoIncrement: true })
		expect(store.autoIncrement).toBe(true)
		expect(store.put({ id: "a", value: 1 })).toBe("a")
		expect(store.get("a")).toEqual({ id: "a", value: 1 })
		expect(store.getAll()).toEqual([{ id: "a", value: 1 }])
		expect(database.transaction("rows", "readwrite").objectStore("rows")).toBe(store)
		store.delete("a")
		expect(store.get("a")).toBeNull()
		const keyed = database.createObjectStore("keyed")
		expect(keyed.put("value", "key")).toBe("key")
		expect(keyed.get("key")).toBe("value")
		keyed.clear()
		expect(keyed.getAll()).toEqual([])
		expect(database.objectStoreNames.contains("rows")).toBe(true)
		expect(database.objectStoreNames.item(0)).toBe("rows")
		expect(database.objectStoreNames.item(9)).toBeNull()
		expect(database.objectStoreNames.length).toBe(2)
	})

	it("retains falsy-value and missing-key behavior instead of adding native IDB semantics", () => {
		const store = open().createObjectStore("rows", { autoIncrement: true })
		expect(store.put("value")).toBeUndefined()
		expect(store.get("undefined")).toBe("value")
		store.put(0, "zero")
		expect(store.get("zero")).toBeNull()
	})

	it("keeps state and existing version across repeated installations and opens", () => {
		open("app", 2).createObjectStore("rows").put("saved", "key")
		install({})
		factory = Reflect.get(window, "indexedDB") as LegacyIndexedDBFactory
		const database = open("app", 3)
		expect(database.version).toBe(2)
		expect(database.transaction("rows").objectStore("rows")?.get("key")).toBe("saved")
	})

	it("preserves shared currentDb routing when a second database is opened", () => {
		const first = open("first")
		first.createObjectStore("first-store")
		const second = open("second")
		second.createObjectStore("second-store")
		expect(first.name).toBe("first")
		expect(first.objectStoreNames.contains("second-store")).toBe(true)
		expect(first.transaction("first-store").objectStore("first-store")).toBeUndefined()
	})

	it("deletes databases asynchronously and the next open starts empty", () => {
		open().createObjectStore("rows")
		const request = factory.deleteDatabase("app")
		const success = vi.fn()
		request.addEventListener("success", success)
		expect(request).toBeInstanceOf(EventTarget)
		expect(success).not.toHaveBeenCalled()
		vi.runAllTimers()
		expect(success).toHaveBeenCalledOnce()
		expect(open().objectStoreNames.length).toBe(0)
	})

	it("keeps non-configurable native indexedDB intact", () => {
		const native = {}
		const lockedWindow = Object.defineProperty({}, "indexedDB", {
			value: native,
			configurable: false,
		})
		vi.stubGlobal("window", lockedWindow)
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		expect(() => install({})).not.toThrow()
		expect(Reflect.get(lockedWindow, "indexedDB")).toBe(native)
		expect(warning).toHaveBeenCalledWith("IndexedDB mock skipped:", expect.any(String))
	})
})
