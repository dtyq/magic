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
			logger.error("getThemeConfigError", ConfigRepository.tableName, error)
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.Theme}`)?.value
		}
	}

	/**
	 * @description 保存主题配置
	 */
	public async setThemeConfig(theme: ThemeMode): Promise<void> {
		try {
			const themeConfig = await this.get(ConfigType.Theme)
			this.put({
				...themeConfig,
				key: ConfigType.Theme,
				value: theme,
			})
		} catch (error) {
			logger.error("setThemeConfigError", ConfigRepository.tableName, error)
		} finally {
			const value = Storage.get(`${ConfigRepository.tableName}:${ConfigType.Theme}`)
			Storage.set(`${ConfigRepository.tableName}:${ConfigType.Theme}`, {
				...value,
				key: ConfigType.Theme,
				value: theme,
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
				logger.error("getLocaleConfigByAppSDKError", ConfigRepository.tableName, error)
			}
			const config = await this.get(ConfigType.I18n)
			return config?.value as string
		} catch (error) {
			logger.error("getLocaleConfigError", ConfigRepository.tableName, error)
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.I18n}`)?.value
		}
	}

	/**
	 * @description 保存国际化语言标识配置
	 */
	public async setLocaleConfig(locale: string): Promise<void> {
		try {
			const localeConfig = await this.get(ConfigType.I18n)
			this.put({
				...localeConfig,
				key: ConfigType.I18n,
				value: locale,
			})
		} catch (error) {
			logger.error("setLocaleConfigError", ConfigRepository.tableName, error)
		} finally {
			const value = Storage.get(`${ConfigRepository.tableName}:${ConfigType.I18n}`)
			Storage.set(`${ConfigRepository.tableName}:${ConfigType.I18n}`, {
				...value,
				key: ConfigType.I18n,
				value: locale,
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
			logger.error("getClusterConfigError", ConfigRepository.tableName, error)
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.Cluster}`)?.value
		}
	}

	/**
	 * @description 保存集群配置
	 */
	public async setClusterConfig(cluster: string): Promise<void> {
		try {
			const clusterConfig = await this.get(ConfigType.Cluster)
			this.put({
				...clusterConfig,
				key: ConfigType.Cluster,
				value: cluster,
			})
		} catch (error) {
			logger.error("setClusterConfigError", ConfigRepository.tableName, error)
		} finally {
			const value = Storage.get(`${ConfigRepository.tableName}:${ConfigType.Cluster}`)
			Storage.set(`${ConfigRepository.tableName}:${ConfigType.Cluster}`, {
				...value,
				key: ConfigType.Cluster,
				value: cluster,
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
			logger.error("getClusterCacheConfigError", ConfigRepository.tableName, error)
			return Storage.get(`${ConfigRepository.tableName}:${ConfigType.clusterCodeCache}`)
				?.value
		}
	}

	/**
	 * @description 保存集群配置缓存
	 */
	public async setClusterCacheConfig(cluster: string): Promise<void> {
		try {
			const clusterConfig = await this.get(ConfigType.clusterCodeCache)
			this.put({
				...clusterConfig,
				key: ConfigType.clusterCodeCache,
				value: cluster,
			})
		} catch (error) {
			logger.error("setClusterCacheConfigError", ConfigRepository.tableName, error)
		} finally {
			const value = Storage.get(
				`${ConfigRepository.tableName}:${ConfigType.clusterCodeCache}`,
			)
			Storage.set(`${ConfigRepository.tableName}:${ConfigType.clusterCodeCache}`, {
				...value,
				key: ConfigType.clusterCodeCache,
				value: cluster,
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
			logger.error("getFontScaleConfigError", ConfigRepository.tableName, error)
			const cached = Storage.get(`${ConfigRepository.tableName}:${ConfigType.FontScale}`)
			return cached?.value ? Number(cached.value) : undefined
		}
	}

	/**
	 * @description 保存字体缩放配置
	 */
	public async setFontScaleConfig(scale: number): Promise<void> {
		try {
			const fontScaleConfig = await this.get(ConfigType.FontScale)
			this.put({
				...fontScaleConfig,
				key: ConfigType.FontScale,
				value: scale.toString(),
			})
		} catch (error) {
			logger.error("setFontScaleConfigError", ConfigRepository.tableName, error)
		} finally {
			const value = Storage.get(`${ConfigRepository.tableName}:${ConfigType.FontScale}`)
			Storage.set(`${ConfigRepository.tableName}:${ConfigType.FontScale}`, {
				...value,
				key: ConfigType.FontScale,
				value: scale.toString(),
			})
		}
	}
}
