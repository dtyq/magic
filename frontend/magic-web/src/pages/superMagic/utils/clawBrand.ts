const INTERNATIONAL_CLAW_BRAND = {
	clawBrand: "MagiClaw",
	clawLead: "Magi",
} as const satisfies Record<string, string>

export function getClawBrandTranslationValues(): Record<string, string> {
	return INTERNATIONAL_CLAW_BRAND
}
