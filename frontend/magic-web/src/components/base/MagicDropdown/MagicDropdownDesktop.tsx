import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuPortal,
} from "@/components/shadcn-ui/context-menu"
import { cn } from "@/lib/utils"
import { convertMenuItemsToComponents, convertPlacement } from "./utils"
import type { MagicDropdownProps } from "./types"
import { isUndefined } from "lodash-es"

/**
 * MagicDropdownDesktop - 桌面端下拉菜单实现
 * 基于 shadcn/ui DropdownMenu 封装，支持三种触发方式：
 * - click：点击触发（默认）
 * - hover：悬停触发
 * - contextMenu：右键触发，通过手动控制位置模拟原生右键菜单
 */
function MagicDropdownDesktop({
	menu,
	overlayClassName,
	overlayStyle,
	rootClassName,
	trigger = ["click"],
	placement,
	open,
	onOpenChange,
	onInteractOutside,
	onEscapeKeyDown,
	popupRender,
	getPopupContainer,
	disabled = false,
	children,
	model,
}: MagicDropdownProps) {
	// 判断当前触发方式
	const isContextMenu = useMemo(() => trigger?.includes("contextMenu"), [trigger])
	const isHover = useMemo(() => trigger?.includes("hover"), [trigger])

	// 悬停触发的开关状态及防抖定时器
	const [hoverOpen, setHoverOpen] = useState(false)
	const hoverTimeoutRef = useRef<NodeJS.Timeout>()

	const [contextMenuOpen, setContextMenuOpen] = useState(false)
	// 是否为受控模式（外部传入 open prop）
	const isOpenControlled = !isUndefined(open)

	// 将 placement 转换为 Radix UI 的 side / align 参数
	const { side, align } = useMemo(() => convertPlacement(placement), [placement])

	// 组件卸载时清理所有定时器，防止内存泄漏
	useEffect(() => {
		return () => {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current)
			}
		}
	}, [])

	// 鼠标进入：延迟 150ms 展开，避免快速划过时意外触发
	const handleMouseEnter = useCallback(() => {
		if (isHover && !disabled) {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current)
			}
			hoverTimeoutRef.current = setTimeout(() => {
				setHoverOpen(true)
			}, 150)
		}
	}, [isHover, disabled])

	// 鼠标离开：延迟 150ms 收起，给用户移入菜单内容的时间
	const handleMouseLeave = useCallback(() => {
		if (isHover) {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current)
			}
			hoverTimeoutRef.current = setTimeout(() => {
				setHoverOpen(false)
			}, 150)
		}
	}, [isHover])

	// 菜单开关变化处理
	const handleDropdownOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (isContextMenu && !isOpenControlled) {
				setContextMenuOpen(nextOpen)
			}
			onOpenChange?.(nextOpen)
		},
		[isContextMenu, isOpenControlled, onOpenChange],
	)

	// 合并各触发方式的 open 状态，统一传给 DropdownMenu
	const effectiveOpen = useMemo(() => {
		if (isHover) {
			// 悬停模式：内部 hover 状态与外部 open 取并集
			return hoverOpen || open
		}
		if (isContextMenu) {
			// 右键模式：受控时用外部 open，否则用内部状态
			return isOpenControlled ? open : contextMenuOpen
		}
		// 点击模式：保持 Radix 非受控行为（open 为 undefined 时）
		return open
	}, [isHover, hoverOpen, open, isContextMenu, isOpenControlled, contextMenuOpen])

	// 菜单内容区域的样式类名
	const contentClassName = useMemo(
		() =>
			cn(
				"rounded-[10px]",
				// 菜单项样式
				"[&_[data-slot=dropdown-menu-item]]:gap-1",
				"[&_[data-slot=dropdown-menu-item]]:rounded-[10px]",
				"[&_[data-slot=dropdown-menu-item]]:px-2",
				"[&_[data-slot=dropdown-menu-item]]:py-2.5",
				"[&_[data-slot=dropdown-menu-item]]:min-h-8",
				"[&_[data-slot=dropdown-menu-item]]:h-auto",
				"[&_[data-slot=dropdown-menu-item]]:w-full",
				"[&_[data-slot=dropdown-menu-item]:not([data-disabled])]:cursor-pointer",
				"[&_[data-slot=dropdown-menu-item]:hover]:!outline-none",
				"[&_[data-slot=dropdown-menu-item]:hover]:!bg-accent",
				// 子菜单触发项样式
				"[&_[data-slot=dropdown-menu-sub-trigger]]:gap-1",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:rounded-[10px]",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:px-2",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:py-2.5",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:min-h-8",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:h-auto",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:w-full",
				"[&_[data-slot=dropdown-menu-sub-trigger]:not([data-disabled])]:cursor-pointer",
				"[&_[data-slot=dropdown-menu-sub-trigger]:hover]:!outline-none",
				"[&_[data-slot=dropdown-menu-sub-trigger]:hover]:!bg-accent",
				// 子菜单内容区域样式
				"[&_[data-slot=dropdown-menu-sub-content]]:translate-x-2",
				"z-popup",
				overlayClassName,
				menu?.rootClassName,
			),
		[overlayClassName, menu?.rootClassName],
	)

	// 渲染菜单内容：优先使用自定义 popupRender，否则从 menu.items 转换
	const content = useMemo(() => {
		if (popupRender) {
			return popupRender(menu)
		}
		return convertMenuItemsToComponents(menu?.items, {
			onClick: menu?.onClick
				? (info) =>
					menu.onClick?.(
						info as unknown as Parameters<NonNullable<typeof menu.onClick>>[0],
					)
				: undefined,
			isContextMenu,
		})
	}, [popupRender, menu, isContextMenu])

	// 若传入 getPopupContainer，将容器传给 DropdownMenuContent 内部的 Portal（外层 Portal 无效，因 Content 内部另有 Portal 挂到 body）
	const dropdownContainer = getPopupContainer?.() ?? null
	const renderContextMenuWithPortal = useCallback(
		(contentNode: React.ReactNode, PortalComponent: typeof ContextMenuPortal) => {
			if (getPopupContainer) {
				return (
					<PortalComponent container={getPopupContainer()}>{contentNode}</PortalComponent>
				)
			}
			return contentNode
		},
		[getPopupContainer],
	)

	// 是否有可渲染的菜单项
	const hasMenuItems = useMemo(() => menu?.items && menu.items.length > 0, [menu?.items])

	// 根据触发方式渲染不同的触发器包装结构
	const triggerWrapper = useMemo(() => {
		if (isHover) {
			// 悬停触发：外层 span 监听鼠标事件，内部使用标准 Trigger
			return (
				<span
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					className="inline-flex"
				>
					<DropdownMenuTrigger asChild disabled={disabled} className={rootClassName}>
						{children}
					</DropdownMenuTrigger>
				</span>
			)
		}

		// 点击触发（默认）
		return (
			<DropdownMenuTrigger asChild disabled={disabled} className={rootClassName}>
				{children}
			</DropdownMenuTrigger>
		)
	}, [isHover, handleMouseEnter, handleMouseLeave, disabled, rootClassName, children])

	const contextTriggerWrapper = useMemo(() => {
		const triggerNode = <span className={cn("inline-flex", rootClassName)}>{children}</span>

		if (disabled) return triggerNode

		return <ContextMenuTrigger asChild>{triggerNode}</ContextMenuTrigger>
	}, [children, disabled, rootClassName])

	if (isContextMenu) {
		return (
			<ContextMenu
				open={effectiveOpen}
				onOpenChange={handleDropdownOpenChange}
				modal={isUndefined(model) ? true : model}
			>
				{contextTriggerWrapper}
				{(hasMenuItems || popupRender) &&
					renderContextMenuWithPortal(
						<ContextMenuContent
							className={contentClassName}
							style={overlayStyle}
							onInteractOutside={onInteractOutside}
							onEscapeKeyDown={onEscapeKeyDown}
						>
							{content}
						</ContextMenuContent>,
						ContextMenuPortal,
					)}
			</ContextMenu>
		)
	}

	return (
		<DropdownMenu
			open={effectiveOpen}
			onOpenChange={handleDropdownOpenChange}
			modal={isUndefined(model) ? isContextMenu : model}
		>
			{triggerWrapper}
			{(hasMenuItems || popupRender) && (
				<DropdownMenuContent
					container={dropdownContainer ?? undefined}
					side={side}
					align={align}
					className={contentClassName}
					style={overlayStyle}
					onInteractOutside={onInteractOutside}
					onEscapeKeyDown={onEscapeKeyDown}
					onMouseEnter={isHover ? handleMouseEnter : undefined}
					onMouseLeave={isHover ? handleMouseLeave : undefined}
				>
					{content}
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	)
}

// 使用 memo 包裹，避免父组件重渲染时不必要的更新
export default memo(MagicDropdownDesktop)
