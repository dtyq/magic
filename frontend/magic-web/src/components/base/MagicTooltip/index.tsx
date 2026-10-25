import {
	useEffect,
	useRef,
	useState,
	type FocusEvent,
	type ReactElement,
	type ReactNode,
} from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"

interface MagicTooltipProps {
	title?: ReactNode
	placement?:
		| "top"
		| "bottom"
		| "left"
		| "right"
		| "topLeft"
		| "topRight"
		| "bottomLeft"
		| "bottomRight"
		| "leftTop"
		| "leftBottom"
		| "rightTop"
		| "rightBottom"
	children: ReactElement
	/** 全屏等场景下将 Tooltip 挂载到指定容器内 */
	getPopupContainer?: () => HTMLElement | null
	/** Optional local layer class for editor-owned tooltips. */
	contentClassName?: string
	/** Explicit layer value for editor-owned tooltips. */
	contentZIndex?: number
	/** Distance between the trigger and tooltip content. */
	sideOffset?: number
	/** 覆盖这一条提示的悬停等待。未传时仍使用全局 700ms。 */
	delayDuration?: number
	/** Disable the tooltip while another menu or popover is open. */
	disabled?: boolean
}

/**
 * 全局 Tooltip 组件，自动处理移动端兼容性
 *
 * MagicTooltip 是一个跨平台的工具提示组件，基于 shadcn/ui 的 Tooltip 组件：
 * - 桌面端：显示工具提示
 * - 移动端：自动隐藏（不显示 Tooltip）
 *
 * @example
 * ```tsx
 * <MagicTooltip title="点击查看详情" placement="top">
 *   <button>详情</button>
 * </MagicTooltip>
 * ```
 */
export function MagicTooltip({
	title,
	placement = "top",
	children,
	getPopupContainer,
	contentClassName,
	contentZIndex,
	sideOffset = 4,
	delayDuration,
	disabled = false,
}: MagicTooltipProps) {
	const isMobile = useIsMobile()
	const [open, setOpen] = useState(false)
	const canOpenRef = useRef(false)

	useEffect(() => {
		if (disabled) {
			canOpenRef.current = false
			setOpen(false)
		}
	}, [disabled])

	// 菜单打开后使本次悬停失效；恢复可用时必须重新进入或聚焦，旧等待不能重新弹出提示。
	/** Allow hover to start the delay; click-focus must not reuse this grant. */
	function handlePointerEnter() {
		canOpenRef.current = !disabled
	}

	/** Hide on press so the focus that follows a pointer click cannot flash the tip. */
	function handlePointerDown() {
		canOpenRef.current = false
		setOpen(false)
	}

	/** Keyboard-only: click-induced focus is not :focus-visible and must not enable the tip. */
	function handleFocus(event: FocusEvent<HTMLElement>) {
		if (!event.currentTarget.matches(":focus-visible")) return
		canOpenRef.current = !disabled
	}

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen && !disabled && canOpenRef.current)
	}

	// 移动端不显示 Tooltip
	if (isMobile || !title) {
		return children
	}

	// 将 antd 的 placement 转换为 shadcn 的 side
	const side = placement.startsWith("top")
		? "top"
		: placement.startsWith("bottom")
			? "bottom"
			: placement.startsWith("left")
				? "left"
				: "right"
	const align = /Left$|Top$/.test(placement)
		? "start"
		: /Right$|Bottom$/.test(placement)
			? "end"
			: "center"

	// 桌面端正常显示
	const container = getPopupContainer?.() ?? undefined
	return (
		<Tooltip
			open={open && !disabled}
			onOpenChange={handleOpenChange}
			delayDuration={delayDuration}
		>
			<TooltipTrigger
				asChild
				onPointerEnter={handlePointerEnter}
				onPointerDown={handlePointerDown}
				onFocus={handleFocus}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent
				side={side}
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-tooltip max-w-[min(20rem,var(--radix-tooltip-content-available-width,100vw))] whitespace-normal text-wrap break-words",
					contentClassName,
				)}
				container={container}
				zIndex={contentZIndex}
			>
				{title}
			</TooltipContent>
		</Tooltip>
	)
}

// 也可以导出为默认组件
export default MagicTooltip
