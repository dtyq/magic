import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useRuntime } from "@magic-admin-v2/runtime/context"

export function ThemeSwitcher({ testId }: { testId?: string }) {
	const { t } = useTranslation()
	const { theme, setTheme } = useRuntime()
	const isDark = theme === "dark"

	return (
		<button
			data-testid={testId}
			aria-label={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
			className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			title={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
			type="button"
		>
			{isDark ? (
				<Sun className="size-4" aria-hidden="true" />
			) : (
				<Moon className="size-4" aria-hidden="true" />
			)}
		</button>
	)
}
