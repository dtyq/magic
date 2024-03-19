import { normalizeLocale } from "@/common/utils/locale"
import i18next from "i18next"
import { useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { store as internationalizedStore } from "./store"

/**
 * 获取全局语言
 * @param includeAuto 是否包含自动
 */
export function useGlobalLanguage<T>(includeAuto: T = true as T) {
	const language = internationalizedStore(useShallow((store) => store.language))
	if (includeAuto) return language
	return language === "auto" ? normalizeLocale(window.navigator.language) : language
}

/**
 * 获取全局列表
 * @param includeAuto 是否包含自动
 */
export function useSupportLanguageOptions(includeAuto = true) {
	const { language, languages } = internationalizedStore(
		useShallow((store) => ({
			language: store.language,
			languages: store.languages,
		})),
	)

	return useMemo(() => {
		return languages.reduce<
			Array<{ label: string; value: string; translations?: Record<string, string> }>
		>(
			(array, lang) => {
				array.push({
					label: lang.translations?.[language] || lang.name,
					value: lang.locale,
					translations: lang.translations,
				})
				return array
			},
			includeAuto
				? [
						{
							label: i18next.t("setting.languages.auto", { ns: "magicFlow" }),
							value: "auto",
						},
				  ]
				: [],
		)
	}, [includeAuto, language, languages])
}
