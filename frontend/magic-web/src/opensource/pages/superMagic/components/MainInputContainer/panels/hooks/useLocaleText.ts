import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { LocaleText } from "../types"
import { resolveLocaleText } from "../utils"

/**
 * Hook to resolve LocaleText to a plain string for the current locale.
 * Use in components that render config-driven text.
 */
export function useLocaleText() {
	const { i18n } = useTranslation()
	return useCallback(
		(text: LocaleText | undefined) => resolveLocaleText(text, i18n.language),
		[i18n.language],
	)
}
