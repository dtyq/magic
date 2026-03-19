import { isMagicApp } from "@/utils/devices"
import { getNativePort } from "@/platform/native"
import { useMemoizedFn } from "ahooks"
import { logger } from "@/utils/log"

function useChangeAppLocale() {
	const changeAppLocale = useMemoizedFn(async (language: string) => {
		if (!isMagicApp) return

		const languages = await getNativePort().locale.getLanguages()
		const lang = language.split("_")[0]?.toLowerCase()
		const targetLanguage = languages?.languageList?.find((item) => item.key === lang)
		if (targetLanguage && targetLanguage.key !== languages.language) {
			logger.report({
				namespace: "AppLocale",
				data: {
					fromLanguage: language,
					toLanguage: targetLanguage,
					appLanguage: languages.language,
				},
			})
			getNativePort().locale.changeLanguage(targetLanguage.key)
		}
	})

	return {
		changeAppLocale,
	}
}

export default useChangeAppLocale
