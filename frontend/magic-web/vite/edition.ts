import type { UserConfig } from "vite"
import { getOpenSourceViteConfig } from "./config/opensource"

export const EDITION = {
	opensource: "opensource",
} as const

export type EditionValue = (typeof EDITION)[keyof typeof EDITION]

export interface EditionConfig {
	resolvedEdition: EditionValue
	devServerPort?: number
}

export function getEditionConfig(): EditionConfig {
	return {
		resolvedEdition: EDITION.opensource,
		devServerPort: process.env.PORT ? Number(process.env.PORT) : undefined,
	}
}

export function getViteEditionConfig({ projectRoot }: { projectRoot: string }): UserConfig {
	const editionConfig = getEditionConfig()

	return getOpenSourceViteConfig({
		projectRoot,
		editionConfig,
	})
}
