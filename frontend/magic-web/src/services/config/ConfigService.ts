import type { ThemeMode } from "antd-style"
import type { Common } from "@/types/common"
import type * as apis from "@/apis"
import { ConfigRepository } from "@/models/config/repositories/ConfigRepository"
import { ClusterRepository } from "@/models/config/repositories/ClusterRepository"
import { configStore } from "@/models/config/stores"
import { isString } from "lodash-es"
import { BroadcastChannelSender } from "@/broadcastChannel"
import { Config } from "@/models/config/types"
import { env } from "@/utils/env"

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
		const locale = await config.getLocaleConfig()
		if (!locale) {
			const defaultLocale = configStore.i18n.language
			await config.setLocaleConfig(
				options.initializeI18n || (defaultLocale as Config.LanguageValue),
			)
			configStore.i18n.setLanguage(options.initializeI18n || defaultLocale)
		} else {
			configStore.i18n.setLanguage(locale)
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
		if (configStore.i18n.language === lang) {
			return
		}
		const config = new ConfigRepository()
		config.setLocaleConfig(lang).catch(console.error)
		configStore.i18n.setLanguage(lang)
		BroadcastChannelSender.switchLanguage(lang)
		import("@/lib/dayjs")
			.then((module) => {
				module.switchLanguage?.(lang)
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
