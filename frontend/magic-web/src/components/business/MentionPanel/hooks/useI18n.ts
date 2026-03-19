import { useState, useMemo, useCallback } from "react"
import type { Language, I18nTexts, UseI18nReturn, LocaleInput } from "../i18n/types"
import { en } from "../i18n/locales/en"
import { zhCN } from "../i18n/locales/zh-CN"
import { getDefaultLanguage, normalizeLocale, isSupportedLocale } from "../i18n"

// Language pack mapping
const LANGUAGE_PACKS: Record<Language, I18nTexts> = {
	en,
	"zh-CN": zhCN,
}

/**
 * useI18n - Internationalization hook with enhanced locale support
 *
 * @param initialLanguage - Initial language setting (supports various formats)
 * @returns Internationalization utilities
 */
export function useI18n(initialLanguage?: LocaleInput): UseI18nReturn {
	// Validate and normalize initial language
	const validatedInitialLanguage = useMemo(() => {
		if (initialLanguage) {
			return normalizeLocale(initialLanguage)
		}
		return getDefaultLanguage()
	}, [initialLanguage])

	const [language, setLanguage] = useState<Language>(validatedInitialLanguage)

	// Get current language texts
	const t = useMemo<I18nTexts>(() => {
		return LANGUAGE_PACKS[language] || LANGUAGE_PACKS.en
	}, [language])

	// Language setter with validation and normalization
	const handleSetLanguage = useCallback((lang: LocaleInput) => {
		const normalizedLang = normalizeLocale(lang)
		if (isSupportedLocale(normalizedLang)) {
			setLanguage(normalizedLang)
		} else {
			console.warn(`Unsupported language: ${lang}, falling back to English`)
			setLanguage("en")
		}
	}, [])

	return {
		t,
		language,
		setLanguage: handleSetLanguage,
	}
}

/**
 * useI18nStatic - Static i18n hook for cases where language doesn't change
 *
 * @param language - Fixed language (supports various formats)
 * @returns Static texts for the specified language
 */
export function useI18nStatic(language: LocaleInput = "en"): I18nTexts {
	return useMemo(() => {
		const normalizedLang = normalizeLocale(language)
		return LANGUAGE_PACKS[normalizedLang] || LANGUAGE_PACKS.en
	}, [language])
}
