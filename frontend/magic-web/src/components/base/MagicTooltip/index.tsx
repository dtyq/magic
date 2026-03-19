import { ReactElement, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useIsMobile } from "@/hooks/useIsMobile"

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
}: MagicTooltipProps) {
	const isMobile = useIsMobile()

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

	// 桌面端正常显示
	const container = getPopupContainer?.() ?? undefined
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} className="z-tooltip" container={container}>
				{title}
			</TooltipContent>
		</Tooltip>
	)
}

// 也可以导出为默认组件
export default MagicTooltip
