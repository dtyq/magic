export interface ParsedMagicProjectConfig {
	slides: string[]
	config: Record<string, any>
}

export function parseMagicProjectJsContent(content: string): ParsedMagicProjectConfig | null {
	if (!content) return null

	try {
		const tempWindow: {
			magicProjectConfig?: Record<string, any>
			magicProjectConfigure?: (config: Record<string, any>) => void
		} = {
			magicProjectConfigure: () => undefined,
		}

		const func = new Function("window", content)
		func(tempWindow)

		const config = tempWindow.magicProjectConfig
		if (!config || typeof config !== "object") return null

		const slides = Array.isArray(config.slides)
			? config.slides.filter((slide): slide is string => typeof slide === "string")
			: []

		return { slides, config }
	} catch (error) {
		console.error("Failed to parse magic.project.js content:", error)
		return null
	}
}
