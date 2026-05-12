import type { Canvas } from "../Canvas"
import { ElementTypeEnum, type RichTextParagraph, type TextElement, type TextStyle } from "../types"
import type {
	TextAlignValue,
	TextEditorFormattingState,
	TextListTypeValue,
} from "../text/editorFormatting"
import {
	getResolvedTextDefaultStyle,
	mergeTextDefaultStylePatch,
	removeRichTextInlineStyles,
	setRichTextParagraphStyle,
	setRichTextParagraphTextAlign,
} from "../text/richText"

export interface TextFormattingToolbarState {
	state: TextEditorFormattingState
	selectedTextElement: TextElement | null
	isEditingText: boolean
	hasTextSelectionContext: boolean
	resolvedDefaultStyle: TextStyle
}

export function createInactiveTextFormattingToolbarState(): TextFormattingToolbarState {
	return {
		state: {
			active: false,
			elementId: null,
			canEdit: false,
			isCollapsed: true,
			fontFamily: null,
			fontSize: null,
			fontWeight: null,
			color: null,
			letterSpacing: null,
			italic: null,
			underline: null,
			strikethrough: null,
			textAlign: null,
			lineHeight: null,
			listType: null,
		},
		selectedTextElement: null,
		isEditingText: false,
		hasTextSelectionContext: false,
		resolvedDefaultStyle: getResolvedTextDefaultStyle(undefined),
	}
}

export class TextFormattingManager {
	private canvas: Canvas

	private readonly emitFormattingStateChange = () => {
		this.canvas.eventEmitter.emit({
			type: "text:formatting-state-change",
			data: undefined,
		})
	}

	private readonly handleSelectedTextElementUpdate = ({
		data,
	}: {
		data: { elementId: string }
	}) => {
		if (this.getSelectedTextElement()?.id === data.elementId) {
			this.emitFormattingStateChange()
		}
	}

	private readonly handleSelectedTextElementChange = (event: {
		data?: { elementIds?: string[] }
	}) => {
		const ids = event.data?.elementIds
		if (!ids?.length) {
			return
		}
		const selected = this.getSelectedTextElement()
		if (selected && ids.includes(selected.id)) {
			this.emitFormattingStateChange()
		}
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	public destroy(): void {
		this.canvas.eventEmitter.off("element:select", this.emitFormattingStateChange)
		this.canvas.eventEmitter.off("element:deselect", this.emitFormattingStateChange)
		this.canvas.eventEmitter.off("text:editing-state-change", this.emitFormattingStateChange)
		this.canvas.eventEmitter.off("document:restored", this.emitFormattingStateChange)
		this.canvas.eventEmitter.off("canvas:clear", this.emitFormattingStateChange)
		this.canvas.eventEmitter.off("element:updated", this.handleSelectedTextElementUpdate)
		this.canvas.eventEmitter.off("element:change", this.handleSelectedTextElementChange)
		this.canvas.eventEmitter.off("element:deleted", this.handleSelectedTextElementUpdate)
	}

	public getToolbarState(): TextFormattingToolbarState {
		const state = this.canvas.textEditingManager.getFormattingState()
		const selectedTextElement = this.getSelectedTextElement()

		return {
			state,
			selectedTextElement,
			isEditingText: state.active && state.canEdit,
			hasTextSelectionContext: state.active,
			resolvedDefaultStyle: getResolvedTextDefaultStyle(selectedTextElement?.defaultStyle),
		}
	}

	public restoreSelection(): void {
		this.canvas.textEditingManager.restoreSelection()
	}

	public setFillColor(color: string): boolean {
		return this.applyTextStyleCommand("rich-text-fill-color", {
			color,
		})
	}

	public setFontFamily(fontFamily: string): boolean {
		return this.applyTextStyleCommand("rich-text-font-family", {
			fontFamily,
		})
	}

	public setFontWeight(fontWeight: number): boolean {
		return this.applyTextStyleCommand("rich-text-font-style", {
			fontWeight,
		})
	}

	public setBold(bold: boolean): boolean {
		return this.applyTextStyleCommand("rich-text-bold", {
			bold,
			fontWeight: bold ? 700 : 400,
		})
	}

	public setItalic(italic: boolean): boolean {
		return this.applyTextStyleCommand("rich-text-italic", {
			italic,
		})
	}

	public setUnderline(underline: boolean): boolean {
		return this.applyTextStyleCommand(
			"rich-text-underline",
			underline ? { underline, strikethrough: false } : { underline },
		)
	}

	public setStrikethrough(strikethrough: boolean): boolean {
		return this.applyTextStyleCommand(
			"rich-text-strikethrough",
			strikethrough ? { strikethrough, underline: false } : { strikethrough },
		)
	}

	public setFontSize(fontSize: number): boolean {
		return this.applyTextStyleCommand("rich-text-font-size", {
			fontSize,
		})
	}

	public setLetterSpacing(letterSpacing: number | undefined): boolean {
		return this.applyTextStyleCommand("rich-text-letter-spacing", {
			letterSpacing,
		})
	}

	public setLineHeight(lineHeight: number | undefined): boolean {
		return this.applyParagraphStyleCommand("rich-text-line-height", {
			lineHeight,
		})
	}

	public setListType(listType: TextListTypeValue | null): boolean {
		return this.applyParagraphStyleCommand("rich-text-list-type", {
			listType: listType ?? undefined,
		})
	}

	public setTextAlign(textAlign: TextAlignValue): boolean {
		const toolbarState = this.getToolbarState()
		if (toolbarState.isEditingText) {
			const didApply = this.canvas.textEditingManager.applyParagraphStyle({
				align: textAlign,
			})
			if (didApply) {
				this.restoreSelectionAfterChange()
			}
			return didApply
		}

		if (toolbarState.hasTextSelectionContext || !toolbarState.selectedTextElement) {
			return false
		}

		const updatePayload = {
			content: setRichTextParagraphTextAlign(
				removeRichTextInlineStyles(toolbarState.selectedTextElement.content),
				textAlign,
			),
		}

		this.commitSelectedTextElement(
			"rich-text-text-align",
			toolbarState.selectedTextElement,
			updatePayload,
		)
		return true
	}

	private setupEventListeners(): void {
		this.canvas.eventEmitter.on("element:select", this.emitFormattingStateChange)
		this.canvas.eventEmitter.on("element:deselect", this.emitFormattingStateChange)
		this.canvas.eventEmitter.on("text:editing-state-change", this.emitFormattingStateChange)
		this.canvas.eventEmitter.on("document:restored", this.emitFormattingStateChange)
		this.canvas.eventEmitter.on("canvas:clear", this.emitFormattingStateChange)
		this.canvas.eventEmitter.on("element:updated", this.handleSelectedTextElementUpdate)
		this.canvas.eventEmitter.on("element:change", this.handleSelectedTextElementChange)
		this.canvas.eventEmitter.on("element:deleted", this.handleSelectedTextElementUpdate)
	}

	private getSelectedTextElement(): TextElement | null {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length !== 1) {
			return null
		}

		const [selectedId] = selectedIds
		const elementData = this.canvas.elementManager.getElementData(selectedId)
		if (!elementData || elementData.type !== ElementTypeEnum.Text) {
			return null
		}

		return elementData as TextElement
	}

	private applyTextStyleCommand(source: string, patch: Partial<TextStyle>): boolean {
		const toolbarState = this.getToolbarState()
		if (toolbarState.isEditingText) {
			const didApply = this.canvas.textEditingManager.applyTextStyle(patch)
			if (didApply) {
				this.restoreSelectionAfterChange()
			}
			return didApply
		}

		if (toolbarState.hasTextSelectionContext || !toolbarState.selectedTextElement) {
			return false
		}

		const updatePayload = {
			content: removeRichTextInlineStyles(toolbarState.selectedTextElement.content),
			defaultStyle: mergeTextDefaultStylePatch(
				toolbarState.selectedTextElement.defaultStyle,
				patch,
			),
		}

		this.commitSelectedTextElement(source, toolbarState.selectedTextElement, updatePayload)
		return true
	}

	private applyParagraphStyleCommand(
		source: string,
		patch: Partial<NonNullable<RichTextParagraph["style"]>>,
	): boolean {
		const toolbarState = this.getToolbarState()
		if (toolbarState.isEditingText) {
			const editorPatch: Partial<{
				align: TextAlignValue
				lineHeight: number | undefined
				paragraphSpacing: number
				listType: TextListTypeValue
			}> = {}
			if ("textAlign" in patch) {
				editorPatch.align = patch.textAlign
			}
			if ("lineHeight" in patch) {
				editorPatch.lineHeight = patch.lineHeight
			}
			if ("paragraphSpacing" in patch) {
				editorPatch.paragraphSpacing = patch.paragraphSpacing
			}
			if ("listType" in patch) {
				editorPatch.listType = patch.listType
			}
			const didApply = this.canvas.textEditingManager.applyParagraphStyle(editorPatch)
			if (didApply) {
				this.restoreSelectionAfterChange()
			}
			return didApply
		}

		if (toolbarState.hasTextSelectionContext || !toolbarState.selectedTextElement) {
			return false
		}

		this.commitSelectedTextElement(source, toolbarState.selectedTextElement, {
			content: setRichTextParagraphStyle(toolbarState.selectedTextElement.content, patch),
		})
		return true
	}

	private restoreSelectionAfterChange(): void {
		requestAnimationFrame(() => {
			this.restoreSelection()
		})
	}

	private commitSelectedTextElement(
		source: string,
		selectedTextElement: TextElement,
		updatePayload: Partial<Pick<TextElement, "content" | "defaultStyle">>,
	): void {
		this.canvas.elementManager.update(selectedTextElement.id, updatePayload)
	}
}
