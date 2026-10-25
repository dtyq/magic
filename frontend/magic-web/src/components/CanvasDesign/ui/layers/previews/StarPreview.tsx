import type { StarElement } from "../../../runtime/document/types"
import { getActiveContent } from "../../../runtime/document/elementContent"

interface StarPreviewProps {
	element: StarElement
}

const SIZE = 16
const PADDING = 2
const CONTENT_SIZE = SIZE - PADDING * 2
const CENTER_X = SIZE / 2
const CENTER_Y = SIZE / 2

export function StarPreview({ element }: StarPreviewProps) {
	const content = getActiveContent(element)
	const fill = content?.fill || "#969696"
	const stroke = content?.stroke || "transparent"
	const strokeWidth = content?.strokeWidth || 0
	const sides = content?.sides || 5
	const innerRadiusRatio = content?.innerRadiusRatio || 0.4
	const opacity = element.opacity !== undefined ? element.opacity : 1

	// 根据实际宽高计算比例，保持宽高比
	const elementWidth = element.width || 100
	const elementHeight = element.height || 100
	const scale = Math.min(CONTENT_SIZE / elementWidth, CONTENT_SIZE / elementHeight)
	const outerRadius = (Math.min(elementWidth, elementHeight) / 2) * scale - 1
	const innerRadius = outerRadius * innerRadiusRatio

	// 计算星形的点坐标
	const points: string[] = []
	for (let i = 0; i < sides * 2; i++) {
		const angle = (i * Math.PI) / sides - Math.PI / 2 // 从顶部开始
		const radius = i % 2 === 0 ? outerRadius : innerRadius
		const x = CENTER_X + radius * Math.cos(angle)
		const y = CENTER_Y + radius * Math.sin(angle)
		points.push(`${x},${y}`)
	}

	// 缩放描边宽度
	const scaledStrokeWidth = strokeWidth ? Math.max(0.5, strokeWidth * scale) : 0

	// SVG 不支持 cornerRadius，但我们可以通过 clipPath 或其他方式模拟
	// 为了简化，这里先不实现 cornerRadius，因为 SVG polygon 不支持圆角
	// 如果需要，可以使用 path 元素来绘制带圆角的星形

	return (
		<svg
			width={SIZE}
			height={SIZE}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			style={{ display: "block", opacity }}
		>
			<polygon
				points={points.join(" ")}
				fill={fill}
				stroke={stroke}
				strokeWidth={scaledStrokeWidth}
			/>
		</svg>
	)
}
