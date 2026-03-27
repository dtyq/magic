import { makeAutoObservable } from "mobx"
import { createI18nNext } from "@/assets/locales/create"
import { normalizeLocale } from "@/utils/locale"
import { getForcedLanguage, resolveLanguageSelection } from "@/models/config/languagePolicy"
import type { Config } from "../types"
import { languageHelper } from "../utils"
import { env } from "@/utils/env"

export class I18nStore {
	language = getForcedLanguage() || env("MAGIC_DEFAULT_LANGUAGE") || "auto"

	temporaryLanguage: Config.LanguageValue | null = null

	languages: Array<Config.LanguageOption> = []

	areaCodes: Array<Config.AreaCodeOption> = []

	i18n: ReturnType<typeof createI18nNext>

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.i18n = createI18nNext(this.displayLanguage)
		this.i18n.init()
	}

	get displayLanguage() {
		// URL language wins for the current session.
		if (this.temporaryLanguage) return this.temporaryLanguage

		const forcedLanguage = getForcedLanguage()
		if (forcedLanguage) return forcedLanguage

		return languageHelper.transform(
			this.language === "auto" ? normalizeLocale(window.navigator.language) : this.language,
		)
	}

	setTemporaryLanguage(lang: Config.LanguageValue | null) {
		this.temporaryLanguage = lang
		this.i18n.instance.changeLanguage(this.displayLanguage)
	}

	// Sync persisted language without dropping URL overrides.
	syncLanguage(lang: string) {
		this.language = resolveLanguageSelection(lang)
		this.i18n.instance.changeLanguage(this.displayLanguage)
	}

	// Explicit user changes should clear URL overrides.
	setLanguage(lang: string) {
		this.language = resolveLanguageSelection(lang)
		this.temporaryLanguage = null
		this.i18n.instance.changeLanguage(this.displayLanguage)
	}

	setLanguages(languages: Config.LanguageOption[]) {
		const supportedLanguages =
			languages
				// 目前只支持简体中文和英文
				?.filter((lang) => ["zh_CN", "en_US"].includes(lang.locale))
				?.map((lang) => {
					return {
						name: lang.name,
						locale: lang.locale,
						translations: lang?.translations,
					}
				}) || []

		const forcedLanguage = getForcedLanguage()
		this.languages = forcedLanguage
			? supportedLanguages.filter((lang) => lang.locale === forcedLanguage)
			: supportedLanguages
	}

	setAreaCodes(areaCodes: Config.AreaCodeOption[]) {
		this.areaCodes =
			areaCodes?.map((item) => {
				return {
					name: item.name,
					code: item.code,
					locale: item.locale,
					translations: item?.translations,
				}
			}) || []
	}
}

export const i18nStore = new I18nStore()
