import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import install from "../legacy-storage"

describe("standalone legacy storage installer", () => {
	const nativeLocal = window.localStorage
	const nativeSession = window.sessionStorage
	const localDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
	const sessionDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage")
	function restoreNativeStorage() {
		if (localDescriptor) Object.defineProperty(window, "localStorage", localDescriptor)
		if (sessionDescriptor) Object.defineProperty(window, "sessionStorage", sessionDescriptor)
	}
	beforeEach(() => {
		Reflect.deleteProperty(window, "__MAGIC_LEGACY_STORAGE_FACTORY__")
		nativeLocal.clear()
		nativeSession.clear()
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		restoreNativeStorage()
		Reflect.deleteProperty(window, "__MAGIC_LEGACY_STORAGE_FACTORY__")
		nativeLocal.clear()
		nativeSession.clear()
		vi.restoreAllMocks()
	})

	it("persists each storage type under the exact marker key", () => {
		install({ markerId: "document-a" })
		window.localStorage.setItem("name", "local")
		window.sessionStorage.setItem("name", "session")
		expect(nativeLocal.getItem("MAGIC:iframe:storage:document-a")).toBe('{"name":"local"}')
		expect(nativeSession.getItem("MAGIC:iframe:storage:document-a")).toBe('{"name":"session"}')
		expect(window.localStorage.getItem("name")).toBe("local")
		expect(window.sessionStorage.getItem("name")).toBe("session")
		expect(window.localStorage).not.toBeInstanceOf(Storage)
		expect(Object.getOwnPropertyDescriptor(window, "localStorage")).toMatchObject({
			writable: false,
			configurable: true,
		})
	})

	it.each([undefined, ""])("uses default namespace for marker %j", (markerId) => {
		install({ markerId })
		window.localStorage.setItem("name", "default")
		expect(nativeLocal.getItem("MAGIC:iframe:storage:default")).toBe('{"name":"default"}')
	})

	it("isolates document markers while preserving saved values for a later document", () => {
		install({ markerId: "a" })
		window.localStorage.setItem("item", "a-value")
		install({ markerId: "b" })
		expect(window.localStorage.getItem("item")).toBeNull()
		window.localStorage.setItem("item", "b-value")
		install({ markerId: "a" })
		expect(window.localStorage.getItem("item")).toBe("a-value")
	})

	it("supports enumeration/removal/clear and keeps the legacy empty-string fallback", () => {
		install({})
		window.localStorage.setItem("first", "value")
		window.localStorage.setItem("empty", "")
		expect(window.localStorage.getItem("empty")).toBeNull()
		expect(window.localStorage.length).toBe(2)
		expect(window.localStorage.key(0)).toBe("first")
		expect(window.localStorage.key(8)).toBeNull()
		window.localStorage.removeItem("first")
		expect(window.localStorage.key(0)).toBe("empty")
		window.localStorage.clear()
		expect(window.localStorage.length).toBe(0)
		expect(nativeLocal.getItem("MAGIC:iframe:storage:default")).toBe("{}")
	})

	it("bypasses marker storage for the shared global key and clear keeps it", () => {
		const globalKey = "MAGIC:iframe:storage:global"
		install({ markerId: "a" })
		window.localStorage.setItem(globalKey, "shared")
		expect(nativeLocal.getItem(globalKey)).toBe("shared")
		window.localStorage.clear()
		expect(window.localStorage.getItem(globalKey)).toBe("shared")
		window.localStorage.removeItem(globalKey)
		expect(nativeLocal.getItem(globalKey)).toBeNull()
	})

	it("guards direct writes/removal of its own backing key", () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		install({ markerId: "a" })
		window.localStorage.setItem("name", "kept")
		window.localStorage.setItem("MAGIC:iframe:storage:a", "discard")
		window.localStorage.removeItem("MAGIC:iframe:storage:a")
		expect(window.localStorage.getItem("MAGIC:iframe:storage:a")).toBeNull()
		expect(window.localStorage.getItem("name")).toBe("kept")
		expect(warning).toHaveBeenCalledTimes(2)
	})

	it("retains malformed backing JSON errors instead of silently resetting saved data", () => {
		nativeLocal.setItem("MAGIC:iframe:storage:a", "invalid json")
		install({ markerId: "a" })
		expect(() => window.localStorage.getItem("name")).toThrow(SyntaxError)
		expect(nativeLocal.getItem("MAGIC:iframe:storage:a")).toBe("invalid json")
	})

	it("leaves blocked native storage properties intact", () => {
		const lockedWindow = { localStorage: nativeLocal }
		Object.defineProperty(lockedWindow, "sessionStorage", {
			value: nativeSession,
			configurable: false,
		})
		vi.stubGlobal("window", lockedWindow)
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		expect(() => install({})).not.toThrow()
		expect(lockedWindow.localStorage).toBe(nativeLocal)
		expect(warning).toHaveBeenCalledWith("Storage mock skipped:", expect.any(String))
	})
})
