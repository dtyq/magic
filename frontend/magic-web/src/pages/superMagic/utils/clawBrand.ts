import { i18nStore } from "@/models/config/stores/i18n.store"
import { isInternationalEnv } from "@/utils/env"

const INTERNATIONAL_CLAW_BRAND = {
	clawBrand: "MagiClaw",
	clawLead: "Magi",
} as const satisfies Record<string, string>

const DOMESTIC_CHINESE_CLAW_BRAND = {
	clawBrand: "超级龙虾",
	clawLead: "超级",
} as const satisfies Record<string, string>

const DOMESTIC_ENGLISH_CLAW_BRAND = {
	clawBrand: "SuperClaw",
	clawLead: "Super",
} as const satisfies Record<string, string>

export function resolveClawBrandTranslationValues({
	isInternational,
	language,
}: {
	isInternational: boolean
	language: string
}): Record<string, string> {
	if (isInternational) return INTERNATIONAL_CLAW_BRAND

	// Domestic Chinese uses the localized product name; English uses SuperClaw.
	return language.toLowerCase().startsWith("zh")
		? DOMESTIC_CHINESE_CLAW_BRAND
		: DOMESTIC_ENGLISH_CLAW_BRAND
}

export function getClawBrandTranslationValues(): Record<string, string> {
	return resolveClawBrandTranslationValues({
		isInternational: isInternationalEnv(),
		language: i18nStore.displayLanguage,
	})
}
