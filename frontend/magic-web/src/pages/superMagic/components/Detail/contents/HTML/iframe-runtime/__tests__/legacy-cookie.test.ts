import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import install from "../legacy-cookie"

describe("standalone legacy cookie installer", () => {
	const originalCookie = Object.getOwnPropertyDescriptor(document, "cookie")
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
		Reflect.deleteProperty(window, "memoryCookies")
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		if (originalCookie) Object.defineProperty(document, "cookie", originalCookie)
		else Reflect.deleteProperty(document, "cookie")
		Reflect.deleteProperty(window, "memoryCookies")
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("encodes cookies, ignores path/domain flags and retains values across installation", () => {
		install({})
		document.cookie = "greeting=hello%20world; path=/other; domain=example.invalid; secure"
		document.cookie = "language=zh_CN"
		expect(document.cookie).toBe("greeting=hello%20world; language=zh_CN")
		install({})
		expect(document.cookie).toBe("greeting=hello%20world; language=zh_CN")
		document.cookie = "language=en_US"
		expect(document.cookie).toBe("greeting=hello%20world; language=en_US")
	})

	it("expires values lazily using the legacy strict date boundary", () => {
		install({})
		document.cookie = "temporary=yes; Max-Age=1"
		vi.advanceTimersByTime(1000)
		expect(document.cookie).toBe("temporary=yes")
		vi.advanceTimersByTime(1)
		expect(document.cookie).toBe("")
		expect(Reflect.get(window, "memoryCookies")).toEqual({})
	})

	it("honors expires and option order while ignoring invalid max-age", () => {
		install({})
		document.cookie = "expired=no; expires=Thu, 01 Jan 1970 00:00:00 GMT"
		document.cookie = "retained=yes; max-age=invalid"
		document.cookie = "ordered=yes; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=30"
		expect(document.cookie).toBe("retained=yes; ordered=yes")
	})

	it("preserves the existing split and malformed-encoding behavior", () => {
		install({})
		document.cookie = "token=first=discarded"
		document.cookie = "empty="
		document.cookie = "=ignored"
		expect(document.cookie).toBe("token=first; empty=")
		expect(() => {
			document.cookie = "bad=%ZZ"
		}).toThrow(URIError)
	})

	it("leaves a non-configurable native cookie property intact", () => {
		const lockedDocument = Object.defineProperty({}, "cookie", {
			value: "native=value",
			configurable: false,
		})
		vi.stubGlobal("document", lockedDocument)
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		expect(() => install({})).not.toThrow()
		expect(Reflect.get(lockedDocument, "cookie")).toBe("native=value")
		expect(warning).toHaveBeenCalledWith("Cookie mock skipped:", expect.any(String))
	})
})
