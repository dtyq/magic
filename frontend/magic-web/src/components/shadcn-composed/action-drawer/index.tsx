import { memo, useCallback, useMemo } from "react"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import { Drawer as DrawerPrimitive } from "vaul"

import {
	Drawer,
	DrawerHeader,
	DrawerTitle,
	DrawerDescription,
	DrawerFooter,
	DrawerPortal,
	DrawerOverlay,
} from "@/components/shadcn-ui/drawer"
import type { ActionDrawerProps } from "./types"
import { Button } from "@/components/shadcn-ui/button"

/**
 * ActionDrawer - Generic two-level action drawer component
 * Uses Drawer on mobile and Dialog on desktop
 */
function ActionDrawerComponent(props: ActionDrawerProps) {
	const { t } = useTranslation()
	const {
		open,
		onOpenChange,
		title,
		children,
		showCancel = true,
		cancelText = t("shadcn-ui:actionDrawer.cancel"),
		onCancel,
		onConfirm,
		confirmText = t("shadcn-ui:actionDrawer.confirm"),
		className,
		contentClassName,
	} = props

	// Handle cancel action
	const handleCancel = useCallback(() => {
		onCancel?.()
		onOpenChange(false)
	}, [onCancel, onOpenChange])

	// Handle close action
	const handleClose = useCallback(() => {
		onOpenChange(false)
	}, [onOpenChange])

	// Handle confirm action
	const handleConfirm = useCallback(() => {
		onConfirm?.()
		onOpenChange(false)
	}, [onConfirm, onOpenChange])

	// Render footer - supports cancel-only or cancel+confirm layout
	const renderFooter = useMemo(() => {
		const hasConfirm = !!onConfirm
		if (!showCancel && !hasConfirm) return null

		return (
			<div className="flex gap-1.5">
				{showCancel && (
					<Button
						variant="outline"
						className={cn("h-9", hasConfirm ? "flex-[30%] shrink-0" : "flex-1")}
						onClick={handleCancel}
					>
						{cancelText}
					</Button>
				)}
				{hasConfirm && (
					<Button
						className={cn("h-9", showCancel ? "flex-[70%] shrink-0" : "flex-1")}
						onClick={handleConfirm}
					>
						{confirmText}
					</Button>
				)}
			</div>
		)
	}, [showCancel, cancelText, handleCancel, onConfirm, confirmText, handleConfirm])

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerPortal data-slot="drawer-portal">
				<DrawerOverlay className="z-drawer bg-[rgba(22,22,26,0.6)]" />
				<DrawerPrimitive.Content
					data-slot="drawer-content"
					className={cn(
						"group/drawer-content fixed z-drawer flex h-auto flex-col bg-background",
						"data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80dvh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
						"data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80dvh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
						"data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
						"data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
						"[&[data-vaul-drawer-direction]>div:first-child]:!hidden",
						"z-drawer mx-[14px] mb-[34px] flex max-h-[85dvh] flex-col overflow-hidden rounded-[14px] border-border bg-secondary",
						"shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]",
						"after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0",
						"after:h-[calc(env(safe-area-inset-bottom)+34px)] after:translate-y-full",
						className,
					)}
				>
					<div className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
					{/* Header */}
					{title ? (
						<DrawerHeader className="h-11 shrink-0 flex-row items-center justify-between gap-1.5 px-3 py-0">
							<DrawerTitle className="flex-1 truncate text-left text-sm font-medium leading-none text-foreground">
								{title}
							</DrawerTitle>
							<DrawerDescription className="sr-only">{title}</DrawerDescription>
							<Button
								variant="ghost"
								size="icon-sm"
								className="shrink-0"
								onClick={handleClose}
							>
								<XIcon className="size-4" />
								<span className="sr-only">{t("shadcn-ui:actionDrawer.close")}</span>
							</Button>
						</DrawerHeader>
					) : null}

					{/* Content - Scrollable area */}
					<div
						className={cn(
							"scrollbar-y-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3",
							!title ? "pt-3" : "",
							contentClassName,
						)}
					>
						{children}
					</div>

					{/* Footer */}
					{renderFooter ? (
						<DrawerFooter className="shrink-0 px-3 pt-0">{renderFooter}</DrawerFooter>
					) : null}
				</DrawerPrimitive.Content>
			</DrawerPortal>
		</Drawer>
	)
}

ActionDrawerComponent.displayName = "ActionDrawer"

// Export memoized component
export const ActionDrawer = memo(ActionDrawerComponent)

// Export sub-components
export { ActionGroup } from "./action-group"
export { ActionItem } from "./action-item"

// Export types
export type { ActionDrawerProps, ActionGroupProps, ActionItemProps } from "./types"
export type { ActionDrawer as ActionDrawerNamespace } from "./types"
