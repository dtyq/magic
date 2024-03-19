import type { PropsWithChildren } from "react"
import ThemeProvider from "../ThemeProvider"
import LocaleProvider from "./LocaleProvider"
import { useSafeArea } from "./hooks/useSafeArea"

const AppearanceProvider = ({ children }: PropsWithChildren) => {
	const magicSafeTokens = useSafeArea()

	return (
		<LocaleProvider>
			<ThemeProvider {...magicSafeTokens}>{children}</ThemeProvider>
		</LocaleProvider>
	)
}

export default AppearanceProvider
