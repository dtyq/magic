import {
	Drawer,
	DrawerHandle,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
} from "@/components/shadcn-ui/drawer"
import { cn } from "@/lib/utils"
import * as React from "react"
import { memo, useEffect, useRef } from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import type { OverlayZIndexScope } from "@/utils/overlayZIndex/overlayStackManager"
import { useIosBottomDrawerScrollLock } from "./useIosBottomDrawerScrollLock"

type MagicPopupHeaderActionTone = "primary" | "destructive" | "card"

interface MagicPopupHeaderActionConfig {
	icon: React.ReactNode
	ariaLabel: string
	onClick: () => void
	disabled?: boolean
	tone?: MagicPopupHeaderActionTone
	testId?: string
}

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
	/** Optional predefined header layout for mobile action sheets */
	headerVariant?: "actionHeader"
	/** Visible title rendered by the optional predefined header */
	headerTitle?: React.ReactNode
	/** Optional subtitle rendered below the predefined header title */
	headerSubtitle?: React.ReactNode
	/** Leading action rendered in the optional predefined header */
	headerLeadingAction?: MagicPopupHeaderActionConfig
	/** Trailing action rendered in the optional predefined header */
	headerTrailingAction?: MagicPopupHeaderActionConfig
	/** Whether to hide the default handle even when no predefined header is used */
	hideDefaultHandle?: boolean
	/** Position of the popup (maps to direction) */
	position?: "bottom" | "top" | "left" | "right"
	/** Inline styles for the popup body */
	bodyStyle?: React.CSSProperties
	/** Inline styles for the content wrapper */
	style?: React.CSSProperties
	/** Z-index of the popup */
	zIndex?: number
	/** Scope used by the global overlay stack manager */
	zIndexScope?: OverlayZIndexScope
	/** Whether this popup should participate in automatic z-index stacking */
	zIndexManaged?: boolean
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
	/** Whether to apply bottom safe area padding on the content wrapper (default: true) */
	withSafeBottom?: boolean
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
		headerVariant,
		headerTitle,
		headerSubtitle,
		headerLeadingAction,
		headerTrailingAction,
		hideDefaultHandle = false,
		position = "bottom",
		bodyStyle,
		style,
		zIndex,
		zIndexScope = "global",
		zIndexManaged = true,
		getContainer,
		title,
		destroyOnClose = true,
		maskClosable = true,
		withSafeBottom = true,
		...props
	}: MagicPopupProps) => {
		/** Vaul Drawer.Root 的 onAnimationEnd 参数为抽屉开关状态，与 DOM 的 AnimationEvent 不同。 */
		const {
			open,
			onOpenChange,
			direction,
			dismissible,
			handleOnly,
			onAnimationEnd: onDrawerAnimationEnd,
			...restProps
		} = props
		const hasBeenOpenedRef = useRef(false)
		const { contentStyle, handleContentRef } = useIosBottomDrawerScrollLock({
			position,
		})

		const isOpen = visible ?? open
		const overlayLayer = useOverlayZIndex({
			open: Boolean(isOpen),
			zIndex,
			zIndexScope,
			zIndexManaged,
		})

		/** 仅在 content 自身动画结束时处理；退场完成后释放层级，并转发 Vaul 的动画结束回调（布尔状态）。 */
		const handleContentAnimationEnd: React.AnimationEventHandler<HTMLDivElement> = (event) => {
			if (event.target !== event.currentTarget) {
				return
			}

			if (!isOpen) {
				overlayLayer.releaseOverlayZIndex()
			}

			onDrawerAnimationEnd?.(Boolean(isOpen))
		}

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
		const shouldUseActionHeader = headerVariant === "actionHeader"
		const drawerDismissible = dismissible ?? maskClosable
		const shouldEnableHandleDrag = position === "bottom" && drawerDismissible
		const drawerHandleOnly = handleOnly ?? shouldEnableHandleDrag
		const shouldShowDefaultHandle =
			drawerDismissible && !hideDefaultHandle && !shouldUseActionHeader

		// Determine whether to render children
		const shouldRenderChildren = destroyOnClose ? isOpen : hasBeenOpenedRef.current || isOpen

		/**
		 * 统一渲染移动端弹层头部操作按钮，避免业务层重复维护圆形按钮、阴影和禁用态。
		 */
		const renderHeaderActionButton = (
			action: MagicPopupHeaderActionConfig | undefined,
			position: "leading" | "trailing",
		) => {
			if (!action) {
				return null
			}

			const tone = action.tone ?? "card"
			const toneClassName =
				tone === "primary"
					? "bg-primary text-primary-foreground disabled:opacity-40"
					: tone === "destructive"
						? "bg-destructive text-white disabled:opacity-40"
						: "bg-card text-foreground active:bg-card/80"

			return (
				<button
					type="button"
					onClick={action.onClick}
					disabled={action.disabled}
					aria-label={action.ariaLabel}
					data-testid={action.testId}
					className={cn(
						"absolute top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full shadow-magic-floating-action transition-opacity disabled:pointer-events-none",
						position === "leading" ? "left-[10px]" : "right-[10px]",
						toneClassName,
					)}
				>
					{action.icon}
				</button>
			)
		}

		return (
			<Drawer
				open={isOpen}
				onOpenChange={handleOpenChange}
				direction={position ?? direction}
				dismissible={drawerDismissible}
				handleOnly={drawerHandleOnly}
				repositionInputs={false}
				{...restProps}
			>
				<DrawerPortal container={container}>
					<DrawerOverlay
						className={cn("z-popup bg-[rgba(22,22,26,0.6)]", overlayClassName)}
						style={{ zIndex: overlayLayer.overlayZIndex }}
						onClick={(e) => {
							if (!maskClosable) {
								e.preventDefault()
								e.stopPropagation()
							}
						}}
					/>
					<DrawerPrimitive.Content
						data-slot="drawer-content"
						ref={handleContentRef}
						aria-describedby={undefined}
						className={cn(
							"group/drawer-content fixed flex h-auto flex-col bg-background",
							"data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
							"data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
							"data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
							"data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
							"data-[vaul-drawer-direction=bottom]::after:bg-background",
							"overflow-hidden bg-background",
							"z-popup",
							"mt-safe-top",
							withSafeBottom && "pb-safe-bottom",
							"max-h-[calc(100%_-_var(--safe-area-inset-top)_-_var(--safe-area-inset-bottom)-44px)]",
							className,
						)}
						style={{
							zIndex: overlayLayer.contentZIndex,
							...style,
							...contentStyle,
						}}
						onAnimationEnd={handleContentAnimationEnd}
					>
						{/* Hidden title for accessibility */}
						<DrawerTitle className="sr-only">{title || "Dialog"}</DrawerTitle>
						{shouldShowDefaultHandle && (
							<div className="hidden w-full shrink-0 justify-center py-[6px] group-data-[vaul-drawer-direction=bottom]/drawer-content:flex">
								<DrawerHandle
									className={cn(
										"!h-1 !w-20 shrink-0 !rounded-full !bg-muted-foreground/40 !opacity-100 outline-none hover:!opacity-100 active:!opacity-100 [&>[data-vaul-handle-hitarea]]:h-6 [&>[data-vaul-handle-hitarea]]:w-24",
										handlerClassName,
									)}
								/>
							</div>
						)}
						{shouldUseActionHeader && (
							<div className="shrink-0">
								{/* 使用真实 Handle 让 vaul 的 handleOnly 只把拖拽关闭绑定到顶部手柄，避免内容区滚动误触关闭。 */}
								{shouldEnableHandleDrag && (
									<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
										<DrawerHandle className="!h-1 !w-20 shrink-0 !rounded-full !bg-muted-foreground/40 !opacity-100 outline-none hover:!opacity-100 active:!opacity-100 [&>[data-vaul-handle-hitarea]]:h-6 [&>[data-vaul-handle-hitarea]]:w-24" />
									</div>
								)}
								<div className="mobile-popup-action-header relative mb-3 flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
									{renderHeaderActionButton(headerLeadingAction, "leading")}
									<div className="flex min-w-0 flex-col items-center gap-0 text-center">
										<div className="max-w-[247px] truncate text-[18px] font-medium leading-6 text-foreground">
											{headerTitle}
										</div>
										{headerSubtitle ? (
											<div className="mt-0.5 max-w-[247px] truncate text-[12px] leading-4 text-muted-foreground">
												{headerSubtitle}
											</div>
										) : null}
									</div>
									{renderHeaderActionButton(headerTrailingAction, "trailing")}
								</div>
							</div>
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
