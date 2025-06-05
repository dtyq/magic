import { DEFAULT_LOCALE } from "@/const/locale"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import resourcesToBackend from "i18next-resources-to-backend"
import { normalizeLocale } from "@/utils/locale"

/**
 * Creates an i18nNext instance with the specified default language.
 *
 * @param {string} [defaultLang] - The default language to be used.
 * @return {Object} An object containing the initialized i18nNext instance and an `init` function to initialize the instance.
 */
export function createI18nNext(defaultLang?: string) {
	const instance = i18n
		.use(initReactI18next)
		.use(LanguageDetector)
		.use(
			resourcesToBackend(async (lng: string, namespace: string) => {
				if (namespace === "magicFlow") {
					return import(
						`../../../node_modules/@dtyq/magic-flow/dist/common/locales/${normalizeLocale(
							lng,
						)}/${namespace}.json`
					)
				}
				return import(`./${normalizeLocale(lng)}/${namespace}.json`)
			}),
		)

	return {
		init: () => {
			return instance.init({
				defaultNS: ["translation", "common", "interface"],
				ns: [
					"translation",
					"common",
					"interface",
					"message",
					"flow",
					"magicFlow",
					"component",
				],
				// the translations
				// (tip move them in a JSON file and import them,
				// or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
				lng: defaultLang, // if you're using a language detector, do not define the lng option
				fallbackLng: DEFAULT_LOCALE,
				interpolation: {
					escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
				},
			})
		},
		instance,
	}
}
