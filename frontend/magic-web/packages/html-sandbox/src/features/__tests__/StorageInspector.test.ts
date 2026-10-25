import { afterEach, describe, expect, it, vi } from "vitest"
import { StorageInspector } from "../StorageInspector"

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	window.localStorage.clear()
	window.sessionStorage.clear()
})

describe("StorageInspector", () => {
	it("reads fresh independent storage snapshots and decodes cookie values", () => {
		vi.spyOn(document, "cookie", "get").mockReturnValue(
			"language=%E4%B8%AD%E6%96%87; token=a=b; malformed=%E0%A4%A; empty=; ignored",
		)
		window.localStorage.setItem("persistent", "one")
		window.sessionStorage.setItem("temporary", "two")
		const inspector = new StorageInspector()
		const first = inspector.snapshot()
		expect(first).toEqual({
			cookies: { language: "中文", token: "a=b", malformed: "%E0%A4%A", empty: "" },
			localStorage: { persistent: "one" },
			sessionStorage: { temporary: "two" },
			indexedDB: [],
		})
		window.localStorage.setItem("persistent", "updated")
		expect(first.localStorage.persistent).toBe("one")
		expect(inspector.snapshot().localStorage.persistent).toBe("updated")
	})

	it("keeps accessible storage when cookies or storage methods throw", () => {
		vi.spyOn(document, "cookie", "get").mockImplementation(() => {
			throw new DOMException("Blocked", "SecurityError")
		})
		vi.spyOn(Storage.prototype, "key").mockImplementationOnce(() => {
			throw new DOMException("Blocked", "SecurityError")
		})
		window.localStorage.setItem("blocked", "value")
		window.sessionStorage.setItem("available", "value")
		expect(new StorageInspector().snapshot()).toEqual({
			cookies: {},
			localStorage: {},
			sessionStorage: { available: "value" },
			indexedDB: [],
		})
	})

	it.each(["localStorage", "sessionStorage"] as const)(
		"keeps the snapshot available when the %s getter is denied",
		(name) => {
			const accessible = name === "localStorage" ? "sessionStorage" : "localStorage"
			window[accessible].setItem("available", "value")
			vi.spyOn(window, name, "get").mockImplementation(() => {
				throw new DOMException("Blocked", "SecurityError")
			})
			expect(new StorageInspector().snapshot()).toMatchObject({
				[name]: {},
				[accessible]: { available: "value" },
			})
		},
	)

	it("enumerates database metadata without opening or mutating databases", async () => {
		const databases = vi.fn().mockResolvedValue([{ name: "cache", version: 3 }, {}])
		const open = vi.fn()
		vi.stubGlobal("indexedDB", { databases, open })
		expect((await new StorageInspector().snapshotAsync()).indexedDB).toEqual([
			{ name: "cache", version: 3, objectStores: [] },
			{ name: "(unnamed)", version: 0, objectStores: [] },
		])
		expect(databases).toHaveBeenCalledTimes(1)
		expect(open).not.toHaveBeenCalled()
	})

	it.each([undefined, {}, { databases: vi.fn().mockRejectedValue(new Error("denied")) }])(
		"returns empty database metadata when enumeration is unavailable: %s",
		async (indexedDB) => {
			vi.stubGlobal("indexedDB", indexedDB)
			expect((await new StorageInspector().snapshotAsync()).indexedDB).toEqual([])
		},
	)
})
