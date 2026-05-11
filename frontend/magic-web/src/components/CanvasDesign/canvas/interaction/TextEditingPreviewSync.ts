import Konva from "konva"
import type { Descendant } from "slate"
import type { Canvas } from "../Canvas"
import type { TextStyle } from "../types"
import {
	compactTextDefaultStyle,
	createRichTextParagraph,
	isRichTextContentEmpty,
	slateValueToRichTextParagraphs,
} from "../text/richText"
import { measureRichTextLayout } from "../text/layout"

interface TextEditingPreviewState {
	elementId: string | null
	defaultStyle: TextStyle
	latestOverlayLayout: { width: number; height: number } | null
}

const PREVIEW_BOUNDS_NODE_NAMES = new Set(["text-content-bounds", "hit-area"])

export class TextEditingPreviewSync {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public syncContentPreview(state: TextEditingPreviewState, value: Descendant[]): void {
		if (!state.elementId) {
			return
		}

		const content = slateValueToRichTextParagraphs(value)
		const previewContent = isRichTextContentEmpty(content)
			? [createRichTextParagraph("")]
			: content
		const layout = measureRichTextLayout(previewContent, state.defaultStyle)
		const overlayLayout = this.getOverlayLayoutInCanvasUnits(state.latestOverlayLayout)
		const width = Math.max(overlayLayout?.width ?? layout.width, 1)
		const height = Math.max(overlayLayout?.height ?? layout.height, 1)
		const element = this.canvas.elementManager.getElementInstance(state.elementId)
		const defaultStyle = compactTextDefaultStyle(state.defaultStyle)
		const previewUpdate = {
			x: element?.getPosition().x,
			y: element?.getPosition().y,
			content: previewContent,
			defaultStyle,
			width,
			height,
		}

		this.canvas.elementManager.update(state.elementId, previewUpdate, { silent: true })

		this.refreshPreviewVisuals(state.elementId)
	}

	public syncLayoutPreview(
		elementId: string | null,
		size: { width: number; height: number },
	): void {
		if (!elementId) {
			return
		}

		const layout = this.getOverlayLayoutInCanvasUnits(size)
		if (!layout) {
			return
		}

		this.applyPreviewBounds(elementId, layout)
		this.canvas.geometryCacheManager?.invalidateElement(elementId)
		this.refreshPreviewVisuals(elementId)
	}

	public hideElement(elementId: string | null): void {
		if (!elementId) {
			return
		}
		this.canvas.elementManager.getElementInstance(elementId)?.setOpacity(0, { temporary: true })
	}

	public restoreElementOpacity(elementId: string | null, opacity: number): void {
		if (!elementId) {
			return
		}
		this.canvas.elementManager.getElementInstance(elementId)?.setOpacity(opacity, {
			temporary: true,
		})
	}

	public refreshTransformer(elementId: string | null): void {
		if (!elementId) {
			return
		}

		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.includes(elementId)) {
			this.canvas.transformManager.updateTransformer(selectedIds)
		}
	}

	private refreshPreviewVisuals(elementId: string): void {
		this.hideElement(elementId)
		this.refreshTransformer(elementId)
		if (this.canvas.selectionManager.isSelected(elementId)) {
			this.canvas.selectionManager.refreshSelectionPosition()
		}
	}

	private applyPreviewBounds(elementId: string, layout: { width: number; height: number }): void {
		const node = this.canvas.elementManager.getElementInstance(elementId)?.getNode()
		if (!(node instanceof Konva.Group)) {
			return
		}

		node.width(layout.width)
		node.height(layout.height)
		node.children.forEach((child) => {
			if (child instanceof Konva.Rect && PREVIEW_BOUNDS_NODE_NAMES.has(child.name())) {
				child.width(layout.width)
				child.height(layout.height)
			}
		})
		node.getLayer()?.batchDraw()
	}

	private getOverlayLayoutInCanvasUnits(
		size: { width: number; height: number } | null,
	): { width: number; height: number } | null {
		if (!size) {
			return null
		}

		const viewportScale = this.canvas.stage.scaleX() || 1
		return {
			width: Math.max(Math.ceil(size.width / viewportScale), 1),
			height: Math.max(Math.ceil(size.height / viewportScale), 1),
		}
	}
}
