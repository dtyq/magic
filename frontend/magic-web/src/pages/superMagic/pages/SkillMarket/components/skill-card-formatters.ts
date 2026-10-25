import { normalizeLocale } from "@/utils/locale"

export function formatSkillInstallCount(value: number | undefined, i18nLanguage: string) {
	if (typeof value !== "number" || !Number.isFinite(value)) return null
	const localeTag = normalizeLocale(i18nLanguage).replace("_", "-")
	try {
		return new Intl.NumberFormat(localeTag).format(value)
	} catch {
		return String(value)
	}
}
