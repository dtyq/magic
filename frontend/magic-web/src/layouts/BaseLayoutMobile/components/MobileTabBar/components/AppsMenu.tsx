import { createElement, useEffect, useState } from "react"
import { Badge } from "@/components/shadcn-ui/badge"
import type {
	MobileTabBarItem,
	MobileTabBarMenuKey,
} from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig"
import { MOBILE_TAB_BAR_APPS_KEY } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig"
import { cn } from "@/lib/utils"
import { MobileTabBarKey } from "@/pages/mobileTabs/constants"

interface AppsMenuProps {
	open: boolean
	title: string
	items: MobileTabBarItem[]
	emptyText: string
	onClose: () => void
	onItemClick: (key: MobileTabBarKey) => void
}

const APPS_MENU_TRANSITION_MS = 220

export function AppsMenu({ open, title, items, emptyText, onClose, onItemClick }: AppsMenuProps) {
	const [shouldRender, setShouldRender] = useState(open)
	const [isVisible, setIsVisible] = useState(open)

	useEffect(() => {
		if (open) {
			setShouldRender(true)
			const frameId = window.requestAnimationFrame(() => {
				setIsVisible(true)
			})
			return () => window.cancelAnimationFrame(frameId)
		}

		setIsVisible(false)
		const timeoutId = window.setTimeout(() => {
			setShouldRender(false)
		}, APPS_MENU_TRANSITION_MS)

		return () => window.clearTimeout(timeoutId)
	}, [open])

	useEffect(() => {
		if (!shouldRender) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onClose, shouldRender])

	if (!shouldRender) return null

	const handleMenuItemClick = (key: MobileTabBarMenuKey) => {
		if (key === MOBILE_TAB_BAR_APPS_KEY) return
		onItemClick(key)
	}

	return (
		<>
			<button
				type="button"
				aria-label={title}
				data-testid="mobile-tab-bar-apps-menu-overlay"
				className={cn(
					"fixed inset-0 z-[1000] bg-black/50 transition-opacity duration-200 ease-out",
					isVisible ? "opacity-100" : "opacity-0",
				)}
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-label={title}
				data-testid="mobile-tab-bar-apps-menu"
				className={cn(
					"fixed left-1/2 z-[1001] w-[calc(100%-20px)] max-w-[355px] -translate-x-1/2 transition-all duration-200 ease-out will-change-transform",
					isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
				)}
				style={{
					bottom: "calc(max(var(--safe-area-inset-bottom), 12px) + var(--mobile-tabbar-height, 60px) + 4px)",
				}}
			>
				<div
					data-testid="mobile-tab-bar-apps-menu-content"
					className="overflow-hidden rounded-[14px] border border-border bg-secondary shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]"
					onClick={(event) => event.stopPropagation()}
				>
					<div className="flex flex-col gap-4 px-3 py-6">
						<div className="px-2">
							<p className="text-lg font-medium leading-5 text-foreground">{title}</p>
						</div>
						{items.length > 0 ? (
							<div className="grid grid-cols-3 gap-3">
								{items.map((item) => (
									<button
										key={item.key}
										type="button"
										aria-label={item.title}
										data-testid={`mobile-tab-bar-${item.testIdSuffix}-menu-item`}
										className={cn(
											"flex h-[50px] flex-col items-center justify-center gap-1 rounded-xl transition-colors",
											"hover:bg-background/60 active:bg-background/80",
										)}
										onClick={() => handleMenuItemClick(item.key)}
									>
										<div className="relative flex size-6 items-center justify-center">
											{createElement(item.iconComponent, {
												active: true,
												size: 24,
											})}
											{item.badge && item.badge > 0 ? (
												<Badge
													variant="destructive"
													className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-secondary px-1 text-[10px] font-normal leading-4"
												>
													{item.badge > 99 ? "99+" : item.badge}
												</Badge>
											) : null}
										</div>
										<span className="text-xs leading-4 text-foreground">
											{item.title}
										</span>
									</button>
								))}
							</div>
						) : (
							<div
								data-testid="mobile-tab-bar-apps-menu-empty"
								className="flex min-h-16 items-center justify-center px-2 text-sm text-muted-foreground"
							>
								{emptyText}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	)
}
