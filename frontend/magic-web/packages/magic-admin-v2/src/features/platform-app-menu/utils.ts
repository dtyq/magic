import { Language } from "@magic-admin-v2/i18n/resources"
import {
	appMenuOpenMethod,
	type AppMenuItem,
	type AppMenuOpenMethod,
} from "./types"

export const APP_MENU_ALL_VALUE = "all"

export type AppMenuFilterDraft = {
	name: string
	status: string
}

export function createDefaultAppMenuFilterDraft(name = ""): AppMenuFilterDraft {
	return { name, status: APP_MENU_ALL_VALUE }
}

export function getAppMenuFilterActiveCount(filter: AppMenuFilterDraft) {
	return Number(Boolean(filter.name.trim())) + Number(filter.status !== APP_MENU_ALL_VALUE)
}

export function getMenuName(item: AppMenuItem, language: string) {
	if (language === Language.EnUS) {
		return item.name_i18n?.en_US || item.name_i18n?.zh_CN || item.id
	}
	return item.name_i18n?.zh_CN || item.name_i18n?.en_US || item.id
}

export function getOpenMethodLabel(value: AppMenuOpenMethod, t: (key: string) => string) {
	return value === appMenuOpenMethod.blank
		? t("appMenu.openMethod.blank")
		: t("appMenu.openMethod.self")
}

export function isValidAppMenuImageUrl(value: string) {
	const normalized = value.trim()
	return (
		normalized.startsWith("http://") ||
		normalized.startsWith("https://") ||
		normalized.startsWith("/")
	)
}

export function isSafeAppMenuImageUrl(value: string) {
	return isValidAppMenuImageUrl(value) || value.startsWith("blob:")
}
