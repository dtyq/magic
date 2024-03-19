import { describe, it, expect } from "vitest"
import { normalizeLocale, isSupportedLocale, getBestMatchingLanguage } from "../index"

describe("Locale Normalization", () => {
	describe("normalizeLocale", () => {
		it("should handle Chinese locale variants", () => {
			expect(normalizeLocale("zh")).toBe("zh-CN")
			expect(normalizeLocale("zh_CN")).toBe("zh-CN")
			expect(normalizeLocale("zh-CN")).toBe("zh-CN")
			expect(normalizeLocale("zh-cn")).toBe("zh-CN")
			expect(normalizeLocale("zh_cn")).toBe("zh-CN")
			expect(normalizeLocale("zh_CHS")).toBe("zh-CN")
			expect(normalizeLocale("zh-chs")).toBe("zh-CN")
			expect(normalizeLocale("chinese")).toBe("zh-CN")
			expect(normalizeLocale("中文")).toBe("zh-CN")
		})

		it("should handle English locale variants", () => {
			expect(normalizeLocale("en")).toBe("en")
			expect(normalizeLocale("en_US")).toBe("en")
			expect(normalizeLocale("en-US")).toBe("en")
			expect(normalizeLocale("en-us")).toBe("en")
			expect(normalizeLocale("en_us")).toBe("en")
			expect(normalizeLocale("en_GB")).toBe("en")
			expect(normalizeLocale("en-gb")).toBe("en")
			expect(normalizeLocale("english")).toBe("en")
		})

		it("should fallback to English for unknown locales", () => {
			expect(normalizeLocale("fr")).toBe("en")
			expect(normalizeLocale("de")).toBe("en")
			expect(normalizeLocale("ja")).toBe("en")
			expect(normalizeLocale("invalid")).toBe("en")
			expect(normalizeLocale("")).toBe("en")
			expect(normalizeLocale(null as any)).toBe("en")
			expect(normalizeLocale(undefined as any)).toBe("en")
		})

		it("should handle case insensitive input", () => {
			expect(normalizeLocale("ZH-CN")).toBe("zh-CN")
			expect(normalizeLocale("EN-US")).toBe("en")
			expect(normalizeLocale("Zh_Cn")).toBe("zh-CN")
			expect(normalizeLocale("En_Us")).toBe("en")
		})
	})

	describe("isSupportedLocale", () => {
		it("should return true for supported locales", () => {
			expect(isSupportedLocale("en")).toBe(true)
			expect(isSupportedLocale("zh-CN")).toBe(true)
			expect(isSupportedLocale("zh")).toBe(true)
			expect(isSupportedLocale("zh_CN")).toBe(true)
			expect(isSupportedLocale("en_US")).toBe(true)
		})

		it("should return false for unsupported locales", () => {
			expect(isSupportedLocale("fr")).toBe(false)
			expect(isSupportedLocale("de")).toBe(false)
			expect(isSupportedLocale("ja")).toBe(false)
			expect(isSupportedLocale("")).toBe(false)
		})
	})

	describe("getBestMatchingLanguage", () => {
		it("should return the first supported language", () => {
			expect(getBestMatchingLanguage(["fr", "zh", "en"])).toBe("zh-CN")
			expect(getBestMatchingLanguage(["de", "en_US", "zh"])).toBe("en")
			expect(getBestMatchingLanguage(["zh-CN", "en"])).toBe("zh-CN")
		})

		it("should fallback to default when no supported languages", () => {
			const result = getBestMatchingLanguage(["fr", "de", "ja"])
			expect(result === "en" || result === "zh-CN").toBe(true) // depends on environment
		})

		it("should handle empty array", () => {
			const result = getBestMatchingLanguage([])
			expect(result === "en" || result === "zh-CN").toBe(true) // depends on environment
		})
	})
})
