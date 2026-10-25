import { Language, type Language as LanguageCode } from "@magic-admin-v2/i18n/resources"

type MessageModule = {
	default: MessageCatalog
}

export type MessageValue = string | { [key: string]: MessageValue }
export type MessageNamespace = Record<string, MessageValue>
export type MessageCatalog = Record<string, MessageNamespace>

type LanguageLoaders = {
	base: () => Promise<MessageModule>
	edition: () => Promise<MessageModule>
}

const languageLoaders: Record<LanguageCode, LanguageLoaders> = {
	[Language.ZhCN]: {
		base: () => import("@magic-admin-v2/i18n/messages/base/zh_CN"),
		edition: () => import("@magic-admin-v2/i18n/messages/edition/zh_CN"),
	},
	[Language.EnUS]: {
		base: () => import("@magic-admin-v2/i18n/messages/base/en_US"),
		edition: () => import("@magic-admin-v2/i18n/messages/edition/en_US"),
	},
}

function loadDevelopmentMessages(language: LanguageCode): Array<Promise<MessageModule>> {
	if (language === Language.EnUS) {
		return [
			import("@magic-admin-v2/i18n/messages/development-base/en_US"),
			import("@magic-admin-v2/i18n/messages/development-edition/en_US"),
		]
	}

	return [
		import("@magic-admin-v2/i18n/messages/development-base/zh_CN"),
		import("@magic-admin-v2/i18n/messages/development-edition/zh_CN"),
	]
}

export async function loadMessages(language: LanguageCode, includeDevelopment: boolean) {
	const loaders = languageLoaders[language]
	const modulePromises = [loaders.base(), loaders.edition()]

	if (import.meta.env?.DEV && includeDevelopment) {
		modulePromises.push(...loadDevelopmentMessages(language))
	}

	const modules = await Promise.all(modulePromises)
	return mergeCatalogs(modules.map((module) => module.default))
}

function mergeCatalogs(catalogs: MessageCatalog[]): MessageCatalog {
	const result: MessageCatalog = {}

	for (const catalog of catalogs) {
		for (const [namespace, messages] of Object.entries(catalog)) {
			result[namespace] = {
				...result[namespace],
				...messages,
			}
		}
	}

	return result
}
