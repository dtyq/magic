import { ThemeProvider, useTheme } from "antd-style"
import { useMemo, type PropsWithChildren } from "react"
import { genPalettesConfigs } from "@/providers/ThemeProvider/utils"

/** Standalone preview roots still need the palette used by their Magic controls. */
export default function PreviewThemeBoundary({ children }: PropsWithChildren) {
	const { magicColorScales, magicColorUsages, magicFontUsages, isDarkMode } = useTheme()
	const theme = useMemo(() => {
		const defaults = genPalettesConfigs(isDarkMode ? "dark" : "light")
		return {
			token: {
				magicColorScales: magicColorScales ?? defaults.magicColorScales,
				magicColorUsages: magicColorUsages ?? defaults.magicColorUsages,
				magicFontUsages: magicFontUsages ?? defaults.magicFontUsages,
			},
		}
	}, [isDarkMode, magicColorScales, magicColorUsages, magicFontUsages])

	// Preserve an existing provider, including any customer-specific overrides.
	if (magicColorScales && magicColorUsages) return children
	return (
		<ThemeProvider appearance={isDarkMode ? "dark" : "light"} theme={theme}>
			{children}
		</ThemeProvider>
	)
}
