import { DEFAULT_LOCALE, SupportLocales } from "../const/locale"
import { languageHelper } from "../provider/LocaleProvider/utils"


export const normalizeLocale = (locale?: string) => {
	if (!locale) return DEFAULT_LOCALE

	switch (locale) {
		case "zh":
		case "zh-CN":
		case "zh-Hans":
			return SupportLocales.zhCN
		case "en":
			return SupportLocales.enUS
		default:
			return locale
	}
}


export const getAntdLocale = async (lang: string) => {
	const normalLang = languageHelper.transform(lang)

	// due to antd only have ar-EG locale, we need to convert ar to ar-EG
	// refs: https://ant.design/docs/react/i18n

	// And we don't want to handle it in `normalizeLocale` function
	// because of other locale files are all `ar` not `ar-EG`
	// if (normalLang === "ar") normalLang = "ar_EG"
	try {
		const { default: locale } = await import(
			`../../../node_modules/antd/locale/${normalizeLocale(normalLang)}.js`
		)

		return locale
	} catch (error) {
		console.error(`Failed to load antd locale for ${normalLang}:`, error)
		return null // 或者返回默认语言包
	}
}


export const getCurrentLang = <T extends string>(lang: "auto" | T): T => {
	if (lang === "auto") {
		return window.navigator.language as T
	}
	return lang
}
