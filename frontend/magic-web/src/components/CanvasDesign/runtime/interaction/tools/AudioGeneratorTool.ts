import Konva from "konva"
import { BaseTool, type ToolMetadata, type ToolOptions } from "./BaseTool"
import { ElementTypeEnum, type AudioElement } from "../../document/types"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { AUDIO_CONFIG } from "../../elements/audio/AudioElement.config"
import { generateElementId } from "../../shared/ids"
import { resolveNearestFreeMediaPlacement } from "../../shared/placement/placementEngine"

export interface AudioGeneratorToolOptions extends ToolOptions {}

/** 在画布中创建可持久化的空音频节点，为后续上传或生成音频保留稳定 Content。 */
export class AudioGeneratorTool extends BaseTool {
	private clickHandler: ((event: Konva.KonvaEventObject<MouseEvent>) => void) | null = null

	public getMetadata(): ToolMetadata {
		return {
			name: "音频生成工具",
			description: "在画布上创建空音频节点",
			isTemporary: false,
			cursor: "crosshair",
		}
	}

	public activate(): void {
		this.isActive = true
		this.clickHandler = () => {
			const position = this.canvas.stage.getPointerPosition()
			if (!position) return

			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPosition = transform.point(position)
			this.createAudioElementAtCenter(canvasPosition.x, canvasPosition.y)
		}

		this.canvas.stage.on("click", this.clickHandler)
	}

	public deactivate(): void {
		this.isActive = false
		if (this.clickHandler) {
			this.canvas.stage.off("click", this.clickHandler)
			this.clickHandler = null
		}
	}

	public destroy(): void {
		this.deactivate()
	}

	/** 从工具栏在当前 viewport 附近创建空音频节点。 */
	public createAudioAtCenter(): void {
		const size = this.getAudioElementSize()
		const position = resolveNearestFreeMediaPlacement(this.canvas, size)

		this.createAudioElementAt(position.x, position.y)
	}

	public createAudioAtCanvasPoint(centerX: number, centerY: number): string {
		return this.createAudioElementAtCenter(centerX, centerY)
	}

	public getAudioElementSize(): { width: number; height: number } {
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Audio)
		return {
			width: Number(defaultConfig.width) || AUDIO_CONFIG.DEFAULT_WIDTH,
			height: Number(defaultConfig.height) || AUDIO_CONFIG.DEFAULT_HEIGHT,
		}
	}

	private createAudioElementAtCenter(centerX: number, centerY: number): string {
		const size = this.getAudioElementSize()
		return this.createAudioElementAt(centerX - size.width / 2, centerY - size.height / 2)
	}

	private createAudioElementAt(x: number, y: number): string {
		const size = this.getAudioElementSize()
		const elementId = generateElementId()
		const audioElement = ElementFactory.createElementData(
			ElementTypeEnum.Audio,
			elementId,
			x,
			y,
			size.width,
			size.height,
			this.canvas.elementManager.getNextZIndexInLevel(),
		) as AudioElement

		this.canvas.elementManager.create(audioElement)
		this.canvas.selectionManager.select(elementId)

		requestAnimationFrame(() => {
			if (this.canvas.viewportController.isElementInViewport([elementId])) return
			this.canvas.viewportController.moveElementToViewport([elementId], {
				animated: true,
				padding: { top: 50, right: 50, bottom: 50, left: 100 },
			})
		})

		this.onTaskComplete()
		return elementId
	}
}
