import pptxgen from "pptxgenjs"
import type { SlideConfig, Pptx } from "../types/index"

export function createPresentation(config: SlideConfig): Pptx {
	const pres = new pptxgen()
	pres.defineLayout({
		name: "CUSTOM_LAYOUT",
		width: config.slideWidth,
		height: config.slideHeight,
	})
	pres.layout = "CUSTOM_LAYOUT"
	return pres
}

export function ensureFileName(fileName: string): string {
	if (fileName.endsWith(".pptx")) return fileName
	return `${fileName}.pptx`
}
