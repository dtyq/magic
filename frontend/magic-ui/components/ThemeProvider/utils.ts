import type { ThemeAppearance } from "antd-style"
import {
	colorScales,
	colorUsages,
	darkColorScales,
	darkColorUsages,
} from "./colors"
import type {
	ColorScales,
	ColorUsages
} from "./types"

export const genPalettesConfigs = (
	themeAppearance: ThemeAppearance,
): { magicColorScales: ColorScales; magicColorUsages: ColorUsages } => {
	switch (themeAppearance) {
		case "dark":
			return {
				magicColorScales: darkColorScales,
				magicColorUsages: darkColorUsages,
			}
		case "light":
			return {
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
			}
		case "auto":
			const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
			return genPalettesConfigs(isDarkMode ? "dark" : "light")
		default:
			return {
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
			}
	}
}
