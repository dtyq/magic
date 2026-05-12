import { makeAutoObservable } from "mobx"
import { createI18nNext } from "@/assets/locales/create"
import { normalizeLocale } from "@/utils/locale"
import type { Config } from "../types"
import { languageHelper } from "../utils"
import { env } from "@/utils/env"

export class I18nStore {
	language = env("MAGIC_DEFAULT_LANGUAGE") || "auto"

	temporaryLanguage: Config.LanguageValue | null = null

	languages: Array<Config.LanguageOption> = []

	areaCodes: Array<Config.AreaCodeOption> = []

	i18n: ReturnType<typeof createI18nNext>

	/** Resolves after init + first changeLanguage; avoids racing hydrate/sync. */
	private readonly i18nCoreReady: Promise<void>

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.i18n = createI18nNext(this.displayLanguage)
		// After init(), i18next can still report a different `language` than
		// MobX. Align before any hydrate/sync touches the singleton instance.
		this.i18nCoreReady = this.i18n
			.init()
			.then(() =>
				this.i18n.instance.changeLanguage(this.displayLanguage).then(() => undefined),
			)
	}

	waitForI18nCoreReady(): Promise<void> {
		return this.i18nCoreReady
	}

	get displayLanguage() {
		// URL language wins for the current session.
		if (this.temporaryLanguage) return this.temporaryLanguage

		return languageHelper.transform(normalizeLocale(this.language))
	}

	setTemporaryLanguage(lang: Config.LanguageValue | null) {
		this.temporaryLanguage = lang
		return this.waitForI18nCoreReady().then(() =>
			this.i18n.instance.changeLanguage(this.displayLanguage).then(() => undefined),
		)
	}

	// Sync persisted language without dropping URL overrides.
	syncLanguage(lang: string): Promise<void> {
		this.language = lang
		return this.waitForI18nCoreReady().then(() =>
			this.i18n.instance.changeLanguage(this.displayLanguage).then(() => undefined),
		)
	}

	// Explicit user changes should clear URL overrides.
	setLanguage(lang: string): Promise<void> {
		this.language = lang
		this.temporaryLanguage = null
		return this.waitForI18nCoreReady().then(() =>
			this.i18n.instance.changeLanguage(this.displayLanguage).then(() => undefined),
		)
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

		this.languages = supportedLanguages
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
