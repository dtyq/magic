import type Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { IMAGE_CONFIG } from "../image/ImageElement.config"

/** 废稿只淡化图片内容节点；角标、控件和持久化透明度不受影响。 */
export class DiscardedImageDecorator {
	private readonly originalOpacity: number
	private readonly unsubscribe: () => void

	constructor(
		private readonly imageNode: Konva.Image,
		private readonly canvas: Canvas,
		private readonly elementId: string,
	) {
		this.originalOpacity = imageNode.opacity()
		this.updateOpacity()
		this.unsubscribe = canvas.eventEmitter.on("element:hover", () => this.updateOpacity())
	}

	private updateOpacity(): void {
		const hovered = this.canvas.hoverManager.getHoveredElementId() === this.elementId
		const opacity = this.originalOpacity * (hovered ? 1 : IMAGE_CONFIG.DISCARDED_OPACITY)
		if (this.imageNode.opacity() === opacity) return
		this.imageNode.opacity(opacity)
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "DiscardedImageDecorator",
			reason: "discarded-hover",
			priority: "input",
		})
	}

	public destroy(): void {
		this.unsubscribe()
		this.imageNode.opacity(this.originalOpacity)
	}
}
