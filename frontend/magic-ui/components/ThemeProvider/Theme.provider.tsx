import { createContext, useMemo } from "react"
import type { ThemeAppearance } from "antd-style"
import { ThemeProvider as AntdThemeProvider } from "antd-style"
import type { PropsWithChildren } from "react"
import { useMemoizedFn } from "ahooks"
import { genComponentTokenMap, genTokenMap } from "./tokenMap"
import { genPalettesConfigs } from "./utils"
import type { ColorScales, ColorUsages } from "./types"

export interface NewToken {
	/** 顶部菜单栏高度 */
	titleBarHeight?: number
	magicColorScales: ColorScales
	magicColorUsages: ColorUsages
}

interface ThemeContextState {
	theme: ThemeAppearance
	prefersColorScheme: ThemeAppearance
	setTheme: (theme: ThemeAppearance) => void
}

type Theme = "light" | "dark" | "auto"

const ThemeContext = createContext<ThemeContextState>({} as ThemeContextState)

function ThemeProvider({ children, theme }: PropsWithChildren & { theme: Theme }) {
	const prefersColorScheme = useMemo(() => {
		if (theme === "auto") {
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
		return theme
	}, [theme])

	const themeConfig = useMemoizedFn((appearance: ThemeAppearance) => {
		const config = genPalettesConfigs(appearance)
		return {
			cssVar: {
				prefix: "magic",
			},
			token: {
				...genTokenMap(config.magicColorScales, config.magicColorUsages, appearance),
				titleBarHeight: 44,
				magicColorScales: config.magicColorScales,
				magicColorUsages: config.magicColorUsages,
			},
			components: genComponentTokenMap(
				config.magicColorScales,
				config.magicColorUsages,
				appearance,
			),
		}
	})

	return (
		<ThemeContext.Consumer>
			{(store) => (
				<ThemeContext.Provider value={store}>
					<AntdThemeProvider<NewToken>
						prefixCls="magic"
						appearance={prefersColorScheme}
						themeMode={theme}
						theme={themeConfig}
					>
						{children}
					</AntdThemeProvider>
				</ThemeContext.Provider>
			)}
		</ThemeContext.Consumer>
	)
}

export default ThemeProvider
