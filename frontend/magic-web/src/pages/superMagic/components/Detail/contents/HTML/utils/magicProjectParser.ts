import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"

export interface ParsedMagicProjectConfig {
	slides: string[]
	config: Record<string, any>
}

export function parseMagicProjectJsContent(content: string): ParsedMagicProjectConfig | null {
	if (!content) return null

	const config = parseMagicProjectConfigContent(content) as Record<string, any> | null
	if (!config) return null

	const slides = Array.isArray(config.slides)
		? config.slides.filter((slide): slide is string => typeof slide === "string")
		: []

	return { slides, config }
}
