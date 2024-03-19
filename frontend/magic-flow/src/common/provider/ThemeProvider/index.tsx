// @ts-nocheck
import { CLASSNAME_PREFIX } from "@/common/const/style"
import { ConfigProvider } from "antd"
import React, { useMemo, type PropsWithChildren } from "react"
import BaseColorProvider from "../BaseColorProvider"
import { useGlobalThemeMode } from "./hooks"
import { genComponentTokenMap, genTokenMap } from "./tokenMap"
import { genPalettesConfigs } from "./utils"

function ThemeProvider({ children }: PropsWithChildren<{}>) {
	const { prefersColorScheme } = useGlobalThemeMode()

	const themeConfig = useMemo(() => {
		const appearance = prefersColorScheme
		const config = genPalettesConfigs(appearance)

		return {
			token: genTokenMap(config.magicColorScales, config.magicColorUsages, appearance),
			components: genComponentTokenMap(
				config.magicColorScales,
				config.magicColorUsages,
				appearance,
			),
		}
	}, [prefersColorScheme])

	return (
		<ConfigProvider
			prefixCls={CLASSNAME_PREFIX}
			config={{
				theme: themeConfig,
			}}
		>
			<BaseColorProvider>{children}</BaseColorProvider>
		</ConfigProvider>
	)
}

export default ThemeProvider
