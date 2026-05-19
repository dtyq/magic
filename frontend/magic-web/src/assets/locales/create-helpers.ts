import { DEFAULT_LOCALE } from "@/constants/locale"
import { normalizeLocale } from "@/utils/locale"
import { isDev } from "@/utils/env"
import i18n, { type InitOptions } from "i18next"
import { initReactI18next } from "react-i18next"
import resourcesToBackend from "i18next-resources-to-backend"

export type ResourceLoader = () => Promise<unknown>
export type ResourceLoaderMap = Record<string, ResourceLoader>

interface ResourceModule {
	default?: unknown
}

interface AdminLocaleGroup {
	adminZhCNModules: ResourceLoaderMap
	adminEnUSModules: ResourceLoaderMap
}

const adminResourceCache: Partial<Record<string, Promise<unknown | null>>> = {}

function findNamespaceLoader(params: {
	langModules: ResourceLoaderMap
	namespace: string
}): ResourceLoader | null {
	const { langModules, namespace } = params
	const namespaceSuffix = `/${namespace}.json`
	for (const [path, loader] of Object.entries(langModules)) {
		if (path.endsWith(namespaceSuffix)) return loader
	}
	return null
}

export async function getAdminResource(params: {
	locale: string
	namespace: string
	langModules: ResourceLoaderMap
}): Promise<unknown | null> {
	const { locale, namespace, langModules } = params
	const cacheKey = `${locale}:${namespace}`
	if (adminResourceCache[cacheKey]) return adminResourceCache[cacheKey]

	adminResourceCache[cacheKey] = (async () => {
		const moduleLoader = findNamespaceLoader({ langModules, namespace })
		if (!moduleLoader) return null

		const module = await moduleLoader()
		const moduleObj = module as ResourceModule
		return moduleObj.default ?? module
	})()

	return adminResourceCache[cacheKey]
}

export function getAdminLangModules(params: {
	locale: string
	adminLocaleGroup: AdminLocaleGroup
}): ResourceLoaderMap | null {
	const { locale, adminLocaleGroup } = params
	const { adminZhCNModules, adminEnUSModules } = adminLocaleGroup
	if (locale === "zh_CN") return adminZhCNModules
	if (locale === "en_US") return adminEnUSModules
	return null
}

export async function getLocaleResource(params: {
	langModules: ResourceLoaderMap
	namespace: string
	locale: string
}): Promise<unknown | null> {
	const { langModules, namespace, locale } = params
	const expectedKey = `./${locale}/${namespace}.json`
	const moduleLoader = langModules[expectedKey]
	if (!moduleLoader) return null

	const module = await moduleLoader()
	return (module as ResourceModule).default
}

export function resolveFallbackLng(code?: string): string[] {
	const normalized = normalizeLocale(code)
	if (normalized === "en_US") return ["en_US"]
	if (normalized === "zh_CN") return ["zh_CN"]
	return [DEFAULT_LOCALE]
}

/** Adapter functions that locale-adapters.ts must provide. */
export interface LocaleAdapter {
	getLocaleModules(): {
		zhCNModules: ResourceLoaderMap
		enUSModules: ResourceLoaderMap
	}
	getAdminLocaleModules(): {
		adminZhCNModules: ResourceLoaderMap
		adminEnUSModules: ResourceLoaderMap
	}
	loadFallbackLocale(normalizedLng: string, namespace: string): Promise<unknown>
	loadMagicFlowLocale(normalizedLng: string, namespace: string): Promise<unknown>
}

export interface CreateI18nInstanceOptions {
	fallbackNS?: InitOptions["fallbackNS"]
}

/**
 * Shared factory: creates an i18nNext instance with the configured locale adapters.
 *
 * The backend callback dispatches namespaces as follows:
 * 1. magicFlow → loadMagicFlowLocale
 * 2. admin/*   → getAdminLocaleModules + getAdminResource
 * 3. any       → getLocaleModules (try merged base+enterprise globs)
 * 4. fallback  → loadFallbackLocale
 */
export function createI18nInstance(
	defaultLang: string | undefined,
	adapter: LocaleAdapter,
	options: CreateI18nInstanceOptions = {},
) {
	const { zhCNModules, enUSModules } = adapter.getLocaleModules()
	const { adminZhCNModules, adminEnUSModules } = adapter.getAdminLocaleModules()

	const instance = i18n.use(initReactI18next).use(
		resourcesToBackend(async (lng: string, namespace: string) => {
			const normalizedLng = normalizeLocale(lng)

			// 处理 magicFlow 命名空间
			if (namespace === "magicFlow") {
				return await adapter.loadMagicFlowLocale(normalizedLng, namespace)
			}

			// 处理 admin 相关命名空间
			if (namespace.startsWith("admin/")) {
				const adminLangModules = getAdminLangModules({
					locale: normalizedLng,
					adminLocaleGroup: { adminZhCNModules, adminEnUSModules },
				})
				if (!adminLangModules) return {}

				const resource = await getAdminResource({
					locale: normalizedLng,
					namespace,
					langModules: adminLangModules,
				})
				if (resource !== null) return resource

				if (isDev)
					console.warn(`[i18n] admin namespace not found: ${normalizedLng}/${namespace}`)
				return {}
			}

			// 优先从合并的 base+enterprise 模块加载
			if (normalizedLng === "zh_CN") {
				const resource = await getLocaleResource({
					langModules: zhCNModules,
					namespace,
					locale: normalizedLng,
				})
				if (resource) return resource
			}
			if (normalizedLng === "en_US") {
				const resource = await getLocaleResource({
					langModules: enUSModules,
					namespace,
					locale: normalizedLng,
				})
				if (resource) return resource
			}

			return await adapter.loadFallbackLocale(normalizedLng, namespace)
		}),
	)

	return {
		init: () => {
			return instance.init({
				lng: defaultLang,
				debug: isDev,
				// 有一些场景下，不是通过 useTranslation 来获取翻译，而是直接通过 i18n.t 来获取翻译
				// 默认加载一些全局通用命名空间，不需要手动加载；但适用于全局都用到的命名空间；独立模块的还是建议手动加载，或者使用 useTranslation 来获取翻译
				// 如果不配置的话，可能会出现第一次显示没有国际化，第二次加载的时候才显示正常
				ns: ["common", "shadcn-ui"],
				defaultNS: "common",
				...(options.fallbackNS === undefined ? {} : { fallbackNS: options.fallbackNS }),
				fallbackLng: resolveFallbackLng,
				interpolation: {
					// react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
					escapeValue: false,
				},
			})
		},
		instance,
	}
}
