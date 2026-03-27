import type { ThemeMode } from "antd-style"
import type { Common } from "@/types/common"
import type * as apis from "@/apis"
import { ConfigRepository } from "@/models/config/repositories/ConfigRepository"
import { ClusterRepository } from "@/models/config/repositories/ClusterRepository"
import { configStore } from "@/models/config/stores"
import { isString } from "lodash-es"
import { BroadcastChannelSender } from "@/broadcastChannel"
import { Config } from "@/models/config/types"
import { getForcedLanguage, resolveLanguageSelection } from "@/models/config/languagePolicy"
import { SupportLocales } from "@/constants/locale"
import { env } from "@/utils/env"
import { normalizeLocale } from "@/utils/locale"

export class ConfigService {
	private readonly commonApi: typeof apis.CommonApi

	constructor(dependencies: typeof apis) {
		this.commonApi = dependencies.CommonApi
	}

	/**
	 * @description 初始化(持久化数据/内存状态)
	 */
	async init(options: Config.InitializeGlobalConfig) {
		const config = new ConfigRepository()
		const theme = await config.getThemeConfig()

		// 主题初始化
		if (!theme) {
			const defaultTheme = configStore.theme.theme
			await config.setThemeConfig(options.initializeTheme || defaultTheme)
		} else {
			configStore.theme.setTheme(theme as ThemeMode)
		}

		// 字体缩放初始化
		const fontScale = await config.getFontScaleConfig()
		if (fontScale === undefined) {
			const defaultFontScale = configStore.font.fontScale
			await config.setFontScaleConfig(defaultFontScale)
		} else {
			configStore.font.setFontScale(fontScale)
		}

		// 国际化语言初始化
		const initialLanguage = configStore.i18n.language

		const temporaryLanguage = this.getTemporaryLanguageFromUrl()
		if (temporaryLanguage) {
			// Apply URL language before any persisted sync.
			configStore.i18n.setTemporaryLanguage(temporaryLanguage)
		}

		const locale = await config.getLocaleConfig()
		const forcedLanguage = getForcedLanguage()
		if (forcedLanguage) {
			await config.setLocaleConfig(forcedLanguage as Config.LanguageValue)
			// Keep the session override while syncing storage.
			configStore.i18n.syncLanguage(forcedLanguage)
			return
		}

		if (!locale) {
			const defaultLocale = initialLanguage
			await config.setLocaleConfig(
				options.initializeI18n || (defaultLocale as Config.LanguageValue),
			)
			configStore.i18n.syncLanguage(options.initializeI18n || defaultLocale)
		} else {
			configStore.i18n.syncLanguage(locale)
		}
	}

	private getTemporaryLanguageFromUrl(): Config.LanguageValue | null {
		if (typeof window === "undefined") return null

		try {
			const searchParams = new URL(window.location.href).searchParams
			const rawLanguage = searchParams.get("lang") || searchParams.get("locale")
			if (!rawLanguage) return null

			const normalizedLanguage = normalizeLocale(rawLanguage.trim())
			if (
				normalizedLanguage !== SupportLocales.zhCN &&
				normalizedLanguage !== SupportLocales.enUS
			) {
				return null
			}

			return normalizedLanguage
		} catch (error) {
			console.error("Failed to get temporary language from URL:", error)
			return null
		}
	}

	async initialCluster() {
		const config = new ConfigRepository()
		// 集群编码初始化
		const [clusterCode, clusterCodeCache] = await Promise.all([
			config.getClusterConfig(),
			config.getClusterCacheConfig(),
		])
		if (!isString(clusterCode)) {
			const defaultClusterCodeCache = isString(clusterCodeCache)
				? clusterCodeCache
				: configStore.cluster.clusterCodeCache
			await config.setClusterConfig(defaultClusterCodeCache)
		} else {
			configStore.cluster.setClusterCode(clusterCode)
			configStore.cluster.setClusterCodeCache(clusterCodeCache || "")
		}

		// 集群配置初始化
		const cluster = new ClusterRepository()

		// 根据当前环境变量，强制更新 saas 配置
		await cluster.setClusterConfig(this.envConfigToClusterConfig())

		const clustersConfig = await cluster.getClustersConfig()
		if (!clustersConfig) {
			const defaultClusterConfig = configStore.cluster.clusterConfig
			await cluster.setClustersConfig(Object.values(defaultClusterConfig))
		} else {
			configStore.cluster.setClustersConfig(clustersConfig)
		}
	}

	envConfigToClusterConfig = () => {
		return {
			orgcode: "",
			deployCode: "",
			services: {
				keewoodAPI: {
					url: env("MAGIC_SERVICE_KEEWOOD_BASE_URL"),
				},
				teamshareAPI: {
					url: env("MAGIC_SERVICE_TEAMSHARE_BASE_URL"),
				},
				teamshareWeb: {
					url: env("MAGIC_TEAMSHARE_WEB_URL"),
				},
				keewoodWeb: {
					url: env("MAGIC_KEEWOOD_WEB_URL"),
				},
			},
		}
	}

	/**
	 * @description 远程同步配置
	 */
	loadConfig = async () => {
		try {
			const response = await this.commonApi.getInternationalizedSettings()
			if (response) {
				configStore.i18n.setLanguages(response.languages)
				configStore.i18n.setAreaCodes(response.phone_area_codes)
			}
		} catch (error) {
			console.error("Failed to fetch internationalization settings:", error)
		}
	}

	/**
	 * @description 主题设置
	 */
	setThemeConfig(theme: ThemeMode) {
		try {
			const config = new ConfigRepository()
			config.setThemeConfig(theme)
			configStore.theme.setTheme(theme)
		} catch (error) {
			console.error(error)
		}
	}

	/**
	 * @description 字体缩放设置
	 */
	setFontScaleConfig(scale: number) {
		try {
			const config = new ConfigRepository()
			config.setFontScaleConfig(scale)
			configStore.font.setFontScale(scale)
		} catch (error) {
			console.error(error)
		}
	}

	/**
	 * @description 设置国际化语言
	 */
	setLanguage(lang: Config.LanguageValue) {
		const targetLanguage = resolveLanguageSelection(lang) as Config.LanguageValue
		const hasTemporaryLanguage = Boolean(configStore.i18n.temporaryLanguage)

		if (!hasTemporaryLanguage && configStore.i18n.language === targetLanguage) {
			return
		}
		const config = new ConfigRepository()
		config.setLocaleConfig(targetLanguage).catch(console.error)
		configStore.i18n.setLanguage(targetLanguage)
		BroadcastChannelSender.switchLanguage(targetLanguage)
		import("@/lib/dayjs")
			.then((module) => {
				module.switchLanguage?.(targetLanguage)
			})
			.catch(console.error)
	}

	/**
	 * @description 设置集群配置（不包括设置当前访问集群）
	 */
	async setClusterConfig(clusterCode: string, clusterConfig: Common.PrivateConfig) {
		configStore.cluster.setClusterCodeCache(clusterCode)
		configStore.cluster.setClusterConfig(clusterCode, clusterConfig)

		try {
			// 数据持久化
			const cluster = new ClusterRepository()
			await cluster.setClusterConfig({ ...clusterConfig, deployCode: clusterCode })
			const config = new ConfigRepository()
			await config.setClusterCacheConfig(clusterCode)
		} catch (error) {
			console.warn(error)
		}
	}

	/**
	 * @description 设置当前访问的集群编码
	 * @param clusterCode 集群编码
	 */
	async setClusterCode(clusterCode: string) {
		// 内存状态变更
		configStore.cluster.setClusterCode(clusterCode)

		try {
			// 数据持久化
			const config = new ConfigRepository()
			await config.setClusterConfig(clusterCode)
		} catch (error) {
			console.warn(error)
		}
	}

	/**
	 * @description 设置集群编码缓存
	 * @param clusterCode
	 */
	async setClusterCodeCache(clusterCode: string) {
		configStore.cluster.setClusterCodeCache(clusterCode)
		try {
			const config = new ConfigRepository()
			await config.setClusterCacheConfig(clusterCode)
		} catch (error) {
			console.error("setClusterCodeCache error:", error)
		}
	}
}
