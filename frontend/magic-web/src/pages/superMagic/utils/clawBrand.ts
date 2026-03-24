import { isInternationalEnv } from "@/utils/env"

const INTERNATIONAL_CLAW_BRAND = {
	clawBrand: "MagiClaw",
	clawLead: "Magi",
} as const satisfies Record<string, string>

const DOMESTIC_CLAW_BRAND = {
	clawBrand: "SuperClaw",
	clawLead: "Super",
} as const satisfies Record<string, string>

export function getClawBrandTranslationValues(): Record<string, string> {
	if (isInternationalEnv()) return INTERNATIONAL_CLAW_BRAND
	return DOMESTIC_CLAW_BRAND
}
