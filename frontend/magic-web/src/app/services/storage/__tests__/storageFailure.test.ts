// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { error, report } = vi.hoisted(() => ({
	error: vi.fn(),
	report: vi.fn(),
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ error }),
		report,
	},
}))

import {
	isQuotaExceeded,
	reportCaughtStorageFailure,
	resetCaughtStorageFailureGateForTests,
} from "../storageFailure"

afterEach(() => {
	sessionStorage.clear()
	resetCaughtStorageFailureGateForTests()
	vi.clearAllMocks()
})

describe("isQuotaExceeded", () => {
	it("recognizes QuotaExceededError by name", () => {
		expect(isQuotaExceeded(new DOMException("quota exceeded", "QuotaExceededError"))).toBe(true)
	})
})

describe("reportCaughtStorageFailure", () => {
	beforeEach(() => {
		error.mockReset()
		report.mockReset()
	})

	it("logs a storage error without emitting quota exceeded", () => {
		reportCaughtStorageFailure({
			eventKey: "legacy_localstorage_set_failed",
			error: new TypeError("blocked"),
			message: "Failed to write localStorage",
			key: "pref-theme",
		})
		expect(error).toHaveBeenCalledWith({
			eventKey: "legacy_localstorage_set_failed",
			errorKind: "storage",
			error: expect.any(TypeError),
			message: "Failed to write localStorage",
			context: { key: "pref-theme" },
		})
		expect(report).not.toHaveBeenCalled()
	})

	it("logs quota errors and reports storage_quota_exceeded once", () => {
		const quotaError = new DOMException("quota exceeded", "QuotaExceededError")
		reportCaughtStorageFailure({
			eventKey: "legacy_localstorage_set_failed",
			error: quotaError,
			message: "Failed to write localStorage",
			key: "pref-theme",
		})
		reportCaughtStorageFailure({
			eventKey: "legacy_localstorage_set_failed",
			error: quotaError,
			message: "Failed to write localStorage",
			key: "pref-theme",
		})
		expect(error).toHaveBeenCalledTimes(2)
		expect(error.mock.calls[0][0]).toMatchObject({
			eventKey: "storage_quota_exceeded",
			errorKind: "quota",
			context: { key: "pref-theme", source: "legacy_localstorage_set_failed" },
		})
		expect(report).toHaveBeenCalledTimes(1)
		expect(report).toHaveBeenCalledWith({
			namespace: "storageQuota",
			data: {
				eventKey: "storage_quota_exceeded",
				errorKind: "quota",
			},
		})
	})
})
