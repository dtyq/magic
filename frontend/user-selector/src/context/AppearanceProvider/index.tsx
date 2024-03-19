import { createContext, PropsWithChildren, useContext, useMemo } from "react"
import locales, { LocaleType } from "../../locales"

interface UserSelectorProviderProps {
	language?: LocaleType
	theme?: "light" | "dark"
}

const defaultLanguage = "zh_CN"
const defaultTheme = "light"

export interface AppearanceProviderContextType extends Required<UserSelectorProviderProps> {
	getLocale: () => (typeof locales)[LocaleType]["common"]
}

const context = createContext<AppearanceProviderContextType>({
	language: defaultLanguage,
	theme: defaultTheme,
	getLocale: () => {
		return locales[defaultLanguage]["common"]
	},
})

export const AppearanceProvider = (props: PropsWithChildren<UserSelectorProviderProps>) => {
	const { language, theme, children } = props

	const safeLanguage =
		language && Object.keys(locales).includes(language) ? language : defaultLanguage

	const currentTheme = theme ?? defaultTheme

	const value = useMemo(
		() => ({
			language: safeLanguage,
			theme: currentTheme,
			getLocale: () => {
				return locales[safeLanguage]["common"]
			},
		}),
		[safeLanguage, currentTheme],
	)

	return <context.Provider value={value}>{children}</context.Provider>
}

export const useAppearance = () => useContext(context)
