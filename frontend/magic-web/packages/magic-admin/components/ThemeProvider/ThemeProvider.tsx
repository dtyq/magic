import type { PropsWithChildren } from "react"
import { memo, useCallback } from "react"
import { ThemeProvider } from "antd-style"
import type { ThemeAppearance } from "antd-style"
import type { CustomToken } from "./theme"
import { useAdminComponents } from "../AdminComponentsProvider"
import { genComponentTokenMap, genTokenMap } from "./tokenMap"
import { genPalettesConfigs } from "./utils"

export const CLASSNAME_PREFIX = "magic"

const MagicThemeProvider = memo((props: PropsWithChildren) => {
	const { children } = props

	const { theme: themeMode } = useAdminComponents()

	const themeConfig = useCallback((appearance: ThemeAppearance) => {
		const config = genPalettesConfigs(appearance)
		return {
			cssVar: {
				prefix: CLASSNAME_PREFIX,
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
			hashed: false,
		}
	}, [])

	return (
		<ThemeProvider<CustomToken>
			prefixCls={CLASSNAME_PREFIX}
			appearance={themeMode}
			themeMode={themeMode}
			theme={themeConfig}
		>
			{children}
		</ThemeProvider>
	)
})

export default MagicThemeProvider
