import { describe, expect, it, vi } from "vitest"

vi.mock("@/apis", () => ({
	ContactApi: {},
	FlowApi: {},
}))

import { getMCPAccess } from "../mcp-access"
import { defaultMCPStore } from "../mcp-store"

describe("getMCPAccess", () => {
	it("returns shared default store without params", () => {
		expect(getMCPAccess()).toBe(defaultMCPStore)
	})

	it("returns cached project store for the same storage key", () => {
		const firstAccess = getMCPAccess({ storageKey: "project-id" })
		const secondAccess = getMCPAccess({ storageKey: "project-id" })

		expect(firstAccess).toBe(secondAccess)
		expect(firstAccess).not.toBe(defaultMCPStore)
	})

	it("returns shared temp store when temp storage is enabled", () => {
		const firstAccess = getMCPAccess({ useTempStorage: true })
		const secondAccess = getMCPAccess({ useTempStorage: true })

		expect(firstAccess).toBe(secondAccess)
		expect(firstAccess).not.toBe(defaultMCPStore)
	})
})
