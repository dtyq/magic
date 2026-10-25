export interface PlacementMathSize {
	width: number
	height: number
}

/** 计算批量节点的网格中心点。 */
export function resolveGridPlacements(
	dimensions: PlacementMathSize[],
	anchorPosition: { x: number; y: number },
	options: { spacing?: number; maxPerRow?: number } = {},
): Array<{ x: number; y: number }> {
	const spacing = options.spacing ?? 200
	const maxPerRow = Math.max(1, options.maxPerRow ?? 4)
	if (dimensions.length === 0) return []

	const first = dimensions[0]
	const startX = anchorPosition.x - first.width / 2
	const startY = anchorPosition.y - first.height / 2
	const positions: Array<{ x: number; y: number }> = []
	let currentY = startY

	for (let rowStart = 0; rowStart < dimensions.length; rowStart += maxPerRow) {
		let currentX = startX
		let rowMaxHeight = 0
		for (
			let index = rowStart;
			index < Math.min(rowStart + maxPerRow, dimensions.length);
			index += 1
		) {
			const size = dimensions[index]
			positions[index] = {
				x: currentX + size.width / 2,
				y: currentY + size.height / 2,
			}
			currentX += size.width + spacing
			rowMaxHeight = Math.max(rowMaxHeight, size.height)
		}
		currentY += rowMaxHeight + spacing
	}

	return positions
}

/** 计算同一批节点的水平中心点，顶部对齐。 */
export function resolveHorizontalPlacements(
	dimensions: PlacementMathSize[],
	anchorPosition: { x: number; y: number },
	spacing = 0,
): Array<{ x: number; y: number }> {
	if (dimensions.length === 0) return []

	const first = dimensions[0]
	const topY = anchorPosition.y - first.height / 2
	let currentLeft = anchorPosition.x - first.width / 2

	return dimensions.map((size) => {
		const position = {
			x: currentLeft + size.width / 2,
			y: topY + size.height / 2,
		}
		currentLeft += size.width + spacing
		return position
	})
}
