import {
	Drawer,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
} from "@/opensource/components/shadcn-ui/drawer"
import { cn } from "@/opensource/lib/utils"
import * as React from "react"
import { memo, useEffect, useRef } from "react"
import { Drawer as DrawerPrimitive } from "vaul"

export type MagicPopupProps = React.ComponentProps<typeof Drawer> & {
	/** Whether the popup is visible (maps to open) */
	visible?: boolean
	/** Callback when the popup is closed (maps to onOpenChange) */
	onClose?: () => void
	/** Children to render inside the popup */
	children?: React.ReactNode
	/** Class name for the popup body (DrawerContent) */
	bodyClassName?: string
	/** Class name for the popup overlay */
	overlayClassName?: string
	/** Class name for the content wrapper */
	className?: string
	/** Class name for the handler */
	handlerClassName?: string
	/** Position of the popup (maps to direction) */
	position?: "bottom" | "top" | "left" | "right"
	/** Inline styles for the popup body */
	bodyStyle?: React.CSSProperties
	/** Inline styles for the content wrapper */
	style?: React.CSSProperties
	/** Z-index of the popup */
	zIndex?: number
	/** Container to render the popup into (antd-mobile compatible API) */
	getContainer?: HTMLElement | (() => HTMLElement)
	/** Optional title for accessibility (hidden by default) */
	title?: string
	/** Whether to destroy the content when closed (default: true) */
	destroyOnClose?: boolean
	/** Whether to close the popup when the mask is clicked (default: true) */
	maskClosable?: boolean
	/** Whether the popup can be dismissed by dragging or clicking outside (default: true) */
	dismissible?: boolean
}

const MagicPopup = memo(
	({
		visible,
		onClose,
		children,
		bodyClassName,
		overlayClassName,
		className,
		handlerClassName,
		position = "bottom",
		bodyStyle,
		style,
		zIndex,
		getContainer,
		title,
		destroyOnClose = true,
		maskClosable = true,
		...props
	}: MagicPopupProps) => {
		const { open, onOpenChange, direction, ...restProps } = props
		const hasBeenOpenedRef = useRef(false)

		const isOpen = visible ?? open

		// Track if the popup has ever been opened
		useEffect(() => {
			if (isOpen) {
				hasBeenOpenedRef.current = true
			}
		}, [isOpen])

		const handleOpenChange = (isOpen: boolean) => {
			onOpenChange?.(isOpen)
			if (!isOpen) {
				onClose?.()
			}
		}

		const container =
			typeof getContainer === "function" ? getContainer() : (getContainer ?? undefined)

		// Determine whether to render children
		const shouldRenderChildren = destroyOnClose ? isOpen : hasBeenOpenedRef.current || isOpen

		return (
			<Drawer
				open={isOpen}
				onOpenChange={handleOpenChange}
				direction={position ?? direction}
				dismissible={maskClosable}
				repositionInputs={false}
				{...restProps}
			>
				<DrawerPortal container={container}>
					<DrawerOverlay
						className={cn("z-popup bg-[rgba(22,22,26,0.6)]", overlayClassName)}
						style={{ zIndex }}
						onClick={(e) => {
							if (!maskClosable) {
								e.preventDefault()
								e.stopPropagation()
							}
						}}
					/>
					<DrawerPrimitive.Content
						data-slot="drawer-content"
						className={cn(
							"group/drawer-content fixed flex h-auto flex-col bg-background",
							"data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
							"data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
							"data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
							"data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
							"data-[data-vaul-drawer-direction=bottom]::after",
							"data-[vaul-drawer-direction=bottom]::after:bg-background",
							"overflow-hidden bg-background",
							"z-popup",
							"mt-safe-top pb-safe-bottom",
							"max-h-[calc(100%_-_var(--safe-area-inset-top)_-_var(--safe-area-inset-bottom)-44px)]",
							className,
						)}
						style={{
							zIndex,
							...style,
						}}
					>
						{/* Hidden title for accessibility */}
						<DrawerTitle className="sr-only">{title || "Dialog"}</DrawerTitle>
						{maskClosable && (
							<div
								className={cn(
									"mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block",
									handlerClassName,
								)}
							/>
						)}
						<div
							className={cn(
								"max-h-[calc(100vh_-_var(--safe-area-inset-top)_-_var(--safe-area-inset-bottom))] w-full overflow-auto outline-none",
								bodyClassName,
							)}
							style={bodyStyle}
						>
							{shouldRenderChildren && children}
						</div>
					</DrawerPrimitive.Content>
				</DrawerPortal>
			</Drawer>
		)
	},
)

MagicPopup.displayName = "MagicPopup"

export default MagicPopup
