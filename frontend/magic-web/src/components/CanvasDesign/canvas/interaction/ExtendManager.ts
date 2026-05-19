import type { Canvas } from "../Canvas"
import { ElementTypeEnum, type ExtendSession, type ImageElement } from "../types"
import { calculateNodesRect } from "../utils/utils"
import { ExtendRenderer } from "./ExtendRenderer"

export class ExtendManager {
	private canvas: Canvas
	private extendingElementId: string | null = null
	private tempSession: ExtendSession | null = null
	private extendRenderer: ExtendRenderer | null = null

	private escapeHandler?: () => void
	private elementSelectHandler?: () => void
	private elementDeselectHandler?: () => void
	private viewportScaleHandler?: () => void
	private viewportPanHandler?: () => void
	private elementUpdatedHandler?: (event: { data: { elementId: string } }) => void
	private elementRerenderedHandler?: (event: { data: { elementId: string } }) => void

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		this.escapeHandler = () => {
			if (this.extendingElementId) {
				this.cancelExtend()
			}
		}
		this.canvas.eventEmitter.on("keyboard:escape", this.escapeHandler)

		this.elementSelectHandler = () => {
			if (this.extendingElementId) {
				this.exitExtendMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:select", this.elementSelectHandler)

		this.elementDeselectHandler = () => {
			if (this.extendingElementId) {
				this.exitExtendMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:deselect", this.elementDeselectHandler)
	}

	private removeEventListeners(): void {
		if (this.escapeHandler) {
			this.canvas.eventEmitter.off("keyboard:escape", this.escapeHandler)
			this.escapeHandler = undefined
		}
		if (this.elementSelectHandler) {
			this.canvas.eventEmitter.off("element:select", this.elementSelectHandler)
			this.elementSelectHandler = undefined
		}
		if (this.elementDeselectHandler) {
			this.canvas.eventEmitter.off("element:deselect", this.elementDeselectHandler)
			this.elementDeselectHandler = undefined
		}
	}

	private setupPositionListeners(): void {
		this.viewportScaleHandler = () => this.syncPresentation()
		this.viewportPanHandler = () => this.syncPresentation()
		this.elementUpdatedHandler = ({ data }) => {
			if (data.elementId === this.extendingElementId) {
				this.syncPresentation()
			}
		}
		this.elementRerenderedHandler = ({ data }) => {
			if (data.elementId === this.extendingElementId) {
				this.exitExtendMode(true)
			}
		}

		this.canvas.eventEmitter.on("viewport:scale", this.viewportScaleHandler)
		this.canvas.eventEmitter.on("viewport:pan", this.viewportPanHandler)
		this.canvas.eventEmitter.on("element:updated", this.elementUpdatedHandler)
		this.canvas.eventEmitter.on("element:rerendered", this.elementRerenderedHandler)
	}

	private removePositionListeners(): void {
		if (this.viewportScaleHandler) {
			this.canvas.eventEmitter.off("viewport:scale", this.viewportScaleHandler)
			this.viewportScaleHandler = undefined
		}
		if (this.viewportPanHandler) {
			this.canvas.eventEmitter.off("viewport:pan", this.viewportPanHandler)
			this.viewportPanHandler = undefined
		}
		if (this.elementUpdatedHandler) {
			this.canvas.eventEmitter.off("element:updated", this.elementUpdatedHandler)
			this.elementUpdatedHandler = undefined
		}
		if (this.elementRerenderedHandler) {
			this.canvas.eventEmitter.off("element:rerendered", this.elementRerenderedHandler)
			this.elementRerenderedHandler = undefined
		}
	}

	private syncPresentation(): void {
		this.extendRenderer?.syncTransform()
		this.emitExtendPosition()
	}

	private emitExtendPosition(): void {
		if (!this.extendingElementId) return

		const boundingRect =
			this.extendRenderer?.getBoundingRect() ??
			this.getFallbackBoundingRect(this.extendingElementId)

		this.canvas.eventEmitter.emit({
			type: "extend:position",
			data: {
				elementId: this.extendingElementId,
				boundingRect,
			},
		})
	}

	private getFallbackBoundingRect(elementId: string) {
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform([elementId])
		if (nodes.length === 0) return null

		return calculateNodesRect(nodes, this.canvas.stage, this.canvas.elementManager)
	}

	private createInitialSession(imageElement: ImageElement): ExtendSession {
		return {
			frame: {
				x: 0,
				y: 0,
				width: imageElement.width ?? 0,
				height: imageElement.height ?? 0,
			},
		}
	}

	public enterExtendMode(elementId: string): void {
		if (this.canvas.cropManager.getCroppingElementId()) {
			this.canvas.cropManager.cancelCrop()
		}
		if (this.canvas.eraserManager.getErasingElementId()) {
			this.canvas.eraserManager.cancelEraser()
		}

		if (this.extendingElementId && this.extendingElementId !== elementId) {
			this.exitExtendMode(true)
		}

		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return

		this.tempSession = this.createInitialSession(elementData as ImageElement)

		this.canvas.selectionManager.deselectAll()
		this.extendingElementId = elementId

		this.canvas.eventEmitter.emit({
			type: "extend:enter",
			data: { elementId },
		})

		this.canvas.viewportController.focusOnElements([elementId], {
			animated: true,
			padding: {
				top: "5%",
				right: "5%",
				bottom: "5%",
				left: "5%",
				minRight: 325,
				minLeft: 325,
			},
			selectElement: false,
			ensureFullyVisible: false,
		})

		this.canvas.container.focus()

		this.extendRenderer = new ExtendRenderer({
			canvas: this.canvas,
			elementId,
		})
		this.extendRenderer.render()

		this.setupPositionListeners()
		this.emitExtendPosition()
	}

	public exitExtendMode(shouldRestore: boolean): void {
		if (!this.extendingElementId) return

		const elementId = this.extendingElementId

		this.removePositionListeners()

		if (this.extendRenderer) {
			this.extendRenderer.destroy()
			this.extendRenderer = null
		}

		this.extendingElementId = null
		this.tempSession = null

		this.canvas.selectionManager.select(elementId, false)
		this.canvas.eventEmitter.emit({
			type: "extend:exit",
			data: { elementId, restored: shouldRestore },
		})
	}

	public updateTempSession(session: ExtendSession): void {
		this.tempSession = session

		if (!this.extendingElementId) return

		this.canvas.eventEmitter.emit({
			type: "extend:tempUpdate",
			data: {
				elementId: this.extendingElementId,
				session,
			},
		})
		this.emitExtendPosition()
	}

	public updateTempSessionFromPanel(session: ExtendSession): void {
		if (!this.extendingElementId) return

		this.tempSession = session
		this.canvas.eventEmitter.emit({
			type: "extend:updateFromPanel",
			data: {
				elementId: this.extendingElementId,
				session,
			},
		})
		this.emitExtendPosition()
	}

	public confirmExtend(): void {
		if (!this.extendingElementId || !this.tempSession) return

		this.canvas.eventEmitter.emit({
			type: "extend:confirmed",
			data: {
				elementId: this.extendingElementId,
				session: this.tempSession,
			},
		})
		this.exitExtendMode(false)
	}

	public cancelExtend(): void {
		this.exitExtendMode(true)
	}

	public setKeepRatio(): void {
		this.extendRenderer?.setKeepRatio()
	}

	public getExtendingElementId(): string | null {
		return this.extendingElementId
	}

	public getTempSession(): ExtendSession | null {
		return this.tempSession
	}

	public getImageProxyLocalRect(): {
		x: number
		y: number
		width: number
		height: number
	} | null {
		return this.extendRenderer?.getImageProxyLocalRect() ?? null
	}

	public getImageBounds(): {
		x: number
		y: number
		width: number
		height: number
	} | null {
		return this.extendRenderer?.getImageBounds() ?? null
	}

	public destroy(): void {
		this.removeEventListeners()
		if (this.extendingElementId) {
			this.exitExtendMode(true)
		}
	}
}
