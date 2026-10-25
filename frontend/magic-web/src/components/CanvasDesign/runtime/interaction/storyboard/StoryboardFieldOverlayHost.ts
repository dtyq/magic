import { createElement } from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import type Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { StoryboardSelectOverlay } from "./StoryboardSelectOverlay"

export interface StoryboardSelectOption {
	label: string
	value: string
	icon?: string
	secondaryLabel?: string
	preview?: {
		iconWidth: number
		iconHeight: number
	}
}

export interface StoryboardSelectGroup {
	id: string
	label: string
	icon?: string
	options: StoryboardSelectOption[]
}

export type StoryboardFieldOverlayMountOptions = {
	anchorNode: Konva.Node
	ariaLabel: string
	value: string
	fontSize: number
	borderRadius: number
	onCommit: (value: string) => void
	onCancel?: () => void
} & (
	| {
			kind: "select"
			options: StoryboardSelectOption[]
			groups?: StoryboardSelectGroup[]
			horizontalPadding: number
			suffixGap: number
			suffixIconSize: number
			modelIconUrl?: string
			modelIconSize?: number
			modelIconGap?: number
			/** Select 打开时画布 pointer 被禁用；点画布后由宿主 commit，再回调此函数做切换。 */
			onCanvasOutsidePointer?: (point: {
				clientX: number
				clientY: number
				target: EventTarget | null
			}) => void
	  }
	| {
			kind: "textarea"
			placeholder?: string
			/** 与 Konva descriptionTextRect 内边距对齐；缺省回退旧值。 */
			paddingX?: number
			paddingY?: number
			onInput?: (value: string) => void
	  }
	| {
			kind: "number"
			step?: string
			min?: string
			onInput?: (value: string) => void
	  }
)

type StoryboardFieldControl = HTMLTextAreaElement | HTMLInputElement

/**
 * 分镜字段的临时 DOM 编辑层。
 *
 * 常态渲染仍完全由 Konva 负责；只有用户实际编辑时才在 stage container 内挂载
 * 临时表单控件。文本和数字输入使用原生控件，枚举字段复用画布 Select primitive。
 * 定位直接复用 Konva 绝对变换矩阵，能够覆盖视口缩放、平移、Frame 嵌套与元素旋转，
 * 且不会在输入过程中持续写入画布历史。
 */
export class StoryboardFieldOverlayHost {
	private readonly canvas: Canvas
	private wrapper: HTMLDivElement | null = null
	private control: StoryboardFieldControl | null = null
	private selectRoot: Root | null = null
	private options: StoryboardFieldOverlayMountOptions | null = null
	private finishing = false
	private eventUnsubscribers: Array<() => void> = []
	private wheelHandler: ((event: WheelEvent) => void) | null = null

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public isMounted(): boolean {
		return Boolean(this.wrapper && (this.control || this.selectRoot) && this.options)
	}

	public mount(options: StoryboardFieldOverlayMountOptions): void {
		this.cancel()
		this.options = options
		this.finishing = false

		const wrapper = document.createElement("div")
		wrapper.dataset.canvasUi = "storyboard-field-overlay"
		wrapper.style.position = "absolute"
		wrapper.style.left = "0"
		wrapper.style.top = "0"
		wrapper.style.zIndex = "1001"
		wrapper.style.transformOrigin = "0 0"
		wrapper.style.pointerEvents = "auto"

		this.canvas.stage.container().appendChild(wrapper)
		this.wrapper = wrapper

		if (options.kind === "select") {
			const selectContainer = document.createElement("div")
			selectContainer.style.width = "100%"
			selectContainer.style.height = "100%"
			wrapper.appendChild(selectContainer)
			this.selectRoot = createRoot(selectContainer)
			flushSync(() => {
				this.selectRoot?.render(
					createElement(StoryboardSelectOverlay, {
						...options,
						onCommit: (value) => this.commitValue(value),
						onCancel: () => this.cancel(),
						onCanvasOutsidePointer: (point) => {
							if (options.onCanvasOutsidePointer) {
								options.onCanvasOutsidePointer(point)
								return
							}
							this.commit()
						},
					}),
				)
			})
		} else {
			const control = this.createControl(options)
			wrapper.appendChild(control)
			this.control = control
		}

		this.bindDomEventBoundary(wrapper)
		this.bindCanvasEvents()
		this.updatePosition()
		if (this.control) this.focusControl(this.control)
	}

	public commit(): void {
		if (!this.options || this.finishing) return
		this.commitValue(this.control?.value ?? this.options.value)
	}

	/**
	 * 切换控件时关闭当前 overlay。
	 * Select 的值已在选项点击时提交；再走 commit 会触发文档更新/控件重绑，
	 * 进而在新 overlay mount 后被 binding cleanup cancel 掉。
	 */
	public dismissForSwitch(): void {
		if (!this.options || this.finishing) {
			this.unmount()
			return
		}
		if (this.options.kind === "select") {
			this.cancel()
			return
		}
		this.commit()
	}

	public cancel(): void {
		if (!this.options || this.finishing) {
			this.unmount()
			return
		}
		this.finishing = true
		const onCancel = this.options.onCancel
		this.unmount()
		onCancel?.()
	}

	public updatePosition(): void {
		if (!this.wrapper || !this.options) return
		const anchor = this.options.anchorNode
		if (!anchor.getStage()) {
			this.cancel()
			return
		}

		const [a, b, c, d, e, f] = anchor.getAbsoluteTransform().getMatrix()
		this.wrapper.style.width = `${Math.max(1, anchor.width())}px`
		this.wrapper.style.height = `${Math.max(1, anchor.height())}px`
		this.wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`
	}

	public destroy(): void {
		this.cancel()
	}

	private createControl(
		options: Exclude<StoryboardFieldOverlayMountOptions, { kind: "select" }>,
	): StoryboardFieldControl {
		let control: StoryboardFieldControl
		if (options.kind === "textarea") {
			const textarea = document.createElement("textarea")
			textarea.value = options.value
			textarea.placeholder = options.placeholder ?? ""
			textarea.wrap = "soft"
			textarea.style.resize = "none"
			textarea.style.lineHeight = "1.45"
			control = textarea
		} else {
			const input = document.createElement("input")
			// 使用文本输入 + decimal 键盘，避免浏览器原生 number spinner 干扰紧凑布局。
			input.type = "text"
			input.value = options.value
			input.inputMode = "decimal"
			input.autocomplete = "off"
			input.spellcheck = false
			input.style.textAlign = "center"
			control = input
		}

		control.setAttribute("aria-label", options.ariaLabel)
		control.style.width = "100%"
		control.style.height = "100%"
		control.style.boxSizing = "border-box"
		control.style.margin = "0"
		if (options.kind === "textarea") {
			const paddingX = Math.max(0, options.paddingX ?? 12)
			const paddingY = Math.max(0, options.paddingY ?? 10)
			control.style.padding = `${paddingY}px ${paddingX}px`
		} else {
			control.style.padding = "0 12px"
		}
		control.style.border = "2px solid #5B6EF5"
		control.style.borderRadius = `${Math.max(0, options.borderRadius)}px`
		control.style.outline = "none"
		control.style.background = "rgba(255, 255, 255, 0.98)"
		control.style.color = "#272A31"
		control.style.fontFamily = "Arial, PingFang SC, sans-serif"
		// 16px 可避免 iOS Safari 聚焦原生输入框时强制放大页面。
		control.style.fontSize = `${Math.max(16, options.fontSize)}px`
		control.style.boxShadow = "0 4px 16px rgba(36, 49, 87, 0.14)"

		control.addEventListener("keydown", (event) => {
			event.stopPropagation()
			if (event.key === "Escape") {
				event.preventDefault()
				this.cancel()
				return
			}
			if (
				event.key === "Enter" &&
				(options.kind === "number" ||
					(options.kind === "textarea" && (event.metaKey || event.ctrlKey)))
			) {
				event.preventDefault()
				this.commit()
			}
		})
		control.addEventListener("input", () => options.onInput?.(control.value))
		control.addEventListener("blur", () => this.commit())
		return control
	}

	private commitValue(value: string): void {
		if (!this.options || this.finishing) return
		this.finishing = true
		const onCommit = this.options.onCommit
		this.unmount()
		onCommit(value)
	}

	private focusControl(control: StoryboardFieldControl): void {
		try {
			control.focus({ preventScroll: true })
		} catch {
			control.focus()
		}

		const end = control.value.length
		control.setSelectionRange(end, end)
	}

	private bindDomEventBoundary(wrapper: HTMLDivElement): void {
		const stopPropagation = (event: Event) => event.stopPropagation()
		const eventNames = [
			"pointerdown",
			"pointerup",
			"mousedown",
			"mouseup",
			"touchstart",
			"touchend",
			"click",
			"dblclick",
			"contextmenu",
			"keydown",
			"keyup",
		] as const
		eventNames.forEach((eventName) => wrapper.addEventListener(eventName, stopPropagation))
		this.wheelHandler = (event: WheelEvent) => {
			if (this.shouldConsumeTextareaWheel(event)) return
			event.stopPropagation()
			this.canvas.viewportController.handleWheelFromFloating(event)
		}
		wrapper.addEventListener("wheel", this.wheelHandler, { passive: false })
		this.eventUnsubscribers.push(() => {
			eventNames.forEach((eventName) =>
				wrapper.removeEventListener(eventName, stopPropagation),
			)
			if (this.wheelHandler) {
				wrapper.removeEventListener("wheel", this.wheelHandler)
				this.wheelHandler = null
			}
		})
	}

	private shouldConsumeTextareaWheel(event: WheelEvent): boolean {
		if (event.ctrlKey || event.metaKey) return false
		const path = typeof event.composedPath === "function" ? event.composedPath() : []
		const textarea = path.find(
			(node): node is HTMLTextAreaElement => node instanceof HTMLTextAreaElement,
		)
		if (!textarea || textarea.scrollHeight <= textarea.clientHeight) return false
		if (event.deltaY < 0) return textarea.scrollTop > 0
		if (event.deltaY > 0) {
			return textarea.scrollTop + textarea.clientHeight < textarea.scrollHeight - 1
		}
		return false
	}

	private bindCanvasEvents(): void {
		const updatePosition = () => this.updatePosition()
		this.eventUnsubscribers.push(
			this.canvas.eventEmitter.on("viewport:scale", updatePosition),
			this.canvas.eventEmitter.on("viewport:pan", updatePosition),
			this.canvas.eventEmitter.on("canvas:resize", updatePosition),
			this.canvas.eventEmitter.on("elements:transform:dragmove", updatePosition),
			this.canvas.eventEmitter.on("elements:transform:anchorDragmove", updatePosition),
			this.canvas.eventEmitter.on("element:updated", updatePosition),
			this.canvas.eventEmitter.on("element:rerendered", updatePosition),
		)
	}

	private unmount(): void {
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.eventUnsubscribers = []
		this.selectRoot?.unmount()
		this.selectRoot = null
		this.wrapper?.remove()
		this.wrapper = null
		this.control = null
		this.options = null
		this.finishing = false
		this.wheelHandler = null
	}
}
