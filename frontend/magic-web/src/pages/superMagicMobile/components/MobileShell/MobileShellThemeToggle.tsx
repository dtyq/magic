import { Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MobileShellThemeToggleProps {
	disabled: boolean
	isDark: boolean
	onToggle: () => void
	labelSwitchToDark: string
	labelSwitchToLight: string
	testId?: string
	/** 追加到按钮根节点，用于侧栏底栏等小尺寸场景 */
	buttonClassName?: string
}

/** 业务无关的主题切换按钮（仅展示与无障碍） */
export function MobileShellThemeToggle({
	disabled,
	isDark,
	onToggle,
	labelSwitchToDark,
	labelSwitchToLight,
	testId = "mobile-shell-theme-toggle",
	buttonClassName,
}: MobileShellThemeToggleProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onToggle}
			aria-label={isDark ? labelSwitchToLight : labelSwitchToDark}
			data-testid={testId}
			className={cn(
				"dark:border-white/12 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-opacity",
				disabled ? "cursor-not-allowed opacity-50" : "active:scale-95",
				buttonClassName,
			)}
		>
			{isDark ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
		</button>
	)
}
