import { describe, expect, it } from "vitest"
import { resolveClawBrandTranslationValues } from "../clawBrand"

describe("resolveClawBrandTranslationValues", () => {
	it.each([
		{ isInternational: false, language: "zh_CN", clawBrand: "超级龙虾" },
		{ isInternational: false, language: "en_US", clawBrand: "SuperClaw" },
		{ isInternational: true, language: "zh_CN", clawBrand: "MagiClaw" },
		{ isInternational: true, language: "en_US", clawBrand: "MagiClaw" },
	])("returns $clawBrand for the configured environment and language", (expected) => {
		expect(resolveClawBrandTranslationValues(expected)).toMatchObject({
			clawBrand: expected.clawBrand,
		})
	})
})
