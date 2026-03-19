import { ReactElement, ReactNode } from "react"
import MagicTooltip from "@/components/base/MagicTooltip"

interface SuperTooltipProps {
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
}

/**
 * SuperTooltip - 复用 MagicTooltip 的包装组件
 * @deprecated 请直接使用 MagicTooltip
 */
export const SuperTooltip = ({ title, placement = "top", children }: SuperTooltipProps) => {
	return (
		<MagicTooltip title={title} placement={placement}>
			{children}
		</MagicTooltip>
	)
}

// 也可以导出为默认组件
export default SuperTooltip
