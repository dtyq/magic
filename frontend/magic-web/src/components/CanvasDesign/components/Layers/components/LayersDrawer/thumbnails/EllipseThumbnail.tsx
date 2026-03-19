import type { EllipseElement } from "../../../../../canvas/types"

interface EllipseThumbnailProps {
	element: EllipseElement
}

const SIZE = 16
const PADDING = 2
const CONTENT_SIZE = SIZE - PADDING * 2
const CENTER_X = SIZE / 2
const CENTER_Y = SIZE / 2

/**
 * 圆形缩略图组件
 */
export function EllipseThumbnail({ element }: EllipseThumbnailProps) {
	const fill = element.fill || "#969696"
	const stroke = element.stroke || "transparent"
	const strokeWidth = element.strokeWidth || 0
	const opacity = element.opacity !== undefined ? element.opacity : 1

	// 根据实际宽高计算比例，保持宽高比
	const elementWidth = element.width || 100
	const elementHeight = element.height || 100
	const radiusX = (CONTENT_SIZE / 2) * (elementWidth / Math.max(elementWidth, elementHeight))
	const radiusY = (CONTENT_SIZE / 2) * (elementHeight / Math.max(elementWidth, elementHeight))

	// 缩放描边宽度
	const scaledStrokeWidth = strokeWidth
		? Math.max(
				0.5,
				strokeWidth *
					(Math.min(radiusX, radiusY) / Math.max(elementWidth / 2, elementHeight / 2)),
			)
		: 0

	return (
		<svg
			width={SIZE}
			height={SIZE}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			style={{ display: "block", opacity }}
		>
			<ellipse
				cx={CENTER_X}
				cy={CENTER_Y}
				rx={radiusX}
				ry={radiusY}
				fill={fill}
				stroke={stroke}
				strokeWidth={scaledStrokeWidth}
			/>
		</svg>
	)
}
