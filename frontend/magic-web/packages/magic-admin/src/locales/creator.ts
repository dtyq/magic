import i18n from "i18next"
import type { i18n as i18nType } from "i18next"
import { initReactI18next } from "react-i18next"
import resourcesToBackend from "i18next-resources-to-backend"

export enum Language {
	zhCN = "zh_CN",
	enUS = "en_US",
}

// 自动引入所有 json 文件
const zhCNModules = import.meta.glob("./zh_CN/**/*.json", { eager: true })
const enUSModules = import.meta.glob("./en_US/**/*.json", { eager: true })

// 从文件路径中提取命名空间
function extractNamespaces(modules: Record<string, any>): string[] {
	const namespaces = new Set<string>()

	Object.keys(modules).forEach((path) => {
		// 从路径中提取命名空间
		// 例如: ./zh_CN/ai/model.json -> ai/model
		const match = path.match(/\.\/[^/]+\/(.+)\.json$/)
		if (match) {
			namespaces.add(match[1])
		}
	})

	return Array.from(namespaces)
}

// 获取资源
function getResource(langModules: Record<string, any>, ns: string) {
	// ns 例子: user/profile
	// 文件路径例子: ./zh_CN/user/profile.json
	const path = Object.keys(langModules).find((key) => key.endsWith(`${ns}.json`))
	if (path) {
		return langModules[path].default
	}
	return {}
}

export const createI18nNext = (defaultLanguage: string): i18nType => {
	// 自动发现所有命名空间
	const zhCNNamespaces = extractNamespaces(zhCNModules)
	const enUSNamespaces = extractNamespaces(enUSModules)

	// 合并所有命名空间，确保两种语言都有相同的命名空间
	const allNamespaces = Array.from(new Set([...zhCNNamespaces, ...enUSNamespaces]))

	// 确保 common 命名空间在最前面
	const sortedNamespaces = allNamespaces.sort((a, b) => {
		if (a.includes("common")) return -1
		if (b.includes("common")) return 1
		return a.localeCompare(b)
	})

	i18n.use(initReactI18next).use(
		resourcesToBackend((language: string, namespace: string) => {
			if (language === Language.zhCN) {
				return Promise.resolve(getResource(zhCNModules, namespace))
			}
			if (language === Language.enUS) {
				return Promise.resolve(getResource(enUSModules, namespace))
			}
			return Promise.resolve({})
		}),
	)

	i18n.init({
		lng: defaultLanguage,
		fallbackLng: defaultLanguage,
		defaultNS: ["translation", "common"],
		ns: ["translation", ...sortedNamespaces],
	}).catch((error) => {
		console.log(error)
	})
	return i18n
}
