import { useCallback, useMemo, useState } from "react"
import type { TextStyle } from "../../../../runtime/document/types"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useCanvasEvent } from "../../../../app/hooks/canvas"
import {
	createInactiveTextEditorFormattingState,
	type TextAlignValue,
	type TextEditorFormattingState,
} from "../../../../runtime/text/editorFormatting"

interface RichTextEditorToolActions {
	applyTextStyle: (patch: Partial<TextStyle>) => void
	applyParagraphStyle: (patch: Partial<{ align: TextAlignValue; lineHeight: number }>) => void
	restoreSelection: () => void
}

interface RichTextEditorToolResult extends RichTextEditorToolActions {
	state: TextEditorFormattingState
	isActive: boolean
}

export function useRichTextEditorTools(): RichTextEditorToolResult {
	const { canvas } = useCanvas()
	const [revision, setRevision] = useState(0)

	useCanvasEvent(
		"text:editing-state-change",
		() => {
			setRevision((value) => value + 1)
		},
		[],
	)

	const state = useMemo(() => {
		if (!canvas) {
			return createInactiveTextEditorFormattingState()
		}
		return canvas.textEditingManager.getFormattingState()
	}, [canvas, revision])

	const applyTextStyle = useCallback(
		(patch: Partial<TextStyle>) => {
			canvas?.textEditingManager.applyTextStyle(patch)
		},
		[canvas],
	)

	const applyParagraphStyle = useCallback(
		(patch: Partial<{ align: TextAlignValue; lineHeight: number }>) => {
			canvas?.textEditingManager.applyParagraphStyle(patch)
		},
		[canvas],
	)

	const restoreSelection = useCallback(() => {
		canvas?.textEditingManager.restoreSelection()
	}, [canvas])

	return {
		state,
		isActive: state.active && state.canEdit,
		applyTextStyle,
		applyParagraphStyle,
		restoreSelection,
	}
}
