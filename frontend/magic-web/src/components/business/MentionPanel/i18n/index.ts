// Types
export type { Language, I18nTexts, UseI18nReturn, LocaleInput } from "./types"
import type { Language, LocaleInput } from "./types"

// Language packs
export { en } from "./locales/en"
export { zhCN } from "./locales/zh-CN"

// Default language mapping
export const LANGUAGE_PACKS = {
	en: () => import("./locales/en").then((m) => m.en),
	"zh-CN": () => import("./locales/zh-CN").then((m) => m.zhCN),
} as const

/**
 * Normalize various locale formats to our standard Language type
 * Supports: zh_CN, zh-CN, zh-cn, zh_cn, zh -> "zh-CN"
 *          en_US, en-US, en-us, en_us, en -> "en"
 */
export function normalizeLocale(locale: LocaleInput): Language {
	if (!locale || typeof locale !== "string") {
		return "en"
	}

	const normalized = locale.toLowerCase().trim()

	// Chinese locale variants
	if (
		normalized === "zh" ||
		normalized === "zh_cn" ||
		normalized === "zh-cn" ||
		normalized === "zh_chs" ||
		normalized === "zh-chs" ||
		normalized.startsWith("zh_") ||
		normalized.startsWith("zh-") ||
		normalized === "chinese" ||
		normalized === "中文"
	) {
		return "zh-CN"
	}

	// English locale variants
	if (
		normalized === "en" ||
		normalized === "en_us" ||
		normalized === "en-us" ||
		normalized === "en_gb" ||
		normalized === "en-gb" ||
		normalized.startsWith("en_") ||
		normalized.startsWith("en-") ||
		normalized === "english"
	) {
		return "en"
	}

	// Fallback to English for unknown locales
	console.warn(`Unsupported locale: ${locale}, falling back to English`)
	return "en"
}

/**
 * Get browser's preferred language with enhanced detection
 */
export function getBrowserLanguage(): Language {
	if (typeof navigator === "undefined") {
		return "en"
	}

	// Try navigator.language first
	if (navigator.language) {
		return normalizeLocale(navigator.language)
	}

	// Try navigator.languages array
	if (navigator.languages && navigator.languages.length > 0) {
		for (const lang of navigator.languages) {
			const normalized = normalizeLocale(lang)
			if (normalized) {
				return normalized
			}
		}
	}

	// Legacy fallbacks for older browsers
	const navigatorWithLegacy = navigator as Navigator & {
		userLanguage?: string
		browserLanguage?: string
	}
	const legacyLang = navigatorWithLegacy.userLanguage || navigatorWithLegacy.browserLanguage
	if (legacyLang) {
		return normalizeLocale(legacyLang)
	}

	return "en"
}

/**
 * Default language detection with multiple fallbacks
 */
export function getDefaultLanguage(): Language {
	// 1. Try environment variable (for server-side)
	if (typeof process !== "undefined" && process.env) {
		const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL
		if (envLang) {
			return normalizeLocale(envLang)
		}
	}

	// 2. Try browser detection
	return getBrowserLanguage()
}

/**
 * Validate if a locale input is supported
 */
export function isSupportedLocale(locale: LocaleInput): boolean {
	if (!locale || typeof locale !== "string") {
		return false
	}

	const normalized = locale.toLowerCase().trim()

	// Check if it's a supported Chinese variant
	if (
		normalized === "zh" ||
		normalized === "zh_cn" ||
		normalized === "zh-cn" ||
		normalized === "zh_chs" ||
		normalized === "zh-chs" ||
		normalized.startsWith("zh_") ||
		normalized.startsWith("zh-") ||
		normalized === "chinese" ||
		normalized === "中文"
	) {
		return true
	}

	// Check if it's a supported English variant
	if (
		normalized === "en" ||
		normalized === "en_us" ||
		normalized === "en-us" ||
		normalized === "en_gb" ||
		normalized === "en-gb" ||
		normalized.startsWith("en_") ||
		normalized.startsWith("en-") ||
		normalized === "english"
	) {
		return true
	}

	// Not supported
	return false
}

/**
 * Get the best matching language from a list of preferred languages
 */
export function getBestMatchingLanguage(preferredLanguages: LocaleInput[]): Language {
	for (const lang of preferredLanguages) {
		if (isSupportedLocale(lang)) {
			return normalizeLocale(lang)
		}
	}
	return getDefaultLanguage()
}
