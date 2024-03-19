import type { ThemeAppearance } from "antd-style"
import { colorScales, colorUsages, darkColorScales, darkColorUsages } from "./colors"
import { genFontUsages } from "./font"
import type { ColorScales, ColorUsages, FontUsages } from "./types"

export const genPalettesConfigs = (
	themeAppearance: ThemeAppearance,
	fontScale: number = 1.1,
): {
	magicColorScales: ColorScales
	magicColorUsages: ColorUsages
	magicFontUsages: FontUsages
} => {
	switch (themeAppearance) {
		case "dark":
			return {
				magicColorScales: darkColorScales,
				magicColorUsages: darkColorUsages,
				magicFontUsages: genFontUsages(fontScale),
			}
		case "light":
			return {
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
				magicFontUsages: genFontUsages(fontScale),
			}
		case "auto":
			const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
			return genPalettesConfigs(isDarkMode ? "dark" : "light", fontScale)
		default:
			return {
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
				magicFontUsages: genFontUsages(fontScale),
			}
	}
}
