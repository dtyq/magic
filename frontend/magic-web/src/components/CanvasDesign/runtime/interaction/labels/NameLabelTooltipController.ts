import type { Canvas } from "../../core/Canvas"

export interface NameLabelTooltipContent {
	key: string
	text: string
	title?: string
}

/** Coordinates are relative to the Canvas stage container. */
export interface NameLabelTooltipAnchor {
	x: number
	y: number
	width: number
	height: number
}

const TOOLTIP_DELAY = 700
const TOOLTIP_MAX_WIDTH = 320
const TOOLTIP_MIN_WIDTH = 64
const TOOLTIP_PADDING_X = 10
const TOOLTIP_PADDING_Y = 7
const TOOLTIP_GAP = 5
const TOOLTIP_ARROW_SIZE = 4
const TOOLTIP_TITLE_FONT_SIZE = 11
const TOOLTIP_TEXT_FONT_SIZE = 12
const TOOLTIP_TITLE_LINE_HEIGHT = 15
const TOOLTIP_TEXT_LINE_HEIGHT = 17
const TOOLTIP_VIEWPORT_PADDING = 8
/** Canvas controls use z-index 2/3; keep the tooltip above them but below modal-level surfaces. */
const TOOLTIP_Z_INDEX = 4

/**
 * Shows one name-label tooltip for a Canvas.
 *
 * The label and its hit area remain Konva nodes. One reusable DOM root is created per Canvas and
 * its text is populated only for the currently hovered tooltip, keeping the DOM cost independent
 * of the number of elements on the canvas.
 * The tooltip is positioned inside the stage container so it follows the Canvas stacking context,
 * pan/zoom coordinates, and clipping boundary without intercepting pointer events.
 */
export class NameLabelTooltipController {
	private readonly canvas: Canvas
	private readonly stageContainer: HTMLElement | null
	private readonly host: HTMLElement | null
	private readonly root: HTMLDivElement | null
	private readonly titleNode: HTMLDivElement | null
	private readonly textNode: HTMLDivElement | null
	private readonly arrowNode: HTMLSpanElement | null
	private showTimer: ReturnType<typeof setTimeout> | null = null
	private pending: {
		content: NameLabelTooltipContent
		anchor: NameLabelTooltipAnchor
	} | null = null
	private visibleContent: NameLabelTooltipContent | null = null
	private visibleAnchor: NameLabelTooltipAnchor | null = null
	private readonly handleViewportChange = (): void => {
		// The anchor is no longer reliable after the page or canvas viewport moves. Hiding lets the
		// next real pointerenter schedule a fresh tooltip instead of showing stale content.
		this.hide()
	}

	constructor(canvas: Canvas) {
		this.canvas = canvas
		this.stageContainer = this.getStageContainer()
		this.host = this.getCanvasHost(this.stageContainer)
		if (typeof document === "undefined") {
			this.root = null
			this.titleNode = null
			this.textNode = null
			this.arrowNode = null
			return
		}
		if (!this.host) {
			this.root = null
			this.titleNode = null
			this.textNode = null
			this.arrowNode = null
			return
		}

		const root = document.createElement("div")
		root.className = "canvas-design-name-label-tooltip"
		root.dataset.nameLabelTooltip = "true"
		root.setAttribute("role", "tooltip")
		root.setAttribute("aria-hidden", "true")
		Object.assign(root.style, {
			position: "absolute",
			display: "none",
			boxSizing: "border-box",
			minWidth: `${TOOLTIP_MIN_WIDTH}px`,
			maxWidth: `${TOOLTIP_MAX_WIDTH}px`,
			padding: `${TOOLTIP_PADDING_Y}px ${TOOLTIP_PADDING_X}px`,
			borderRadius: "6px",
			background: "#262626",
			color: "#ffffff",
			fontFamily: "Arial, sans-serif",
			fontSize: `${TOOLTIP_TEXT_FONT_SIZE}px`,
			fontWeight: "400",
			lineHeight: `${TOOLTIP_TEXT_LINE_HEIGHT}px`,
			wordBreak: "break-word",
			overflowWrap: "anywhere",
			pointerEvents: "none",
			zIndex: String(TOOLTIP_Z_INDEX),
		})

		const titleNode = document.createElement("div")
		titleNode.className = "canvas-design-name-label-tooltip-title"
		Object.assign(titleNode.style, {
			display: "none",
			color: "rgba(255, 255, 255, 0.68)",
			fontSize: `${TOOLTIP_TITLE_FONT_SIZE}px`,
			lineHeight: `${TOOLTIP_TITLE_LINE_HEIGHT}px`,
			marginBottom: "3px",
			wordBreak: "break-word",
			overflowWrap: "anywhere",
		})

		const textNode = document.createElement("div")
		textNode.className = "canvas-design-name-label-tooltip-text"
		Object.assign(textNode.style, {
			fontSize: `${TOOLTIP_TEXT_FONT_SIZE}px`,
			lineHeight: `${TOOLTIP_TEXT_LINE_HEIGHT}px`,
			wordBreak: "break-word",
			overflowWrap: "anywhere",
		})

		const arrowNode = document.createElement("span")
		arrowNode.className = "canvas-design-name-label-tooltip-arrow"
		Object.assign(arrowNode.style, {
			position: "absolute",
			width: "0",
			height: "0",
			borderLeft: `${TOOLTIP_ARROW_SIZE}px solid transparent`,
			borderRight: `${TOOLTIP_ARROW_SIZE}px solid transparent`,
			pointerEvents: "none",
		})

		root.append(titleNode, textNode, arrowNode)
		this.host.appendChild(root)
		this.root = root
		this.titleNode = titleNode
		this.textNode = textNode
		this.arrowNode = arrowNode
		window.addEventListener("resize", this.handleViewportChange)
		window.addEventListener("scroll", this.handleViewportChange, true)
	}

	public schedule(content: NameLabelTooltipContent, anchor: NameLabelTooltipAnchor): void {
		this.clearTimer()
		this.hideRenderedTooltip()
		this.visibleContent = null
		this.visibleAnchor = null
		this.pending = { content, anchor }
		if (!this.root) return

		this.showTimer = setTimeout(() => {
			this.showTimer = null
			if (!this.pending || this.pending.content.key !== content.key) return

			this.visibleContent = this.pending.content
			this.visibleAnchor = this.pending.anchor
			this.pending = null
			this.render()
		}, TOOLTIP_DELAY)
	}

	public updateAnchor(anchor: NameLabelTooltipAnchor): void {
		if (this.visibleContent) {
			this.visibleAnchor = anchor
			this.render()
			return
		}
		if (this.pending) this.pending.anchor = anchor
	}

	public hide(): boolean {
		const wasVisible = Boolean(
			this.visibleContent ||
			this.pending ||
			(this.root !== null && this.root.style.display !== "none"),
		)
		this.clearTimer()
		this.pending = null
		this.visibleContent = null
		this.visibleAnchor = null
		this.hideRenderedTooltip()
		return wasVisible
	}

	public isVisible(): boolean {
		return Boolean(this.visibleContent && this.root?.style.display !== "none")
	}

	public destroy(): void {
		this.hide()
		if (typeof window !== "undefined") {
			window.removeEventListener("resize", this.handleViewportChange)
			window.removeEventListener("scroll", this.handleViewportChange, true)
		}
		if (this.root?.parentNode) this.root.parentNode.removeChild(this.root)
	}

	private clearTimer(): void {
		if (this.showTimer === null) return
		clearTimeout(this.showTimer)
		this.showTimer = null
	}

	private hideRenderedTooltip(): void {
		if (!this.root) return
		this.root.style.display = "none"
		this.root.style.visibility = "hidden"
		this.root.setAttribute("aria-hidden", "true")
	}

	private render(): void {
		const root = this.root
		const titleNode = this.titleNode
		const textNode = this.textNode
		const arrowNode = this.arrowNode
		const content = this.visibleContent
		const anchor = this.visibleAnchor
		if (!root || !titleNode || !textNode || !arrowNode || !content || !anchor) return

		const viewportWidth = this.getViewportWidth()
		const viewportHeight = this.getViewportHeight()
		const hostAnchor = this.getHostAnchor(anchor)
		const maxWidth = Math.max(
			TOOLTIP_MIN_WIDTH,
			Math.min(TOOLTIP_MAX_WIDTH, viewportWidth - TOOLTIP_VIEWPORT_PADDING * 2),
		)

		titleNode.textContent = content.title ?? ""
		titleNode.style.display = content.title ? "block" : "none"
		textNode.textContent = content.text
		root.style.maxWidth = `${maxWidth}px`
		root.style.left = "0px"
		root.style.top = "0px"
		root.style.visibility = "hidden"
		root.style.display = "block"

		const measuredRect = root.getBoundingClientRect()
		const width = Math.max(TOOLTIP_MIN_WIDTH, Math.min(maxWidth, measuredRect.width))
		const height = measuredRect.height
		const maxLeft = Math.max(
			TOOLTIP_VIEWPORT_PADDING,
			viewportWidth - width - TOOLTIP_VIEWPORT_PADDING,
		)
		const left = Math.min(Math.max(TOOLTIP_VIEWPORT_PADDING, hostAnchor.x), maxLeft)
		const aboveTop = hostAnchor.y - height - TOOLTIP_GAP - TOOLTIP_ARROW_SIZE
		const showAbove = aboveTop >= TOOLTIP_VIEWPORT_PADDING
		const maxTop = Math.max(
			TOOLTIP_VIEWPORT_PADDING,
			viewportHeight - height - TOOLTIP_VIEWPORT_PADDING,
		)
		const top = showAbove
			? aboveTop
			: Math.min(
					Math.max(
						TOOLTIP_VIEWPORT_PADDING,
						hostAnchor.y + hostAnchor.height + TOOLTIP_GAP + TOOLTIP_ARROW_SIZE,
					),
					maxTop,
				)

		root.style.left = `${left}px`
		root.style.top = `${top}px`
		root.style.visibility = "visible"
		root.setAttribute("aria-hidden", "false")

		const arrowCenter = hostAnchor.x + Math.min(hostAnchor.width / 2, 24)
		const arrowLeft = Math.min(
			Math.max(arrowCenter - left - TOOLTIP_ARROW_SIZE, TOOLTIP_VIEWPORT_PADDING),
			Math.max(TOOLTIP_VIEWPORT_PADDING, width - TOOLTIP_VIEWPORT_PADDING * 2),
		)
		arrowNode.style.left = `${arrowLeft}px`
		arrowNode.style.top = showAbove ? "100%" : "auto"
		arrowNode.style.bottom = showAbove ? "auto" : "100%"
		arrowNode.style.borderTop = showAbove
			? `${TOOLTIP_ARROW_SIZE}px solid #262626`
			: "0 solid transparent"
		arrowNode.style.borderBottom = showAbove
			? "0 solid transparent"
			: `${TOOLTIP_ARROW_SIZE}px solid #262626`
	}

	private getViewportWidth(): number {
		const stage = this.canvas.stage as Canvas["stage"] & {
			width?: () => number
		}
		return (
			this.host?.clientWidth ||
			(typeof stage?.width === "function" ? stage.width() : 0) ||
			1024
		)
	}

	private getViewportHeight(): number {
		const stage = this.canvas.stage as Canvas["stage"] & {
			height?: () => number
		}
		return (
			this.host?.clientHeight ||
			(typeof stage?.height === "function" ? stage.height() : 0) ||
			768
		)
	}

	private getHostAnchor(anchor: NameLabelTooltipAnchor): NameLabelTooltipAnchor {
		const stageContainer = this.stageContainer
		const host = this.host
		if (!stageContainer || !host || stageContainer === host) return anchor

		const stageRect = stageContainer.getBoundingClientRect()
		const hostRect = host.getBoundingClientRect()
		return {
			...anchor,
			x: anchor.x + stageRect.left - hostRect.left,
			y: anchor.y + stageRect.top - hostRect.top,
		}
	}

	private getStageContainer(): HTMLElement | null {
		const stage = this.canvas.stage as Canvas["stage"] & {
			container?: () => HTMLElement
		}
		if (typeof stage?.container === "function") {
			const stageContainer = stage.container()
			if (stageContainer && typeof stageContainer.appendChild === "function") {
				return stageContainer
			}
		}

		const canvasContainer = (this.canvas as Canvas & { container?: HTMLElement }).container
		return canvasContainer && typeof canvasContainer.appendChild === "function"
			? canvasContainer
			: null
	}

	private getCanvasHost(stageContainer: HTMLElement | null): HTMLElement | null {
		const parent = stageContainer?.parentElement
		return parent && typeof parent.appendChild === "function" ? parent : stageContainer
	}
}
