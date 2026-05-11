import type { Descendant, BaseEditor, BaseRange } from "slate"
import { HistoryEditor } from "slate-history"
import { ReactEditor } from "slate-react"
import type { Canvas } from "../Canvas"
import { TextElement as TextElementClass } from "../element/elements/TextElement"
import { measureRichTextLayout } from "../text/layout"
import {
	applySelectionParagraphStyle,
	applySelectionTextStyle,
	createInactiveTextEditorFormattingState,
	getTextEditorFormattingState,
	type TextAlignValue,
	type TextEditorFormattingState,
	type TextListTypeValue,
} from "../text/editorFormatting"
import {
	compactTextDefaultStyle,
	createRichTextParagraph,
	getDefaultTextStyle,
	getResolvedTextDefaultStyle,
	isRichTextContentEmpty,
	richTextParagraphsToSlateValue,
	slateValueToRichTextParagraphs,
} from "../text/richText"
import {
	resolveTypographyScaleFactor,
	scaleRichTextContent,
	scaleTextStyle,
} from "../text/scaleTypography"
import { TextEditorSelectionSession } from "../text/TextEditorSelectionSession"
import type { RichTextParagraph, TextElement, TextStyle } from "../types"
import { generateElementId } from "../utils/utils"
import { TextEditorOverlayHost } from "./TextEditorOverlayHost"
import { TextEditingPreviewSync } from "./TextEditingPreviewSync"

interface OpenTextEditorOptions {
	x: number
	y: number
	content?: RichTextParagraph[]
	defaultStyle?: TextStyle
	elementId: string | null
	initialSelectAll: boolean
	scaleX?: number
	scaleY?: number
	initialCaretClientPoint?: { x: number; y: number } | null
	originalElementData?: TextElement | null
}

export class TextEditingManager {
	private canvas: Canvas
	private overlayHost: TextEditorOverlayHost
	private previewSync: TextEditingPreviewSync
	private editingElementId: string | null = null
	private editingOriginalElementData: TextElement | null = null
	private isClosingEditor = false
	private currentValue: Descendant[] = richTextParagraphsToSlateValue([
		createRichTextParagraph(""),
	])
	private currentDefaultStyle: TextStyle = getDefaultTextStyle()
	private latestOverlayLayout: { width: number; height: number } | null = null
	private activeEditor: BaseEditor | null = null
	private selectionSession = new TextEditorSelectionSession()
	private readonly handleEditingElementDeselect = (event: {
		data?: { elementIds?: string[] }
	}) => {
		const editingElementId = this.editingElementId
		if (!editingElementId || this.isClosingEditor) {
			return
		}

		const deselectedIds = event.data?.elementIds
		const isEditingElementDeselected = deselectedIds?.length
			? deselectedIds.includes(editingElementId)
			: !this.canvas.selectionManager.isSelected(editingElementId)

		if (isEditingElementDeselected) {
			this.commitEditing({ selectAfterCommit: false })
		}
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.overlayHost = new TextEditorOverlayHost({ canvas: this.canvas })
		this.previewSync = new TextEditingPreviewSync({ canvas: this.canvas })
		this.canvas.eventEmitter.on("element:deselect", this.handleEditingElementDeselect)
	}

	public isEditing(): boolean {
		return this.overlayHost.isMounted()
	}

	public getEditingElementId(): string | null {
		return this.editingElementId
	}

	public canUndo(): boolean {
		const editor = this.getActiveHistoryEditor()
		return Boolean(editor && editor.history.undos.length > 0)
	}

	public canRedo(): boolean {
		const editor = this.getActiveHistoryEditor()
		return Boolean(editor && editor.history.redos.length > 0)
	}

	public undo(): boolean {
		const editor = this.getActiveHistoryEditor()
		if (!editor || editor.history.undos.length === 0) {
			return false
		}
		HistoryEditor.undo(editor)
		this.focusActiveEditor()
		this.emitEditingStateChange()
		return true
	}

	public redo(): boolean {
		const editor = this.getActiveHistoryEditor()
		if (!editor || editor.history.redos.length === 0) {
			return false
		}
		HistoryEditor.redo(editor)
		this.focusActiveEditor()
		this.emitEditingStateChange()
		return true
	}

	public getFormattingState(): TextEditorFormattingState {
		if (!this.editingElementId) {
			return createInactiveTextEditorFormattingState()
		}

		this.selectionSession.restoreIfNeeded(this.activeEditor)

		return getTextEditorFormattingState({
			editor: this.activeEditor,
			defaultStyle: this.currentDefaultStyle,
			elementId: this.editingElementId,
		})
	}

	public applyTextStyle(patch: Partial<TextStyle>): boolean {
		this.selectionSession.restoreIfNeeded(this.activeEditor)
		const didApply = applySelectionTextStyle(this.activeEditor, patch)
		if (didApply) {
			this.emitEditingStateChange()
		}
		return didApply
	}

	public applyParagraphStyle(
		patch: Partial<{
			align: TextAlignValue
			lineHeight: number | undefined
			paragraphSpacing: number
			listType: TextListTypeValue
		}>,
	): boolean {
		this.selectionSession.restoreIfNeeded(this.activeEditor)
		const didApply = applySelectionParagraphStyle(this.activeEditor, patch)
		if (didApply) {
			this.emitEditingStateChange()
		}
		return didApply
	}

	public restoreSelection(): void {
		if (!this.activeEditor) {
			return
		}
		this.selectionSession.restoreIfNeeded(this.activeEditor)
		this.focusActiveEditor()
	}

	public startCreatingAt(x: number, y: number): void {
		const defaultStyle = this.getInitialTextDefaultStyle()
		const initialContent = [createRichTextParagraph("")]
		const initialLayout = measureRichTextLayout(initialContent, defaultStyle)
		const elementId = this.createTextElement(
			initialContent,
			x,
			y,
			Math.max(initialLayout.width, 1),
			Math.max(initialLayout.height, 1),
			defaultStyle,
			false,
		)

		this.selectElementWithoutFocus(elementId)
		this.openEditor({
			x,
			y,
			content: initialContent,
			defaultStyle,
			elementId,
			initialSelectAll: false,
			scaleX: 1,
			scaleY: 1,
			initialCaretClientPoint: null,
			originalElementData: null,
		})
	}

	public editElement(
		elementId: string,
		initialCaretClientPoint?: { clientX?: number; clientY?: number },
	): void {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== "text") {
			return
		}

		const textElement = elementData as TextElement
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return
		}

		const node = element.getNode()
		const elementScaleX = node?.scaleX() ?? textElement.scaleX ?? 1
		const elementScaleY = node?.scaleY() ?? textElement.scaleY ?? 1
		const typographyScale = resolveTypographyScaleFactor(elementScaleX, elementScaleY)
		const normalizedContent = scaleRichTextContent(textElement.content, typographyScale)
		const resolvedDefaultBeforeEdit = getResolvedTextDefaultStyle(textElement.defaultStyle)
		const normalizedDefaultStyle =
			scaleTextStyle(resolvedDefaultBeforeEdit, typographyScale) ?? resolvedDefaultBeforeEdit

		const normalizedLayout = measureRichTextLayout(normalizedContent, normalizedDefaultStyle)
		this.canvas.elementManager.update(
			elementId,
			{
				content: normalizedContent,
				defaultStyle: compactTextDefaultStyle(normalizedDefaultStyle),
				width: Math.max(normalizedLayout.width, 1),
				height: Math.max(normalizedLayout.height, 1),
				scaleX: 1,
				scaleY: 1,
			},
			{ silent: true },
		)

		this.selectElementWithoutFocus(elementId)
		const pos = element.getPosition()
		this.openEditor({
			x: pos.x,
			y: pos.y,
			content: normalizedContent,
			defaultStyle: normalizedDefaultStyle,
			elementId,
			initialSelectAll: false,
			scaleX: 1,
			scaleY: 1,
			initialCaretClientPoint:
				initialCaretClientPoint?.clientX !== undefined &&
				initialCaretClientPoint?.clientY !== undefined
					? {
							x: initialCaretClientPoint.clientX,
							y: initialCaretClientPoint.clientY,
						}
					: null,
			originalElementData: textElement,
		})
	}

	public destroy(): void {
		this.canvas.eventEmitter.off("element:deselect", this.handleEditingElementDeselect)
		this.closeEditor({ restoreHiddenElement: true, restorePreviewData: true })
		this.overlayHost.destroy()
	}

	private openEditor(options: OpenTextEditorOptions): void {
		this.closeEditor({ restoreHiddenElement: true, restorePreviewData: true })

		this.editingElementId = options.elementId
		this.editingOriginalElementData = options.originalElementData ?? null
		this.latestOverlayLayout = null
		this.currentDefaultStyle = getResolvedTextDefaultStyle(options.defaultStyle)
		this.currentValue = richTextParagraphsToSlateValue(
			options.content,
			this.currentDefaultStyle,
		)
		this.selectionSession.clear()

		if (options.elementId) {
			this.previewSync.hideElement(options.elementId)
		}

		this.overlayHost.mount({
			x: options.x,
			y: options.y,
			content: options.content,
			defaultStyle: this.currentDefaultStyle,
			initialSelectAll: options.initialSelectAll,
			scaleX: options.scaleX,
			scaleY: options.scaleY,
			initialCaretClientPoint: options.initialCaretClientPoint ?? null,
			onEditorReady: (editor: BaseEditor) => {
				this.activeEditor = editor
				this.selectionSession.capture(editor.selection)
				this.emitEditingStateChange()
			},
			onChange: (value: Descendant[]) => {
				this.currentValue = value
				this.syncEditingPreview(value)
				this.emitEditingStateChange()
			},
			onSelectionChange: (selection: BaseRange | null) => {
				if (!selection) {
					return
				}
				this.selectionSession.capture(selection)
				this.emitEditingStateChange()
			},
			onLayoutChange: (size: { width: number; height: number }) => {
				this.latestOverlayLayout = size
				this.syncEditingPreviewLayout(size)
			},
			onBlur: () => {
				this.commitEditing()
			},
		})

		this.emitEditingStateChange()
	}

	private syncEditingPreview(value: Descendant[]): void {
		this.previewSync.syncContentPreview(this.getPreviewState(), value)
	}

	private syncEditingPreviewLayout(size: { width: number; height: number }): void {
		this.previewSync.syncLayoutPreview(this.editingElementId, size)
	}

	private getPreviewState() {
		return {
			elementId: this.editingElementId,
			defaultStyle: this.currentDefaultStyle,
			latestOverlayLayout: this.latestOverlayLayout,
		}
	}

	private selectElementWithoutFocus(elementId: string): void {
		this.canvas.selectionManager.selectMultiple([elementId], false, false)
	}

	private commitEditing(options?: { selectAfterCommit?: boolean }): void {
		if (this.isClosingEditor) {
			return
		}

		const content = slateValueToRichTextParagraphs(this.currentValue)
		if (isRichTextContentEmpty(content)) {
			this.deleteEditingElement()
			this.closeEditor({ restoreHiddenElement: false, restorePreviewData: false })
			return
		}

		const layout = measureRichTextLayout(content, this.currentDefaultStyle)
		const width = Math.max(layout.width, 1)
		const height = Math.max(layout.height, 1)

		if (this.editingElementId) {
			this.updateTextElement(
				this.editingElementId,
				content,
				width,
				height,
				this.currentDefaultStyle,
				options?.selectAfterCommit ?? true,
			)
		}
		this.closeEditor({ restoreHiddenElement: true, restorePreviewData: false })
	}

	private createTextElement(
		content: RichTextParagraph[],
		x: number,
		y: number,
		width: number,
		height: number,
		defaultStyle: TextStyle,
		shouldSelect = true,
	): string {
		const elementId = generateElementId()
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()
		const textElement = TextElementClass.createElementData(
			elementId,
			x,
			y,
			width,
			height,
			newZIndex,
			"",
		)
		textElement.content = content
		textElement.defaultStyle = compactTextDefaultStyle(defaultStyle)

		this.canvas.elementManager.create(textElement)
		if (shouldSelect) {
			this.canvas.selectionManager.selectMultiple([elementId])
		}
		return elementId
	}

	private getInitialTextDefaultStyle(): TextStyle {
		const defaultStyle = getDefaultTextStyle()
		const viewportScale = this.canvas.stage.scaleX()
		const safeViewportScale =
			Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1

		return {
			...defaultStyle,
			fontSize: Math.max(
				defaultStyle.fontSize,
				Math.round(defaultStyle.fontSize / safeViewportScale),
			),
		}
	}

	private deleteEditingElement(): void {
		if (!this.editingElementId) {
			return
		}
		this.canvas.elementManager.delete(this.editingElementId)
	}

	private updateTextElement(
		elementId: string,
		content: RichTextParagraph[],
		width: number,
		height: number,
		defaultStyle: TextStyle,
		shouldSelect = false,
	): void {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== "text") {
			return
		}

		const textElement = elementData as TextElement
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (element) {
			const pos = element.getPosition()
			textElement.x = pos.x
			textElement.y = pos.y
		}

		textElement.content = content
		textElement.defaultStyle = compactTextDefaultStyle(defaultStyle)
		textElement.width = width
		textElement.height = height
		textElement.scaleX = 1
		textElement.scaleY = 1
		this.canvas.elementManager.update(textElement.id, textElement)

		if (shouldSelect) {
			this.canvas.selectionManager.selectMultiple([elementId])
		}
	}

	private closeEditor(options?: {
		restoreHiddenElement: boolean
		restorePreviewData: boolean
	}): void {
		if (this.isClosingEditor) {
			return
		}

		this.isClosingEditor = true

		if (options?.restorePreviewData && this.editingOriginalElementData) {
			this.canvas.elementManager.update(
				this.editingOriginalElementData.id,
				this.editingOriginalElementData,
				{ silent: true },
			)
			this.previewSync.refreshTransformer(this.editingOriginalElementData.id)
		}

		if (options?.restoreHiddenElement && this.editingElementId) {
			const opacity = this.editingOriginalElementData?.opacity ?? 1
			this.previewSync.restoreElementOpacity(this.editingElementId, opacity)
		}

		this.overlayHost.unmount()
		this.activeEditor = null
		this.editingElementId = null
		this.editingOriginalElementData = null
		this.latestOverlayLayout = null
		this.selectionSession.clear()
		this.currentValue = richTextParagraphsToSlateValue([createRichTextParagraph("")])
		this.emitEditingStateChange()

		requestAnimationFrame(() => {
			this.isClosingEditor = false
		})
	}

	private getActiveHistoryEditor(): (BaseEditor & ReactEditor & HistoryEditor) | null {
		if (!this.activeEditor) {
			return null
		}
		return this.activeEditor as BaseEditor & ReactEditor & HistoryEditor
	}

	private focusActiveEditor(): void {
		if (!this.activeEditor) {
			return
		}
		try {
			ReactEditor.focus(this.activeEditor as ReactEditor)
		} catch {
			// 编辑器节点可能正处于卸载阶段，此时无需强行恢复焦点。
		}
	}

	private emitEditingStateChange(): void {
		this.canvas.eventEmitter.emit({
			type: "text:editing-state-change",
			data: {
				active: Boolean(this.editingElementId),
				elementId: this.editingElementId,
			},
		})
	}
}
