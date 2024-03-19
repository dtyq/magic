import { useMemo } from "react"
import { useAppearanceStore } from "../AppearanceProvider/context"

export type ThemeMode = "light" | "dark" | "auto"

export const changeGlobalThemeMode = (mode: ThemeMode) =>
	useAppearanceStore.setState({
		theme: mode,
	})

export const useGlobalThemeMode = () => {
	const themeMode = useAppearanceStore((state) => state.theme)

	const prefersColorScheme = useMemo(() => {
		if (themeMode === "auto") {
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
		return themeMode
	}, [themeMode])

	const setThemeMode = changeGlobalThemeMode

	return { themeMode, prefersColorScheme, setThemeMode }
}
