import type { NotificationTemplateCatalog } from "./types"

const VERSION = "v1"

function storageKey(locale: string) {
	return `notificationTemplates:${VERSION}:${locale}`
}

export function readTemplateCache(locale: string): NotificationTemplateCatalog | null {
	try {
		const raw = localStorage.getItem(storageKey(locale))
		if (!raw) return null
		const parsed = JSON.parse(raw) as NotificationTemplateCatalog
		if (!parsed?.templates || typeof parsed.catalog_version !== "number") return null
		return parsed
	} catch {
		return null
	}
}

export function writeTemplateCache(catalog: NotificationTemplateCatalog) {
	try {
		localStorage.setItem(storageKey(catalog.locale), JSON.stringify(catalog))
	} catch {
		// Private mode and quota errors are expected; in-memory catalog still works.
	}
}

export function notificationLocaleFromI18n(language?: string): "zh-CN" | "en-US" {
	return (language ?? "").toLowerCase().startsWith("en") ? "en-US" : "zh-CN"
}
