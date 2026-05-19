import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { BaseEditor, BaseRange, Descendant } from "slate"
import type { RichTextParagraph, TextStyle } from "../types"
import type { Canvas } from "../Canvas"
import { TextEditorOverlay } from "../text/TextEditorOverlay"

export interface TextEditorOverlayHostMountOptions {
	x: number
	y: number
	content?: RichTextParagraph[]
	defaultStyle?: TextStyle
	initialSelectAll: boolean
	scaleX?: number
	scaleY?: number
	initialCaretClientPoint?: { x: number; y: number } | null
	onEditorReady?: (editor: BaseEditor) => void
	onChange?: (value: Descendant[]) => void
	onSelectionChange?: (selection: BaseRange | null) => void
	onLayoutChange?: (size: { width: number; height: number }) => void
	onBlur?: () => void
}

export class TextEditorOverlayHost {
	private canvas: Canvas
	private editorWrapper: HTMLDivElement | null = null
	private editorContainer: HTMLDivElement | null = null
	private editorRoot: Root | null = null
	private editorWheelHandler: ((e: WheelEvent) => void) | null = null
	private editorPanPointerDownHandler: ((e: PointerEvent) => void) | null = null
	private editorPanMoveHandler: ((e: PointerEvent) => void) | null = null
	private editorPanUpHandler: ((e: PointerEvent) => void) | null = null
	private mountOptions: TextEditorOverlayHostMountOptions | null = null
	private viewportScale = 1
	private canvasX = 0
	private canvasY = 0
	private elementScaleX = 1
	private elementScaleY = 1

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public isMounted(): boolean {
		return Boolean(this.editorRoot)
	}

	public mount(options: TextEditorOverlayHostMountOptions): void {
		this.unmount()

		this.canvasX = options.x
		this.canvasY = options.y
		this.elementScaleX = options.scaleX ?? 1
		this.elementScaleY = options.scaleY ?? 1
		this.viewportScale = this.canvas.stage.scaleX()

		this.editorWrapper = document.createElement("div")
		this.editorWrapper.style.position = "absolute"
		this.editorWrapper.style.zIndex = "1000"
		this.editorWrapper.style.transformOrigin = "top left"
		this.editorWrapper.style.pointerEvents = "auto"

		this.editorContainer = document.createElement("div")
		this.editorWrapper.appendChild(this.editorContainer)
		this.canvas.stage.container().appendChild(this.editorWrapper)

		this.bindEditorViewportBridge()

		this.editorRoot = createRoot(this.editorContainer)
		this.mountOptions = options
		this.renderEditor()

		this.bindViewportEvents()
		this.updateEditorPosition()
	}

	public unmount(): void {
		this.unbindViewportEvents()
		this.unbindEditorViewportBridge()

		if (this.editorRoot) {
			this.editorRoot.unmount()
			this.editorRoot = null
		}
		if (this.editorWrapper) {
			this.editorWrapper.remove()
			this.editorWrapper = null
		}

		this.editorContainer = null
		this.mountOptions = null
		this.viewportScale = 1
		this.canvasX = 0
		this.canvasY = 0
		this.elementScaleX = 1
		this.elementScaleY = 1
	}

	public destroy(): void {
		this.unmount()
	}

	private bindViewportEvents(): void {
		this.canvas.eventEmitter.on("viewport:scale", this.handleViewportScale)
		this.canvas.eventEmitter.on("viewport:pan", this.handleViewportPan)
	}

	private unbindViewportEvents(): void {
		this.canvas.eventEmitter.off("viewport:scale", this.handleViewportScale)
		this.canvas.eventEmitter.off("viewport:pan", this.handleViewportPan)
	}

	private handleViewportScale = (): void => {
		// Keep zoom updates in DOM styles; re-rendering the editor can lag behind CSS scaling.
		this.updateEditorPosition()
		this.viewportScale = this.canvas.stage.scaleX()
	}

	private handleViewportPan = (): void => {
		this.updateEditorPosition()
	}

	private renderEditor(): void {
		if (!this.editorRoot || !this.mountOptions) {
			return
		}

		const options = this.mountOptions
		this.editorRoot.render(
			createElement(TextEditorOverlay, {
				content: options.content,
				defaultStyle: options.defaultStyle,
				initialSelectAll: options.initialSelectAll,
				initialCaretClientPoint: options.initialCaretClientPoint ?? undefined,
				viewportScale: this.viewportScale,
				onEditorReady: options.onEditorReady,
				onChange: options.onChange,
				onSelectionChange: options.onSelectionChange,
				onLayoutChange: options.onLayoutChange,
				onBlur: options.onBlur,
			}),
		)
	}

	/**
	 * 编辑态下 DOM 盖住 canvas：wheel 需转发才能平移/缩放视口；stage.draggable() 为 true（抓手等）时，
	 * Konva 收不到叠层上的按下/移动，故用 window 级 pointer 事件手动平移 stage 并发出 viewport:pan。
	 * 选择工具下 draggable 为 false，不在此抢左键，文本选择与输入不受影响。
	 */
	private bindEditorViewportBridge(): void {
		if (!this.editorWrapper) {
			return
		}

		this.editorWheelHandler = (e: WheelEvent) => {
			this.canvas.viewportController.handleWheelFromFloating(e)
		}
		this.editorWrapper.addEventListener("wheel", this.editorWheelHandler, { passive: false })

		this.editorPanPointerDownHandler = (e: PointerEvent) => {
			if (e.button !== 0 || !this.canvas.stage.draggable() || this.editorPanMoveHandler) {
				return
			}
			e.preventDefault()

			const stage = this.canvas.stage
			const startClient = { x: e.clientX, y: e.clientY }
			const stageStart = { x: stage.x(), y: stage.y() }

			this.editorPanMoveHandler = (ev: PointerEvent) => {
				if (ev.pointerId !== e.pointerId) {
					return
				}
				const dx = ev.clientX - startClient.x
				const dy = ev.clientY - startClient.y
				const position = { x: stageStart.x + dx, y: stageStart.y + dy }
				stage.position(position)
				stage.batchDraw()
				this.canvas.eventEmitter.emit({ type: "viewport:pan", data: position })
			}

			this.editorPanUpHandler = (ev: PointerEvent) => {
				if (ev.pointerId !== e.pointerId) {
					return
				}
				this.clearEditorPanSession()
			}

			window.addEventListener("pointermove", this.editorPanMoveHandler)
			window.addEventListener("pointerup", this.editorPanUpHandler)
			window.addEventListener("pointercancel", this.editorPanUpHandler)
		}
		this.editorWrapper.addEventListener("pointerdown", this.editorPanPointerDownHandler)
	}

	private clearEditorPanSession(): void {
		if (this.editorPanMoveHandler) {
			window.removeEventListener("pointermove", this.editorPanMoveHandler)
		}
		if (this.editorPanUpHandler) {
			window.removeEventListener("pointerup", this.editorPanUpHandler)
			window.removeEventListener("pointercancel", this.editorPanUpHandler)
		}
		this.editorPanMoveHandler = null
		this.editorPanUpHandler = null
	}

	private unbindEditorViewportBridge(): void {
		this.clearEditorPanSession()

		if (!this.editorWrapper) {
			return
		}
		if (this.editorWheelHandler) {
			this.editorWrapper.removeEventListener("wheel", this.editorWheelHandler)
			this.editorWheelHandler = null
		}
		if (this.editorPanPointerDownHandler) {
			this.editorWrapper.removeEventListener("pointerdown", this.editorPanPointerDownHandler)
			this.editorPanPointerDownHandler = null
		}
	}

	private updateEditorPosition(): void {
		if (!this.editorWrapper) {
			return
		}

		const scale = this.canvas.stage.scaleX()
		const stagePos = this.canvas.stage.position()
		this.editorWrapper.style.setProperty("--canvas-scale", `${scale}`)
		this.editorWrapper.style.left = `${this.canvasX * scale + stagePos.x}px`
		this.editorWrapper.style.top = `${this.canvasY * scale + stagePos.y}px`
		this.editorWrapper.style.transform = `scale(${this.elementScaleX}, ${this.elementScaleY})`
	}
}
