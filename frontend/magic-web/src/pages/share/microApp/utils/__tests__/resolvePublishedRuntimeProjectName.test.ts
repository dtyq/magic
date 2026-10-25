import { describe, expect, it } from "vitest"
import { resolvePublishedRuntimeProjectName } from "../resolvePublishedRuntimeProjectName"

describe("resolvePublishedRuntimeProjectName", () => {
	it("returns a real project title", () => {
		expect(resolvePublishedRuntimeProjectName("  内容运营日历  ")).toBe("内容运营日历")
	})

	it.each([undefined, null, "", "   ", "micro-app-runtime_957589322901028865"])(
		"treats %j as missing",
		(name) => {
			expect(resolvePublishedRuntimeProjectName(name)).toBeUndefined()
		},
	)
})
