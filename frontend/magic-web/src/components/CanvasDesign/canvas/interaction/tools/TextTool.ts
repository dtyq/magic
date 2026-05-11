import Konva from "konva"
import { BaseTool, type ToolOptions } from "./BaseTool"

export interface TextToolOptions extends ToolOptions {}

export class TextTool extends BaseTool {
	constructor(options: TextToolOptions) {
		super(options)
	}

	public activate(): void {
		this.isActive = true
		this.canvas.stage.on("click", this.handleStageClick)
	}

	public deactivate(): void {
		this.isActive = false
		this.canvas.stage.off("click", this.handleStageClick)
	}

	private handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		if (this.canvas.textEditingManager.isEditing()) {
			return
		}

		if (e.target !== this.canvas.stage) {
			return
		}

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) {
			return
		}

		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasPos = transform.point(pos)

		this.canvas.selectionManager.deselectAll()
		this.canvas.textEditingManager.startCreatingAt(canvasPos.x, canvasPos.y)
		this.onTaskComplete()
	}

	public getMetadata() {
		return {
			name: "Text Tool",
			cursor: "text" as const,
			isTemporary: false,
		}
	}

	public destroy(): void {
		this.deactivate()
	}
}
