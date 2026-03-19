import { makeAutoObservable } from "mobx"
import type { PlatformConfig } from "@/apis/types"
import type { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"

export class GlobalConfigStore {
	globalConfig?: PlatformConfig

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Update favicon
	 * @param favicon favicon URL
	 */
	updateFavicon(favicon: string) {
		const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
		if (link) link.href = favicon
	}

	/**
	 * Dynamically update meta information in i18n resources
	 * @param config Global configuration
	 * @param i18n i18next instance
	 */
	async updateI18nMetaResources(
		config: PlatformConfig,
		i18n: ReturnType<typeof useTranslation>["i18n"],
	) {
		// 确保 common namespace 已经加载完成
		await i18n.loadNamespaces("common")

		// Get default title (from existing i18n resources as fallback)
		const defaultZhTitle = i18n.t("meta.title", { lng: SupportLocales.zhCN, ns: "common" })
		const defaultEnTitle = i18n.t("meta.title", { lng: SupportLocales.enUS, ns: "common" })

		const defaultPlatformNameZh = i18n.t("platform.name", {
			lng: SupportLocales.zhCN,
			ns: "common",
		})
		const defaultPlatformNameEn = i18n.t("platform.name", {
			lng: SupportLocales.enUS,
			ns: "common",
		})
		// Get current resource bundle, preserve other fields
		const zhCNCommon = i18n.getResourceBundle(SupportLocales.zhCN, "common") || {}
		const enUSCommon = i18n.getResourceBundle(SupportLocales.enUS, "common") || {}

		// Update Chinese resources - use addResourceBundle to fully replace
		i18n.addResourceBundle(
			SupportLocales.zhCN,
			"common",
			{
				...zhCNCommon,
				meta: {
					title: config.title_i18n?.[SupportLocales.zhCN] || defaultZhTitle,
					keywords: config.keywords_i18n?.[SupportLocales.zhCN] || "",
					description: config.description_i18n?.[SupportLocales.zhCN] || "",
				},
				platform: {
					name: config.name_i18n?.[SupportLocales.zhCN] || defaultPlatformNameZh,
				},
			},
			true, // deep merge
			true, // overwrite
		)

		// Update English resources - use addResourceBundle to fully replace
		i18n.addResourceBundle(
			SupportLocales.enUS,
			"common",
			{
				...enUSCommon,
				meta: {
					title: config.title_i18n?.[SupportLocales.enUS] || defaultEnTitle,
					keywords: config.keywords_i18n?.[SupportLocales.enUS] || "",
					description: config.description_i18n?.[SupportLocales.enUS] || "",
				},
				platform: {
					name: config.name_i18n?.[SupportLocales.enUS] || defaultPlatformNameEn,
				},
			},
			true, // deep merge
			true, // overwrite
		)

		i18n.emit("languageChanged", i18n.language)
	}

	/**
	 * Initialize global configuration
	 * @param config Global configuration
	 * @param i18n i18next instance
	 */
	async initGlobalConfig(
		config: PlatformConfig,
		i18n: ReturnType<typeof useTranslation>["i18n"],
	) {
		this.globalConfig = config
		if (config.favicon) {
			this.updateFavicon(config.favicon)
		}
		await this.updateI18nMetaResources(config, i18n)
	}
}

export const globalConfigStore = new GlobalConfigStore()
