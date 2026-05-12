import { getLocalePreferredKeys } from "@/utils/locale"

export interface CrewPublishNameI18n {
	default?: string
	[key: string]: string | undefined
}

export function hasCrewPublishName(nameI18n: CrewPublishNameI18n | undefined, locale: string) {
	return resolveCrewPublishName(nameI18n, locale).trim().length > 0
}

function resolveCrewPublishName(nameI18n: CrewPublishNameI18n | undefined, locale: string) {
	if (!nameI18n) return ""

	const preferredKeys = getLocalePreferredKeys(locale)

	for (const key of preferredKeys) {
		const value = nameI18n[key]?.trim()
		if (value) return value
	}

	const defaultValue = nameI18n.default?.trim()
	if (defaultValue) return defaultValue

	return ""
}
