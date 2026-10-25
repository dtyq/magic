import i18next, { type i18n as I18nextInstance } from "i18next"
import resourcesToBackend from "i18next-resources-to-backend"
import { initReactI18next } from "react-i18next"
import { loadMessages } from "@magic-admin-v2/i18n/load-messages"
import {
  defaultLanguage,
  normalizeLanguage,
  supportedLanguages,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources"

export const defaultNamespace = "common"

export type I18nInstance = {
	instance: I18nextInstance
	ensureLanguage(language: LanguageCode): Promise<void>
}

export function createI18nInstance({
	includeDevelopment,
}: {
	includeDevelopment: boolean
}): I18nInstance {
	const instance = i18next.createInstance()
	let initPromise: Promise<unknown> | null = null
	let languageQueue = Promise.resolve()
	const catalogPromises = new Map<LanguageCode, ReturnType<typeof loadMessages>>()

	function loadCatalog(language: LanguageCode) {
		let catalogPromise = catalogPromises.get(language)
		if (!catalogPromise) {
			catalogPromise = loadMessages(language, includeDevelopment).catch((error: unknown) => {
				catalogPromises.delete(language)
				throw error
			})
			catalogPromises.set(language, catalogPromise)
		}
		return catalogPromise
	}

	instance.use(initReactI18next).use(
		resourcesToBackend(async (language: string, namespace: string) => {
			const catalog = await loadCatalog(normalizeLanguage(language))
			return catalog[namespace] ?? {}
		}),
	)

	function initialize(language: LanguageCode) {
		if (!initPromise) {
			initPromise = loadCatalog(language)
				.then((catalog) =>
					instance.init({
						defaultNS: defaultNamespace,
						fallbackLng: defaultLanguage,
						fallbackNS: [defaultNamespace],
						nsSeparator: ".",
						interpolation: {
							escapeValue: false,
						},
						load: "currentOnly",
						lng: language,
						ns: Object.keys(catalog),
						react: { useSuspense: false },
						returnNull: false,
						supportedLngs: [...supportedLanguages],
					}),
				)
				.catch((error: unknown) => {
					initPromise = null
					throw error
				})
		}
		return initPromise
	}

	return {
		instance,
		ensureLanguage(language) {
			languageQueue = languageQueue
				.catch(() => undefined)
				.then(async () => {
					await initialize(language)
					if (instance.resolvedLanguage !== language) {
						await instance.changeLanguage(language)
					}
				})
			return languageQueue
		},
	}
}
