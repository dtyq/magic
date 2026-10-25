// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

const { reportCaughtStorageFailure } = vi.hoisted(() => ({
	reportCaughtStorageFailure: vi.fn(),
}))

vi.mock("@/app/services/storage/storageFailure", () => ({
	reportCaughtStorageFailure,
}))

import localstorage from "../localstorage"

afterEach(() => {
	localStorage.clear()
	vi.clearAllMocks()
})

describe("localstorage helper", () => {
	it("writes and reads string values", () => {
		localstorage.set("pref-theme", "dark")
		expect(localstorage.get("pref-theme")).toBe("dark")
	})

	it("swallows setItem quota errors and reports them", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("quota exceeded", "QuotaExceededError")
		})
		expect(() => localstorage.set("pref-theme", "dark")).not.toThrow()
		expect(reportCaughtStorageFailure).toHaveBeenCalledWith({
			eventKey: "legacy_localstorage_set_failed",
			error: expect.any(DOMException),
			message: "Failed to write localStorage",
			key: "pref-theme",
		})
	})
})
