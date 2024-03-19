import { Tooltip } from "antd"
import { TooltipPlacement } from "antd/es/tooltip"
import type { HTMLAttributes } from "react"
import { useRef, useState } from "react"

interface EllipsisWithTooltipProps extends HTMLAttributes<HTMLDivElement> {
	text?: string
	maxWidth?: string // 文本最大宽度，超出部分用省略号代替
	placement?: TooltipPlacement
	popupContainer?: (trigger: HTMLElement) => HTMLElement
}

const MagicEllipseWithTooltip = ({
	text,
	maxWidth,
	placement = "top",
	popupContainer = (trigger: HTMLElement) => document.body,
	...props
}: EllipsisWithTooltipProps) => {
	const textRef = useRef<HTMLDivElement>(null)
	const [isOverflowed, setIsOverflowed] = useState(false)

	// 检测文本是否溢出
	const checkOverflow = () => {
		if (textRef.current) {
			const isOverflow = textRef.current.scrollWidth > textRef.current.clientWidth
			setIsOverflowed(isOverflow)
		}
	}

	return (
		<Tooltip
			title={isOverflowed ? text : ""}
			placement={placement}
			arrow
			getPopupContainer={popupContainer}
		>
			<div
				{...props}
				ref={textRef}
				style={{
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					...(maxWidth && { maxWidth }),
				}}
				onMouseEnter={checkOverflow}
			>
				{text}
			</div>
		</Tooltip>
	)
}

export default MagicEllipseWithTooltip
