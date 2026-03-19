import { memo } from "react"

export interface VerticalLineProps {
	/** 高度，可以是数字（px）或字符串（支持任何 CSS 单位） */
	height?: number | string
	/** 颜色，默认使用 currentColor */
	color?: string
	/** 额外的类名 */
	className?: string
	/** 不透明度 0-1 */
	opacity?: number
}

/**
 * VerticalLine - 垂直分隔线组件
 *
 * @example
 * // 基础用法
 * <VerticalLine height={24} />
 *
 * @example
 * // 自定义颜色和高度
 * <VerticalLine height={32} color="#666" />
 *
 * @example
 * // 使用百分比高度
 * <VerticalLine height="100%" color="red" />
 *
 * @example
 * // 配合 Tailwind
 * <VerticalLine height={24} className="text-muted-foreground" />
 */
const VerticalLine = memo(function VerticalLine({
	height = 24,
	color = "currentColor",
	className = "",
	opacity = 1,
}: VerticalLineProps) {
	const heightValue = typeof height === "number" ? `${height}px` : height

	return (
		<svg
			width="1"
			height={heightValue}
			viewBox={`0 0 1 ${typeof height === "number" ? height : 24}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			style={{ flexShrink: 0 }}
		>
			<line
				x1="0.5"
				y1="0"
				x2="0.5"
				y2={typeof height === "number" ? height : 24}
				stroke={color}
				strokeOpacity={opacity}
			/>
		</svg>
	)
})

export default VerticalLine
