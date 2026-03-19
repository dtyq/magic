import { DEFAULT_LOCALE } from "@/constants/locale"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import resourcesToBackend from "i18next-resources-to-backend"
import { normalizeLocale } from "@/utils/locale"

// 自动引入所有嵌套的 json 文件 (懒加载模式)
const zhCNModules = import.meta.glob("./zh_CN/**/*.json")
const enUSModules = import.meta.glob("./en_US/**/*.json")

// 获取所有命名空间
const allNamespaces = Object.keys(zhCNModules)
	.map((key) => {
		const match = key.match(/[a-z]{2}_[A-Z]{2}\/(.+)\.json/)
		if (match) {
			return match[1]
		}
		return ""
	})
	.filter(Boolean)

// 从 @teamshare/magic-admin 包中导入国际化资源
const adminZhCNModules = import.meta.glob(
	"../../../../node_modules/@teamshare/magic-admin/dist/locales/zh_CN/**/*.json",
	{ eager: true },
)
const adminEnUSModules = import.meta.glob(
	"../../../../node_modules/@teamshare/magic-admin/dist/locales/en_US/**/*.json",
	{ eager: true },
)

// 提取 admin 命名空间
function extractAdminNamespaces() {
	const namespaces = new Set<string>()
	Object.keys(adminZhCNModules).forEach((path) => {
		// 例如: ../../../node_modules/@teamshare/magic-admin/dist/locales/zh_CN/admin/common.json
		// 提取: admin/common
		const match = path.match(/\/locales\/[^/]+\/(.+)\.json$/)
		if (match) {
			namespaces.add(match[1])
		}
	})
	return Array.from(namespaces)
}

// 获取 admin 资源
function getAdminResources(langModules: Record<string, unknown>) {
	const resources: Record<string, unknown> = {}
	Object.entries(langModules).forEach(([path, module]) => {
		const match = path.match(/\/locales\/[^/]+\/(.+)\.json$/)
		if (match) {
			const moduleObj = module as { default?: unknown }
			resources[match[1]] = moduleObj.default || module
		}
	})
	return resources
}

const adminNamespaces = extractAdminNamespaces()

async function getResource(
	langModules: Record<string, () => Promise<unknown>>,
	ns: string,
	locale: string,
) {
	const expectedKey = `./${locale}/${ns}.json`
	const moduleLoader = langModules[expectedKey]
	if (moduleLoader) {
		const module = await moduleLoader()
		return module.default
	}
	return null
}
/**
 * Creates an i18nNext instance with the specified default language.
 *
 * @param {string} [defaultLang] - The default language to be used.
 * @return {Object} An object containing the initialized i18nNext instance and an `init` function to initialize the instance.
 */
export function createI18nNext(defaultLang?: string) {
	const instance = i18n
		.use(initReactI18next)
		.use(LanguageDetector)
		.use(
			resourcesToBackend(async (lng: string, namespace: string) => {
				const normalizedLng = normalizeLocale(lng)

				// 处理 magicFlow 命名空间
				if (namespace === "magicFlow") {
					return import(
						`../../../../node_modules/@dtyq/magic-flow/dist/common/locales/${normalizedLng}/${namespace}.json`
					)
				}

				// 处理 admin 相关命名空间
				if (namespace.startsWith("admin/")) {
					if (normalizedLng === "zh_CN") {
						return getAdminResources(adminZhCNModules)[namespace]
					}
					if (normalizedLng === "en_US") {
						return getAdminResources(adminEnUSModules)[namespace]
					}
				}

				// 处理嵌套路径的情况 (例如 test/demo)
				if (namespace.includes("/")) {
					if (normalizedLng === "zh_CN") {
						const resource = await getResource(zhCNModules, namespace, normalizedLng)
						if (resource) {
							return resource
						}
					}
					if (normalizedLng === "en_US") {
						const resource = await getResource(enUSModules, namespace, normalizedLng)
						if (resource) {
							return resource
						}
					}
				}

				return import(`./${normalizedLng}/${namespace}.json`)
			}),
		)

	return {
		init: () => {
			return instance.init({
				defaultNS: ["translation", "common", "interface"],
				ns: [
					"translation",
					"common",
					"interface",
					"message",
					"flow",
					"magicFlow",
					"component",
					"tiptap",
					"marketing",
					"activation",
					"super",
					"crew/market",
					"crew/detail",
					"shadcn-ui",
					...adminNamespaces,
					...allNamespaces,
				],
				// the translations
				// (tip move them in a JSON file and import them,
				// or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
				lng: defaultLang, // if you're using a language detector, do not define the lng option
				fallbackLng: DEFAULT_LOCALE,
				interpolation: {
					escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
				},
			})
		},
		instance,
	}
}
