import * as React from "react"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"

export function ThemeToggle() {
	const [isDarkMode, setIsDarkMode] = React.useState<boolean>(false)

	React.useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
		const handleChange = () => setIsDarkMode(mediaQuery.matches)
		mediaQuery.addEventListener("change", handleChange)
		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [])

	React.useEffect(() => {
		const initialDarkMode =
			!!document.querySelector('meta[name="color-scheme"][content="dark"]') ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		setIsDarkMode(initialDarkMode)
	}, [])

	React.useEffect(() => {
		document.documentElement.classList.toggle("dark", isDarkMode)
	}, [isDarkMode])

	const toggleDarkMode = () => setIsDarkMode((isDark) => !isDark)

	return (
		<Button
			onClick={toggleDarkMode}
			aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
			data-style="ghost"
		>
			{isDarkMode ? (
				<MoonStarIcon className="tiptap-button-icon" />
			) : (
				<SunIcon className="tiptap-button-icon" />
			)}
		</Button>
	)
}
