import { describe, expect, it } from "vitest"
import { hasCrewPublishName } from "./publish-name-guard"

describe("hasCrewPublishName", () => {
	it("returns true when localized name exists without default", () => {
		expect(
			hasCrewPublishName(
				{
					default: "",
					zh_CN: "员工名称",
					en_US: "Crew Name",
				},
				"zh_CN",
			),
		).toBe(true)
	})

	it("returns false when all localized names are empty", () => {
		expect(
			hasCrewPublishName(
				{
					default: "",
					zh_CN: "",
					en_US: "",
				},
				"zh_CN",
			),
		).toBe(false)
	})
})
