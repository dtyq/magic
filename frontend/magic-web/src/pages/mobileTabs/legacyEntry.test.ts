import { describe, expect, it } from "vitest"
import { isLegacyMobileTabsHomeEntry } from "./legacyEntry"

describe("isLegacyMobileTabsHomeEntry", () => {
	it("matches bare mobile-tabs root", () => {
		expect(isLegacyMobileTabsHomeEntry("/mobile-tabs", "")).toBe(true)
	})

	it("matches explicit super tab entry", () => {
		expect(isLegacyMobileTabsHomeEntry("/mobile-tabs", "?tab=super")).toBe(true)
	})

	it("does not match non-super tabs", () => {
		expect(isLegacyMobileTabsHomeEntry("/mobile-tabs", "?tab=chat")).toBe(false)
	})

	it("does not match deep links carrying super state", () => {
		expect(isLegacyMobileTabsHomeEntry("/mobile-tabs", "?projectId=project-1")).toBe(false)
		expect(isLegacyMobileTabsHomeEntry("/mobile-tabs", "?workspaceId=workspace-1")).toBe(false)
	})
})