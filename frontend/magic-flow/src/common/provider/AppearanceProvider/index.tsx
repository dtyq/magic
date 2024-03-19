import { i18n } from "i18next"
import type { PropsWithChildren } from "react"
import React from "react"
import { MagicFlowLocaleProvider } from "../LocaleProvider"
import ThemeProvider from "../ThemeProvider"

function AppearanceProvider({
	children,
	i18nInstance,
}: PropsWithChildren<{
	i18nInstance: i18n
}>) {
	return (
		<MagicFlowLocaleProvider i18nInstance={i18nInstance}>
			<ThemeProvider>{children}</ThemeProvider>
		</MagicFlowLocaleProvider>
	)
}

export default AppearanceProvider
