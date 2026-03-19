import { ThemeProvider as AntdThemeProvider } from "antd-style"
import { type PropsWithChildren, useCallback, useEffect, useLayoutEffect } from "react"
import { CLASSNAME_PREFIX } from "@/constants/style"
import { GlobalStyle } from "@/styles"
import { magic } from "@/enhance/magicElectron"
import { useTheme, useFontScale } from "@/models/config/hooks"
import { genComponentTokenMap, genTokenMap } from "./tokenMap"
import { genPalettesConfigs } from "./utils"
import type { NewToken } from "../../../../types/theme"
import { message } from "antd"
import { debounce } from "lodash-es"

message.config({
	duration: 3,
	maxCount: 3,
	rtl: false,
})

interface ThemeProviderProps extends Partial<NewToken> { }

function ThemeProvider({ children, ...tokens }: PropsWithChildren<ThemeProviderProps>) {
	const { theme, prefersColorScheme, setTheme } = useTheme()
	const { fontScale } = useFontScale()

	useLayoutEffect(() => {
		const unSubscribe = magic?.theme?.subscribe?.((themeConfig) => {
			setTheme?.(themeConfig)
		})
		return () => {
			unSubscribe?.()
		}
	}, [setTheme])

	useEffect(() => {
		const onWindowSizeChange = debounce(() => {
			message.config({ top: window.innerWidth <= 768 ? "10vh" : 30 })
		}, 500)
		onWindowSizeChange()
		window.addEventListener("resize", onWindowSizeChange)
		return () => {
			window.removeEventListener("resize", onWindowSizeChange)
		}
	}, [])

	// Sync Tailwind dark class with the resolved color scheme
	useEffect(() => {
		document.documentElement.classList.toggle("dark", prefersColorScheme === "dark")
	}, [prefersColorScheme])

	const themeConfig = useCallback(() => {
		const config = genPalettesConfigs(prefersColorScheme, fontScale)
		return {
			cssVar: {
				prefix: CLASSNAME_PREFIX,
			},
			token: {
				...genTokenMap(
					config.magicColorScales,
					config.magicColorUsages,
					prefersColorScheme,
				),
				// titleBarHeight: 48,
				titleBarHeight: 48,
				magicColorScales: config.magicColorScales,
				magicColorUsages: config.magicColorUsages,
				magicFontUsages: config.magicFontUsages,
				safeAreaInsetTop: "0px",
				safeAreaInsetBottom: "0px",
				safeAreaInsetLeft: "0px",
				safeAreaInsetRight: "0px",
				fontFamily: `Inter, "PingFang SC", -apple-system, "system-ui", "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`,
				...tokens,
			},
			components: genComponentTokenMap(
				config.magicColorScales,
				config.magicColorUsages,
				prefersColorScheme,
			),
		}
	}, [tokens, fontScale, prefersColorScheme])

	return (
		<AntdThemeProvider<NewToken>
			prefixCls={CLASSNAME_PREFIX}
			appearance={prefersColorScheme}
			themeMode={theme}
			theme={themeConfig}
		>
			<GlobalStyle />
			{children}
		</AntdThemeProvider>
	)
}

export default ThemeProvider
