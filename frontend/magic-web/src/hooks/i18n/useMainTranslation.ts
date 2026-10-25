import { useTranslation } from "react-i18next"
import type { UseTranslationOptions } from "react-i18next"
import { i18nStore } from "@/models/config/stores/i18n.store"

/**
 * Read copy from the main app i18n instance inside Admin or other nested I18nextProvider trees.
 */
export function useMainTranslation(
	ns?: string | string[],
	options?: Omit<UseTranslationOptions, "i18n">,
) {
	return useTranslation(ns, {
		...options,
		i18n: i18nStore.i18n.instance,
	})
}
