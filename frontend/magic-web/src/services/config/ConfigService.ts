import type { ThemeMode } from "antd-style"
import type { Common } from "@/types/common"
import type * as apis from "@/apis"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { ConfigRepository } from "@/models/config/repositories/ConfigRepository"
import { ClusterRepository } from "@/models/config/repositories/ClusterRepository"
import { configStore } from "@/models/config/stores"
import { isString } from "lodash-es"
import { BroadcastChannelSender } from "@/broadcastChannel"
import { Config } from "@/models/config/types"
import { SupportLocales } from "@/constants/locale"
import { env } from "@/utils/env"
import { normalizeLocale } from "@/utils/locale"
import { normalizeThemeMode } from "@/constants/theme"

/** Owns local preferences, cluster configuration, and edition-specific configuration reads. */
export class ConfigService {
	private readonly commonApi: typeof apis.CommonApi

	/** Bind the edition's API adapter without starting requests or restoring local preferences. */
	constructor(dependencies: Pick<typeof apis, "CommonApi">) {
		this.commonApi = dependencies.CommonApi
	}

	/**
	 * Restore URL and persisted language preferences before full configuration initialization.
	 * Waits for the i18n core and reads the same repository as init(); URL overrides win.
	 * Language synchronization failures propagate to the initialization owner.
	 */
	async hydrateLanguageEarly() {
		if (typeof window === "undefined") return

		await configStore.i18n.waitForI18nCoreReady()

		const temporaryLanguage = this.getTemporaryLanguageFromUrl()
		if (temporaryLanguage) {
			await configStore.i18n.setTemporaryLanguage(temporaryLanguage)
		}

		const config = new ConfigRepository()
		const locale = await config.getLocaleConfig()
		if (locale) {
			await configStore.i18n.syncLanguage(locale)
		}
	}

	/**
	 * Restore theme, font scale, and language preferences into memory.
	 * Missing preferences are persisted using the supplied defaults or current store values.
	 * @param options Defaults for preferences that have not been persisted yet.
	 * @returns Resolves after local configuration and language synchronization finish.
	 */
	async init(options: Config.InitializeGlobalConfig) {
		const config = new ConfigRepository()
		const defaultWrites: Promise<void>[] = []
		// Defaults use independent keys: apply them now, but preserve init's completion boundary.
		const saveDefault = (write: Promise<void>) => {
			defaultWrites.push(write.catch((error) => console.warn(error)))
		}
		const theme = await config.getThemeConfig()

		// Theme init: coerce to light while dark mode is disabled
		if (!theme) {
			const defaultTheme = normalizeThemeMode(configStore.theme.theme)
			const initial = options.initializeTheme
				? normalizeThemeMode(options.initializeTheme)
				: defaultTheme
			configStore.theme.setTheme(initial)
			saveDefault(config.setThemeConfig(initial))
		} else {
			const normalized = normalizeThemeMode(theme as ThemeMode)
			configStore.theme.setTheme(normalized)
			if (normalized !== theme) saveDefault(config.setThemeConfig(normalized))
		}

		// Restore the persisted font scale, or persist the current store default.
		const fontScale = await config.getFontScaleConfig()
		if (fontScale === undefined) {
			const defaultFontScale = configStore.font.fontScale
			saveDefault(config.setFontScaleConfig(defaultFontScale))
		} else {
			configStore.font.setFontScale(fontScale)
		}

		// Initialize language preferences after the i18n core becomes available.
		await configStore.i18n.waitForI18nCoreReady()

		const initialLanguage = configStore.i18n.language

		const temporaryLanguage = this.getTemporaryLanguageFromUrl()
		if (temporaryLanguage) {
			// Apply URL language before any persisted sync.
			await configStore.i18n.setTemporaryLanguage(temporaryLanguage)
		}

		const locale = await config.getLocaleConfig()

		if (!locale) {
			const defaultLocale = initialLanguage
			saveDefault(
				config.setLocaleConfig(
					options.initializeI18n || (defaultLocale as Config.LanguageValue),
				),
			)
			await configStore.i18n.syncLanguage(options.initializeI18n || defaultLocale)
		} else {
			await configStore.i18n.syncLanguage(locale)
		}
		await Promise.all(defaultWrites)
	}

	/**
	 * Read a supported temporary language from the lang or locale URL parameter.
	 * @returns The normalized locale, or null outside a browser or for invalid input.
	 */
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

	/**
	 * Restore local cluster identifiers and configuration, creating missing defaults.
	 * Refreshes the environment-defined SaaS entry before loading the available clusters.
	 */
	async initialCluster() {
		const config = new ConfigRepository()
		// Restore the active cluster and its most recently selected identifier.
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

		// Restore the available cluster definitions.
		const cluster = new ClusterRepository()

		// Refresh the SaaS definition from the current environment configuration.
		await cluster.setClusterConfig(this.envConfigToClusterConfig())

		const clustersConfig = await cluster.getClustersConfig()
		if (!clustersConfig) {
			const defaultClusterConfig = configStore.cluster.clusterConfig
			await cluster.setClustersConfig(Object.values(defaultClusterConfig))
		} else {
			configStore.cluster.setClustersConfig(clustersConfig)
		}
	}

	/** Build the default SaaS cluster definition from the configured service URLs. */
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
	 * Fetch language options and phone area codes through the injected edition API.
	 * Returns the response without changing the global store; request failures propagate.
	 * @param options Controls whether the request bypasses the application initialization gate.
	 */
	getInternationalizedSettings(options?: Pick<RequestConfig, "skipAppInitWait">) {
		return this.commonApi.getInternationalizedSettings(options)
	}

	/**
	 * Discover a private deployment through the injected edition API without changing local state.
	 * @param code Deployment or organization identifier understood by the API adapter.
	 */
	getPrivateConfigure(code: string) {
		return this.commonApi.getPrivateConfigure(code)
	}

	/**
	 * Fetch a non-null internationalization response, then apply its language options and phone area codes.
	 * Errors propagate unchanged so the initialization owner can report failures and retry.
	 * @param options Controls whether the request bypasses the application initialization gate.
	 * @returns Resolves after both configuration lists have been applied.
	 */
	loadConfig = async (options?: Pick<RequestConfig, "skipAppInitWait">) => {
		// Let the initialization owner report failures and decide when to retry.
		const response = await this.getInternationalizedSettings(options)
		if (response == null) throw new Error("Invalid internationalization settings response")
		configStore.i18n.setLanguages(response.languages)
		configStore.i18n.setAreaCodes(response.phone_area_codes)
	}

	/**
	 * Normalize the requested theme, start persisting it, and update the theme store.
	 * Synchronous failures are logged locally; persistence is not awaited here.
	 * @param theme Requested theme mode.
	 */
	setThemeConfig(theme: ThemeMode) {
		try {
			const normalized = normalizeThemeMode(theme)
			const config = new ConfigRepository()
			config.setThemeConfig(normalized)
			configStore.theme.setTheme(normalized)
		} catch (error) {
			console.error(error)
		}
	}

	/**
	 * Start persisting the font scale and update its in-memory value immediately.
	 * Synchronous failures are logged locally; persistence is not awaited here.
	 * @param scale Requested font scaling factor.
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
	 * Apply an explicit language choice and broadcast it to other application contexts.
	 * Persistence, i18n synchronization, and date-library updates run in the background.
	 * @param lang Requested persistent language; replaces any temporary language override.
	 */
	setLanguage(lang: Config.LanguageValue) {
		const hasTemporaryLanguage = Boolean(configStore.i18n.temporaryLanguage)

		if (!hasTemporaryLanguage && configStore.i18n.language === lang) {
			return
		}
		const config = new ConfigRepository()
		config.setLocaleConfig(lang).catch(console.error)
		void configStore.i18n.setLanguage(lang)
		BroadcastChannelSender.switchLanguage(lang)
		import("@/infrastructure/vendors/dayjs")
			.then((module) => {
				module.switchLanguage?.(lang)
			})
			.catch(console.error)
	}

	/**
	 * Update a cluster definition and the cached cluster selection without switching the active cluster.
	 * Updates memory first, then attempts persistence; persistence failures are logged and contained.
	 * @param clusterCode Identifier for the cluster definition and cached selection.
	 * @param clusterConfig Service endpoints and deployment metadata for the cluster.
	 */
	async setClusterConfig(
		clusterCode: string,
		clusterConfig: Common.PrivateConfig,
		options: { waitForPersistence?: boolean } = {},
	) {
		configStore.cluster.setClusterCodeCache(clusterCode)
		configStore.cluster.setClusterConfig(clusterCode, clusterConfig)

		try {
			// Persist the cluster definition and cached selection after updating memory.
			const cluster = new ClusterRepository()
			const config = new ConfigRepository()
			// Definitions and the remembered selection are independent writes, not a read-after-write chain.
			const persistence = Promise.all(
				[
					cluster.setClusterConfig({ ...clusterConfig, deployCode: clusterCode }),
					config.setClusterCacheConfig(clusterCode),
				].map((write) => write.catch((error) => console.warn(error))),
			)
			if (options.waitForPersistence === false) {
				// Read-only probes only need the in-memory configuration. Observe background failures.
				void persistence.catch((error) => console.warn(error))
				return
			}
			await persistence
		} catch (error) {
			console.warn(error)
		}
	}

	/**
	 * Switch the active cluster in memory, then attempt to persist its identifier.
	 * Persistence failures are logged and do not roll back the in-memory selection.
	 * @param clusterCode Identifier of the cluster to activate.
	 */
	async setClusterCode(clusterCode: string) {
		// Apply the active cluster before attempting persistence.
		configStore.cluster.setClusterCode(clusterCode)

		try {
			// Persist the active cluster identifier.
			const config = new ConfigRepository()
			await config.setClusterConfig(clusterCode)
		} catch (error) {
			console.warn(error)
		}
	}

	/**
	 * Cache a cluster selection in memory and attempt to persist it without activating it.
	 * Persistence failures are logged and do not roll back the cached selection.
	 * @param clusterCode Identifier to remember for a later cluster selection.
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
