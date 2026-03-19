import { DEFAULT_LOCALE, SupportLocales, SUPPORT_LOCALES } from "@/constants/locale"
import { languageHelper } from "@/models/config/utils"

export const normalizeLocale = (locale?: string): string => {
	if (!locale) return DEFAULT_LOCALE

	switch (locale) {
		case "zh":
		case "zh-CN":
		case "zh-Hans":
			return SupportLocales.zhCN
		case "en":
		case "en-US":
			return SupportLocales.enUS
		case "auto":
			return normalizeLocale(window.navigator.language)
		default:
			return locale
	}
}

export const getAntdLocale = async (lang: string) => {
	const normalLang = languageHelper.transform(lang)

	// due to antd only have ar-EG locale, we need to convert ar to ar-GE
	// refs: https://ant.design/docs/react/i18n

	// And we don't want to handle it in `normalizeLocale` function
	// because of other locale files are all `ar` not `ar-EG`
	// if (normalLang === "ar") normalLang = "ar_EG"
	const normalizedLang = normalizeLocale(normalLang)
	const localeLoader = ANTD_LOCALE_LOADERS[normalizedLang] ?? ANTD_LOCALE_LOADERS[DEFAULT_LOCALE]
	if (!localeLoader) return null

	try {
		const { default: locale } = await localeLoader()
		return locale
	} catch (error) {
		console.error(`Failed to load antd locale for ${normalizedLang}:`, error)
		return null
	}
}

/**
 * Get current language based on input parameter, ensuring only supported languages are returned
 *
 * @param lang - Language parameter, can be "auto" for automatic detection or a specific language code
 * @returns Supported language code (zh_CN or en_US), with fallback to default locale for unsupported languages
 *
 * @example
 * // Auto detection based on browser language
 * getCurrentLang("auto") // Returns "zh_CN" for Chinese browsers, "en_US" for English browsers
 *
 * // Specific language validation
 * getCurrentLang("zh_CN") // Returns "zh_CN" (supported)
 * getCurrentLang("fr_FR") // Returns "zh_CN" (fallback for unsupported language)
 */
export const getCurrentLang = <T extends string>(lang: "auto" | T): T => {
	if (lang === "auto") {
		const browserLang = window.navigator.language?.toLowerCase()

		// Handle undefined or null navigator.language
		if (!browserLang) {
			return DEFAULT_LOCALE as T
		}

		// Check for Chinese language variants
		if (browserLang.startsWith("zh")) {
			return SupportLocales.zhCN as T
		}

		// Check for English language variants
		if (browserLang.startsWith("en")) {
			return SupportLocales.enUS as T
		}

		// Fallback to default locale for unsupported languages
		return DEFAULT_LOCALE as T
	}

	// Normalize common language codes to supported formats
	let normalizedLang = lang
	if (lang === "en") {
		normalizedLang = SupportLocales.enUS as T
	} else if (lang === "zh") {
		normalizedLang = SupportLocales.zhCN as T
	}

	// For non-auto languages, validate if it's supported
	if (SUPPORT_LOCALES.includes(normalizedLang as any)) {
		return normalizedLang
	}

	// Fallback to default locale for unsupported languages
	return DEFAULT_LOCALE as T
}

const ANTD_LOCALE_LOADERS: Record<string, () => Promise<{ default: any }>> = {
	[SupportLocales.zhCN]: () => import("antd/locale/zh_CN"),
	[SupportLocales.enUS]: () => import("antd/locale/en_US"),
}
