import type { RectangleElement } from "../../../../../canvas/types"

interface RectangleThumbnailProps {
	element: RectangleElement
}

const SIZE = 16
const PADDING = 2
const CONTENT_SIZE = SIZE - PADDING * 2

/**
 * 矩形缩略图组件
 */
export function RectangleThumbnail({ element }: RectangleThumbnailProps) {
	const fill = element.fill || "#969696"
	const stroke = element.stroke || "transparent"
	const strokeWidth = element.strokeWidth || 0
	const cornerRadius = element.cornerRadius || 0
	const opacity = element.opacity !== undefined ? element.opacity : 1

	// 根据实际宽高计算比例，保持宽高比
	const elementWidth = element.width || 100
	const elementHeight = element.height || 100
	const aspectRatio = elementWidth / elementHeight

	let displayWidth = CONTENT_SIZE
	let displayHeight = CONTENT_SIZE

	if (aspectRatio > 1) {
		// 宽度大于高度，以宽度为准
		displayHeight = CONTENT_SIZE / aspectRatio
	} else {
		// 高度大于宽度，以高度为准
		displayWidth = CONTENT_SIZE * aspectRatio
	}

	const offsetX = (CONTENT_SIZE - displayWidth) / 2 + PADDING
	const offsetY = (CONTENT_SIZE - displayHeight) / 2 + PADDING

	// 缩放圆角半径以适应缩略图
	const scaledCornerRadius = Math.min(
		cornerRadius *
			(Math.min(displayWidth, displayHeight) / Math.max(elementWidth, elementHeight)),
		2,
	)

	// 缩放描边宽度
	const scaledStrokeWidth = strokeWidth
		? Math.max(
				0.5,
				strokeWidth *
					(Math.min(displayWidth, displayHeight) / Math.max(elementWidth, elementHeight)),
			)
		: 0

	return (
		<svg
			width={SIZE}
			height={SIZE}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			style={{ display: "block", opacity }}
		>
			<rect
				x={offsetX}
				y={offsetY}
				width={displayWidth}
				height={displayHeight}
				rx={scaledCornerRadius}
				ry={scaledCornerRadius}
				fill={fill}
				stroke={stroke}
				strokeWidth={scaledStrokeWidth}
			/>
		</svg>
	)
}
