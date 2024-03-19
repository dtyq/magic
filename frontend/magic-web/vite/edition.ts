import type { UserConfig } from "vite"
import { getEnterpriseViteConfig } from "./config/enterprise"
import { getOpenSourceViteConfig } from "./config/opensource"

export const EDITION = {
	opensource: "opensource",
	enterprise: "enterprise",
} as const

export type EditionValue = (typeof EDITION)[keyof typeof EDITION]

export interface EditionConfig {
	currentEdition?: string
	resolvedEdition: EditionValue
	isEnterpriseEdition: boolean
	devServerPort: number
}

export function getEditionConfig(): EditionConfig {
	const currentEdition = process.env.EDITION
	const resolvedEdition =
		currentEdition === EDITION.enterprise ? EDITION.enterprise : EDITION.opensource

	return {
		currentEdition,
		resolvedEdition,
		isEnterpriseEdition: resolvedEdition === EDITION.enterprise,
		devServerPort: Number(process.env.PORT || 443),
	}
}

export function getViteEditionConfig({ projectRoot }: { projectRoot: string }): UserConfig {
	const editionConfig = getEditionConfig()
	if (editionConfig.isEnterpriseEdition)
		return getEnterpriseViteConfig({
			projectRoot,
			editionConfig,
		})

	return getOpenSourceViteConfig({
		projectRoot,
		editionConfig,
	})
}
