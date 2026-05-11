import Konva from "konva"

/**
 * Lucide `play` 图标路径（与 lucide-react play 一致，见 demo.svg），24×24 viewBox。
 * 描边版用 stroke；此处仅作 `fill` 实心。
 */
export const LUCIDE_PLAY_VIEWBOX = "0 0 24 24" as const

export const LUCIDE_PLAY_VIEWBOX_SIZE = 24

export const LUCIDE_PLAY_SOLID_PATH_D =
	"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"

/** 暂停条 SVG 归一化 viewBox（与 getVideoPauseBarRectsNormalized 一致） */
export const VIDEO_PAUSE_ICON_VIEWBOX = "0 0 100 100" as const

/**
 * 将 Lucide play 实心路径置于 (centerX, centerY)，缩放为约 iconSize（相对 24 基准边长）。
 */
export function layoutLucideSolidPlayPath(
	path: Konva.Path,
	centerX: number,
	centerY: number,
	iconSize: number,
): void {
	const s = iconSize / LUCIDE_PLAY_VIEWBOX_SIZE
	path.data(LUCIDE_PLAY_SOLID_PATH_D)
	path.offsetX(12)
	path.offsetY(12)
	path.x(centerX)
	path.y(centerY)
	path.scaleX(s)
	path.scaleY(s)
}

/** 与 VideoRenderer.updatePauseBarsLayout 一致，坐标为左上 + 尺寸（用于 SVG rect） */
export function getVideoPauseBarRectsForIcon(
	iconSize: number,
	centerX: number,
	centerY: number,
): { x: number; y: number; width: number; height: number; rx: number }[] {
	const barWidth = Math.max(3, iconSize * 0.18)
	const barHeight = iconSize * 0.72
	const gap = iconSize * 0.18
	const topY = centerY - barHeight / 2
	const rx = barWidth / 2
	return [
		{
			x: centerX - gap / 2 - barWidth,
			y: topY,
			width: barWidth,
			height: barHeight,
			rx,
		},
		{
			x: centerX + gap / 2,
			y: topY,
			width: barWidth,
			height: barHeight,
			rx,
		},
	]
}

/** 100×100 归一化 viewBox 下的暂停双竖条 rect，供 React 图标与 Konva 对齐 */
export function getVideoPauseBarRectsNormalized(): {
	x: number
	y: number
	width: number
	height: number
	rx: number
}[] {
	return getVideoPauseBarRectsForIcon(100, 50, 50)
}
