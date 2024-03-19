import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getCurrentLang, normalizeLocale, getAntdLocale } from "../locale"
import { SupportLocales, DEFAULT_LOCALE } from "@/opensource/constants/locale"

// Mock window.navigator for testing
const mockNavigator = vi.fn()

describe("locale utilities", () => {
	let originalNavigator: Navigator

	beforeEach(() => {
		originalNavigator = window.navigator
		// Mock window.navigator.language
		Object.defineProperty(window, "navigator", {
			value: {
				language: "en-US",
			},
			writable: true,
		})
	})

	afterEach(() => {
		// Restore original navigator
		Object.defineProperty(window, "navigator", {
			value: originalNavigator,
			writable: true,
		})
		vi.clearAllMocks()
	})

	describe("getCurrentLang", () => {
		describe('when lang parameter is "auto"', () => {
			it("should return zh_CN for Chinese browser language variants", () => {
				// Arrange
				const chineseVariants = [
					"zh",
					"zh-CN",
					"zh-Hans",
					"zh-TW",
					"zh-HK",
					"ZH-CN", // Test case insensitive
				]

				chineseVariants.forEach((lang) => {
					// Arrange
					Object.defineProperty(window.navigator, "language", {
						value: lang,
						writable: true,
					})

					// Act
					const result = getCurrentLang("auto")

					// Assert
					expect(result).toBe(SupportLocales.zhCN)
				})
			})

			it("should return en_US for English browser language variants", () => {
				// Arrange
				const englishVariants = [
					"en",
					"en-US",
					"en-GB",
					"en-AU",
					"EN-US", // Test case insensitive
				]

				englishVariants.forEach((lang) => {
					// Arrange
					Object.defineProperty(window.navigator, "language", {
						value: lang,
						writable: true,
					})

					// Act
					const result = getCurrentLang("auto")

					// Assert
					expect(result).toBe(SupportLocales.enUS)
				})
			})

			it("should return default locale for unsupported browser languages", () => {
				// Arrange
				const unsupportedLanguages = [
					"fr-FR",
					"de-DE",
					"ja-JP",
					"ko-KR",
					"es-ES",
					"it-IT",
					"pt-BR",
					"ru-RU",
					"ar-SA",
					"unknown-language",
					"",
				]

				unsupportedLanguages.forEach((lang) => {
					// Arrange
					Object.defineProperty(window.navigator, "language", {
						value: lang,
						writable: true,
					})

					// Act
					const result = getCurrentLang("auto")

					// Assert
					expect(result).toBe(DEFAULT_LOCALE)
				})
			})
		})

		describe("when lang parameter is a specific language code", () => {
			it("should return the same language if it is supported", () => {
				// Arrange & Act & Assert
				expect(getCurrentLang(SupportLocales.zhCN)).toBe(SupportLocales.zhCN)
				expect(getCurrentLang(SupportLocales.enUS)).toBe(SupportLocales.enUS)
			})

			it("should normalize common language codes to supported formats", () => {
				// Arrange & Act & Assert
				expect(getCurrentLang("en")).toBe(SupportLocales.enUS)
				expect(getCurrentLang("zh")).toBe(SupportLocales.zhCN)
			})

			it("should return default locale for unsupported language codes", () => {
				// Arrange
				const unsupportedCodes = [
					"fr_FR",
					"de_DE",
					"ja_JP",
					"ko_KR",
					"es_ES",
					"it_IT",
					"pt_BR",
					"ru_RU",
					"ar_SA",
					"invalid-code",
					"",
					"null",
					"undefined",
				]

				unsupportedCodes.forEach((code) => {
					// Act
					const result = getCurrentLang(code as any)

					// Assert
					expect(result).toBe(DEFAULT_LOCALE)
				})
			})
		})

		describe("type safety and edge cases", () => {
			it("should handle undefined navigator.language gracefully", () => {
				// Arrange
				Object.defineProperty(window.navigator, "language", {
					value: undefined,
					writable: true,
				})

				// Act
				const result = getCurrentLang("auto")

				// Assert
				expect(result).toBe(DEFAULT_LOCALE)
			})

			it("should handle null navigator.language gracefully", () => {
				// Arrange
				Object.defineProperty(window.navigator, "language", {
					value: null,
					writable: true,
				})

				// Act
				const result = getCurrentLang("auto")

				// Assert
				expect(result).toBe(DEFAULT_LOCALE)
			})

			it("should handle malformed language codes", () => {
				// Arrange
				const malformedCodes = ["--", "zh--CN", "en--US", "zh_", "_CN", "zh-", "-CN"]

				malformedCodes.forEach((code) => {
					Object.defineProperty(window.navigator, "language", {
						value: code,
						writable: true,
					})

					// Act
					const result = getCurrentLang("auto")

					// Assert
					// Should handle gracefully and return appropriate locale or default
					expect(typeof result).toBe("string")
					expect(result.length > 0).toBe(true)
				})
			})
		})

		describe("consistency with constants", () => {
			it("should always return values that match SupportLocales enum", () => {
				// Arrange
				const testCases = [
					"auto",
					SupportLocales.zhCN,
					SupportLocales.enUS,
					"fr_FR", // unsupported
				]

				testCases.forEach((testCase) => {
					// Act
					const result = getCurrentLang(testCase as any)

					// Assert
					const validLocales = [SupportLocales.zhCN, SupportLocales.enUS]
					expect(validLocales).toContain(result)
				})
			})

			it('should never return "auto" as a result', () => {
				// Arrange
				const testCases = [
					"auto",
					SupportLocales.zhCN,
					SupportLocales.enUS,
					"fr_FR",
					"de_DE",
				]

				testCases.forEach((testCase) => {
					// Act
					const result = getCurrentLang(testCase as any)

					// Assert
					expect(result).not.toBe("auto")
				})
			})
		})
	})

	describe("normalizeLocale", () => {
		it("should normalize Chinese language variants to zh_CN", () => {
			// Arrange & Act & Assert
			expect(normalizeLocale("zh")).toBe(SupportLocales.zhCN)
			expect(normalizeLocale("zh-CN")).toBe(SupportLocales.zhCN)
			expect(normalizeLocale("zh-Hans")).toBe(SupportLocales.zhCN)
		})

		it("should normalize English language variants to en_US", () => {
			// Arrange & Act & Assert
			expect(normalizeLocale("en")).toBe(SupportLocales.enUS)
			expect(normalizeLocale("en-US")).toBe(SupportLocales.enUS)
		})

		it("should return default locale for undefined input", () => {
			// Arrange & Act & Assert
			expect(normalizeLocale()).toBe(DEFAULT_LOCALE)
			expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE)
		})

		it("should handle auto detection recursively", () => {
			// Arrange
			Object.defineProperty(window.navigator, "language", {
				value: "en-US",
				writable: true,
			})

			// Act & Assert
			expect(normalizeLocale("auto")).toBe(SupportLocales.enUS)
		})

		it("should return original locale for unrecognized inputs", () => {
			// Arrange & Act & Assert
			expect(normalizeLocale("fr_FR")).toBe("fr_FR")
			expect(normalizeLocale("custom-locale")).toBe("custom-locale")
		})
	})

	describe("getAntdLocale", () => {
		it("should handle supported locales without throwing", async () => {
			// This test ensures the function structure is correct
			// The actual import may fail in test environment, which is expected
			await expect(getAntdLocale(SupportLocales.zhCN)).resolves.toBeDefined()
			await expect(getAntdLocale(SupportLocales.enUS)).resolves.toBeDefined()
		})

		it("should handle unsupported locales gracefully", async () => {
			// Act & Assert - should not throw
			await expect(getAntdLocale("fr_FR")).resolves.toBeDefined()
		})
	})
})
