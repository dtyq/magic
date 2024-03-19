import { Moon, Sun, SunMoon } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"
import { useTheme } from "@/opensource/models/config/hooks"
import type { ThemeMode } from "antd-style"
import { isDev } from "@/opensource/utils/env"
import { MagicTooltip } from "@/opensource/components/base"
import { useActionButtonsMenu } from "./useActionButtonsMenu"

interface ActionButtonsProps {
	collapsed: boolean
}

const THEME_CYCLE: ThemeMode[] = ["light", "dark", "auto"]

const THEME_ICON_MAP = {
	light: Sun,
	dark: Moon,
	auto: SunMoon,
}

function ActionButtons({ collapsed }: ActionButtonsProps) {
	const { t } = useTranslation("sidebar")
	const { theme, setTheme } = useTheme()

	function handleThemeToggle() {
		const currentIndex = THEME_CYCLE.indexOf(theme)
		const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
		setTheme(THEME_CYCLE[nextIndex])
	}

	const themeLabel = {
		light: t("footer.themeLight"),
		dark: t("footer.themeDark"),
		auto: t("footer.themeAuto"),
	}[theme]

	const ThemeIcon = THEME_ICON_MAP[theme] ?? Sun

	const actionItems = useActionButtonsMenu()

	return (
		<div
			className="flex w-full shrink-0 flex-col px-0 py-2"
			data-testid="sidebar-action-buttons"
		>
			<div className={cn("flex w-full shrink-0 flex-col gap-1", collapsed && "items-center")}>
				{actionItems.map((item) => {
					const Icon = item.icon
					return (
						<Button
							key={item.id}
							variant="ghost"
							size={collapsed ? "icon" : "sm"}
							data-testid={`sidebar-action-${item.id}`}
							className={cn(
								"h-8 shrink-0",
								collapsed ? "w-8" : "w-full justify-start px-2",
							)}
							onClick={item.onClick}
						>
							<Icon
								className={cn(
									"h-4 w-4 text-[#0a0a0a] dark:text-[#fafafa]",
									!collapsed && "mr-2",
								)}
							/>
							{!collapsed && (
								<span className="text-sm text-[#0a0a0a] dark:text-[#fafafa]">
									{t(item.label)}
								</span>
							)}
						</Button>
					)
				})}

				{isDev && (
					<MagicTooltip title="当前仅在开发环境开启">
						<Button
							variant="ghost"
							size={collapsed ? "icon" : "sm"}
							data-testid="sidebar-action-theme"
							className={cn(
								"h-8 shrink-0",
								collapsed ? "w-8" : "w-full justify-start px-2",
							)}
							onClick={handleThemeToggle}
						>
							<ThemeIcon
								className={cn(
									"h-4 w-4 text-[#0a0a0a] dark:text-[#fafafa]",
									!collapsed && "mr-2",
								)}
							/>
							{!collapsed && (
								<span className="text-sm text-[#0a0a0a] dark:text-[#fafafa]">
									{themeLabel}
								</span>
							)}
						</Button>
					</MagicTooltip>
				)}
			</div>
		</div>
	)
}

export default ActionButtons
