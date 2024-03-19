import { Tooltip } from "antd"
import type { HTMLAttributes } from "react"
import { useRef, useState } from "react"

export type MagicEllipseWithTooltipProps = HTMLAttributes<HTMLDivElement> & {
	text: string
	maxWidth: string // 文本最大宽度，超出部分用省略号代替
}

function MagicEllipseWithTooltip({ text, maxWidth, ...props }: MagicEllipseWithTooltipProps) {
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
		<Tooltip title={isOverflowed ? text : ""} placement="top" arrow>
			<div
				{...props}
				ref={textRef}
				style={{
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					maxWidth,
				}}
				onMouseEnter={checkOverflow}
			>
				{text}
			</div>
		</Tooltip>
	)
}

export default MagicEllipseWithTooltip
