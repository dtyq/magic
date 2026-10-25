import { describe, expect, it } from "vitest"
import enUS from "@/assets/locales/en_US/super.json"
import zhCN from "@/assets/locales/zh_CN/super.json"

describe("slides template i18n", () => {
	it("keeps My templates keys aligned between Chinese and English", () => {
		expect(Object.keys(zhCN.mySlidesTemplates).sort()).toEqual(
			Object.keys(enUS.mySlidesTemplates).sort(),
		)
		expect(Object.keys(zhCN.mySlidesTemplates.guide).sort()).toEqual(
			Object.keys(enUS.mySlidesTemplates.guide).sort(),
		)
	})
})
