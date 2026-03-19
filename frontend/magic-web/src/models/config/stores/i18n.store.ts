import { makeAutoObservable } from "mobx"
import { createI18nNext } from "@/assets/locales/create"
import { normalizeLocale } from "@/utils/locale"
import type { Config } from "../types"
import { languageHelper } from "../utils"
import { env } from "@/utils/env"

export class I18nStore {
	language = env("MAGIC_DEFAULT_LANGUAGE") || "auto"

	languages: Array<Config.LanguageOption> = []

	areaCodes: Array<Config.AreaCodeOption> = []

	i18n: ReturnType<typeof createI18nNext>

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.i18n = createI18nNext(this.displayLanguage)
		this.i18n.init()
	}

	get displayLanguage() {
		return languageHelper.transform(
			this.language === "auto" ? normalizeLocale(window.navigator.language) : this.language,
		)
	}

	setLanguage(lang: string) {
		this.language = lang
		this.i18n.instance.changeLanguage(this.displayLanguage)
	}

	setLanguages(languages: Config.LanguageOption[]) {
		this.languages =
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
