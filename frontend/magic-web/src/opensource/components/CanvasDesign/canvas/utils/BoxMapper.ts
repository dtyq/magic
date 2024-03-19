/**
 * BoxMapper - Konva Transformer Box 与 ContentLayer Rect 的坐标系转换
 *
 * 坐标系说明：
 * - KonvaBox：boundBoxFunc 收到的 { x, y, width, height }，来自 Transformer 内部计算
 *   - Transformer 在 controlsLayer，节点在 contentLayer，两者可能处于不同变换
 * - ContentRect：node.getClientRect({ relativeTo: contentLayer })，画布内容的逻辑坐标
 *   - 对齐检测、辅助线绘制均使用此坐标系
 *
 * 转换模型：content = konva * scale + offset
 * - 通过 (konvaBox, contentRect) 一对对应框校准
 * - 支持轴对齐的缩放和平移，不处理旋转
 */
export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

export interface Box {
	x: number
	y: number
	width: number
	height: number
	rotation?: number
}

/**
 * Konva Transformer Box <-> ContentLayer Rect 映射器
 */
export class BoxMapper {
	private scaleX = 1
	private scaleY = 1
	private offsetX = 0
	private offsetY = 0
	private calibrated = false

	/**
	 * 使用一对对应框校准映射
	 * @param konvaBox - Konva boundBoxFunc 的 box（同一选区的 Konva 表示）
	 * @param contentRect - 同一选区的节点 rect（getClientRect relativeTo contentLayer）
	 */
	calibrate(konvaBox: Box, contentRect: Rect): void {
		if (konvaBox.width !== 0 && konvaBox.height !== 0) {
			this.scaleX = contentRect.width / konvaBox.width
			this.scaleY = contentRect.height / konvaBox.height
		} else {
			this.scaleX = 1
			this.scaleY = 1
		}
		this.offsetX = contentRect.x - konvaBox.x * this.scaleX
		this.offsetY = contentRect.y - konvaBox.y * this.scaleY
		this.calibrated = true
	}

	/**
	 * Konva Box -> ContentLayer Rect
	 */
	konvaToContent(box: Box): Rect {
		return {
			x: box.x * this.scaleX + this.offsetX,
			y: box.y * this.scaleY + this.offsetY,
			width: box.width * this.scaleX,
			height: box.height * this.scaleY,
		}
	}

	/**
	 * ContentLayer Rect -> Konva Box
	 */
	contentToKonva(rect: Rect): Box {
		return {
			x: (rect.x - this.offsetX) / this.scaleX,
			y: (rect.y - this.offsetY) / this.scaleY,
			width: rect.width / this.scaleX,
			height: rect.height / this.scaleY,
		}
	}

	/**
	 * 应用 Konva 空间的 delta 到 Content 空间的 rect
	 * 用于计算 targetRect = currentContentRect + delta(konvaNewBox - konvaOldBox)
	 */
	applyKonvaDeltaToContent(
		contentRect: Rect,
		konvaDeltaX: number,
		konvaDeltaY: number,
		konvaDeltaW: number,
		konvaDeltaH: number,
	): Rect {
		return {
			x: contentRect.x + konvaDeltaX * this.scaleX,
			y: contentRect.y + konvaDeltaY * this.scaleY,
			width: contentRect.width + konvaDeltaW * this.scaleX,
			height: contentRect.height + konvaDeltaH * this.scaleY,
		}
	}

	isCalibrated(): boolean {
		return this.calibrated
	}
}
