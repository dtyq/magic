import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import type { ThemeMode } from "antd-style"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"
import { isMagicApp } from "@/utils/devices"
import { getNativePort } from "@/platform/native"
import { SUPPORT_LOCALES } from "@/constants/locale"

const enum ConfigType {
	Theme = "theme",
	I18n = "i18n",
	Cluster = "cluster",
	clusterCodeCache = "clusterCodeCache",
	FontScale = "fontScale",
}

interface ConfigSchema {
	id?: string
	key: ConfigType
	value: string
	enabled?: boolean
	createdAt?: number
	updatedAt?: number
}

export class ConfigRepository extends GlobalBaseRepository<ConfigSchema> {
	static readonly tableName = "config"

	static readonly version = 1

	constructor() {
		super(ConfigRepository.tableName)
	}

	/**
	 * @description 获取主题配置
	 */
	public async getThemeConfig(): Promise<ThemeMode | undefined> {
		try {
			const config = await this.get(ConfigType.Theme)
			return config?.value as ThemeMode
		} catch (error) {
			logger.error({
				eventKey: "get_theme_config_failed",
				errorKind: "unknown",
				error: error,
				message: "getThemeConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.Theme}`)?.value
		}
	}

	/**
	 * @description 保存主题配置
	 */
	public async setThemeConfig(theme: ThemeMode): Promise<void> {
		this.cacheConfig(ConfigType.Theme, theme)
		try {
			const themeConfig = await this.get(ConfigType.Theme)
			await this.put({
				...themeConfig,
				key: ConfigType.Theme,
				value: theme,
			})
		} catch (error) {
			logger.error({
				eventKey: "set_theme_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setThemeConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
		}
	}

	/**
	 * @description 获取国际化语言
	 */
	public async getLocaleConfig(): Promise<string | undefined> {
		try {
			try {
				// 兼容 APP 生态下同步设备语言(app语言为zh、en、vi)
				if (isMagicApp) {
					const languages = await getNativePort().locale.getLanguages()
					const appLanguage = languages.language

					const supportLocale = SUPPORT_LOCALES.find(
						(item) => item.indexOf(appLanguage) > -1,
					)
					if (supportLocale) {
						return supportLocale
					}
				}
			} catch (error) {
				logger.error({
					eventKey: "get_locale_config_by_app_sdk_failed",
					errorKind: "unknown",
					error: error,
					message: "getLocaleConfigByAppSDKError",
					context: { tableName: ConfigRepository.tableName },
				})
			}
			const config = await this.get(ConfigType.I18n)
			return config?.value as string
		} catch (error) {
			logger.error({
				eventKey: "get_locale_config_failed",
				errorKind: "unknown",
				error: error,
				message: "getLocaleConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.I18n}`)?.value
		}
	}

	/**
	 * @description 保存国际化语言标识配置
	 */
	public async setLocaleConfig(locale: string): Promise<void> {
		this.cacheConfig(ConfigType.I18n, locale)
		try {
			const localeConfig = await this.get(ConfigType.I18n)
			await this.put({
				...localeConfig,
				key: ConfigType.I18n,
				value: locale,
			})
		} catch (error) {
			logger.error({
				eventKey: "set_locale_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setLocaleConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
		}
	}

	/**
	 * @description 获取集群配置
	 */
	public async getClusterConfig(): Promise<string | undefined> {
		try {
			const config = await this.get(ConfigType.Cluster)
			return config?.value as string
		} catch (error) {
			logger.error({
				eventKey: "get_cluster_config_failed",
				errorKind: "unknown",
				error: error,
				message: "getClusterConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.Cluster}`)?.value
		}
	}

	/**
	 * @description 保存集群配置
	 */
	public async setClusterConfig(cluster: string): Promise<void> {
		this.cacheConfig(ConfigType.Cluster, cluster)
		try {
			const clusterConfig = await this.get(ConfigType.Cluster)
			await this.put({
				...clusterConfig,
				key: ConfigType.Cluster,
				value: cluster,
			})
		} catch (error) {
			logger.error({
				eventKey: "set_cluster_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setClusterConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
		}
	}

	/**
	 * @description 获取集群配置缓存
	 */
	public async getClusterCacheConfig(): Promise<string | undefined> {
		try {
			const config = await this.get(ConfigType.clusterCodeCache)
			return config?.value as string
		} catch (error) {
			logger.error({
				eventKey: "get_cluster_cache_config_failed",
				errorKind: "storage",
				error: error,
				message: "getClusterCacheConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.clusterCodeCache}`)
				?.value
		}
	}

	/**
	 * @description 保存集群配置缓存
	 */
	public async setClusterCacheConfig(cluster: string): Promise<void> {
		this.cacheConfig(ConfigType.clusterCodeCache, cluster)
		try {
			const clusterConfig = await this.get(ConfigType.clusterCodeCache)
			await this.put({
				...clusterConfig,
				key: ConfigType.clusterCodeCache,
				value: cluster,
			})
		} catch (error) {
			logger.error({
				eventKey: "set_cluster_cache_config_failed",
				errorKind: "storage",
				error: error,
				message: "setClusterCacheConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
		}
	}

	/**
	 * @description 获取字体缩放配置
	 */
	public async getFontScaleConfig(): Promise<number | undefined> {
		try {
			const config = await this.get(ConfigType.FontScale)
			return config?.value ? Number(config.value) : undefined
		} catch (error) {
			logger.error({
				eventKey: "get_font_scale_config_failed",
				errorKind: "unknown",
				error: error,
				message: "getFontScaleConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
			const cached = Storage.get(`${ConfigRepository.tableName}:${ConfigType.FontScale}`)
			return cached?.value ? Number(cached.value) : undefined
		}
	}

	/**
	 * @description 保存字体缩放配置
	 */
	public async setFontScaleConfig(scale: number): Promise<void> {
		this.cacheConfig(ConfigType.FontScale, scale.toString())
		try {
			const fontScaleConfig = await this.get(ConfigType.FontScale)
			await this.put({
				...fontScaleConfig,
				key: ConfigType.FontScale,
				value: scale.toString(),
			})
		} catch (error) {
			logger.error({
				eventKey: "set_font_scale_config_failed",
				errorKind: "unknown",
				error: error,
				message: "setFontScaleConfigError",
				context: { tableName: ConfigRepository.tableName },
			})
		}
	}

	/** Cache immediately; a slow IndexedDB write must not postpone reload recovery. */
	private cacheConfig(key: ConfigType, value: string): void {
		const storageKey = `${ConfigRepository.tableName}:${key}`
		Storage.set(storageKey, { ...Storage.get(storageKey), key, value })
	}
}
