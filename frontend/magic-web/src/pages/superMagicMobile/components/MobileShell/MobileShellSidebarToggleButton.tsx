import { Menu, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"

import MobileShellIconButton from "./MobileShellIconButton"
import { useOptionalSuperMobileShellOutlet } from "./SuperMobileShellRouteLayout"

export interface MobileShellSidebarToggleButtonProps {
	testId: string
	/** `header` = mobile-page-header; `icon` = shell icon button; `floating` = My Crew / MagiClaw card pill. */
	variant?: "header" | "icon" | "floating"
	className?: string
	/** Used when the page renders outside `SuperMobileShellRouteLayout` (open-only). */
	onFallbackOpen?: () => void
}

/**
 * Prototype-aligned sidebar control: hamburger when closed, X when the drawer is open.
 */
export function MobileShellSidebarToggleButton({
	testId,
	variant = "header",
	className,
	onFallbackOpen,
}: MobileShellSidebarToggleButtonProps) {
	const { t } = useTranslation("super")
	const shell = useOptionalSuperMobileShellOutlet()
	const isSidebarOpen = shell?.isSidebarOpen ?? false

	/** Toggle when shell context exists; otherwise only open via parent fallback. */
	function handleClick() {
		if (!shell) {
			onFallbackOpen?.()
			return
		}

		if (isSidebarOpen) shell.closeSidebar()
		else shell.openSidebar()
	}

	const ariaLabel = isSidebarOpen ? t("mobile.shell.closeSidebar") : t("mobile.shell.menuAria")
	const Icon = isSidebarOpen ? X : Menu

	if (variant === "icon") {
		return (
			<MobileShellIconButton label={ariaLabel} onClick={handleClick} testId={testId}>
				<Icon size={22} className="text-foreground" aria-hidden />
			</MobileShellIconButton>
		)
	}

	if (variant === "floating") {
		return (
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={handleClick}
				className={cn(
					"h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70",
					className,
				)}
				aria-label={ariaLabel}
				data-testid={testId}
			>
				<Icon className="size-[22px] text-foreground" strokeWidth={2} aria-hidden />
			</Button>
		)
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn("mobile-page-header-btn transition-transform active:scale-95", className)}
			aria-label={ariaLabel}
			data-testid={testId}
		>
			<Icon className="size-[22px] text-foreground" aria-hidden />
		</button>
	)
}
