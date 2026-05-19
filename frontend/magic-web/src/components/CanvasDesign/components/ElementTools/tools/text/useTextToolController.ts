import { useCallback, useMemo, useState } from "react"
import type { TextAlignValue, TextListTypeValue } from "../../../../canvas/text/editorFormatting"
import { createInactiveTextFormattingToolbarState } from "../../../../canvas/interaction/TextFormattingManager"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasEvent } from "../../../../hooks/useCanvasEvent"

export function useTextToolController() {
	const { canvas } = useCanvas()
	const [revision, setRevision] = useState(0)

	useCanvasEvent(
		"text:formatting-state-change",
		() => {
			setRevision((value) => value + 1)
		},
		[],
	)

	const toolbarState = useMemo(() => {
		if (!canvas) {
			return createInactiveTextFormattingToolbarState()
		}
		return canvas.textFormattingManager.getToolbarState()
	}, [canvas, revision])

	const restoreSelection = useCallback(() => {
		canvas?.textFormattingManager.restoreSelection()
	}, [canvas])

	const setFillColor = useCallback(
		(color: string): boolean => {
			return canvas?.textFormattingManager.setFillColor(color) ?? false
		},
		[canvas],
	)

	const setFontFamily = useCallback(
		(fontFamily: string): boolean => {
			return canvas?.textFormattingManager.setFontFamily(fontFamily) ?? false
		},
		[canvas],
	)

	const setFontWeight = useCallback(
		(fontWeight: number): boolean => {
			return canvas?.textFormattingManager.setFontWeight(fontWeight) ?? false
		},
		[canvas],
	)

	const setBold = useCallback(
		(bold: boolean): boolean => {
			return canvas?.textFormattingManager.setBold(bold) ?? false
		},
		[canvas],
	)

	const setItalic = useCallback(
		(italic: boolean): boolean => {
			return canvas?.textFormattingManager.setItalic(italic) ?? false
		},
		[canvas],
	)

	const setUnderline = useCallback(
		(underline: boolean): boolean => {
			return canvas?.textFormattingManager.setUnderline(underline) ?? false
		},
		[canvas],
	)

	const setStrikethrough = useCallback(
		(strikethrough: boolean): boolean => {
			return canvas?.textFormattingManager.setStrikethrough(strikethrough) ?? false
		},
		[canvas],
	)

	const setFontSize = useCallback(
		(fontSize: number): boolean => {
			return canvas?.textFormattingManager.setFontSize(fontSize) ?? false
		},
		[canvas],
	)

	const setLetterSpacing = useCallback(
		(letterSpacing: number | undefined): boolean => {
			return canvas?.textFormattingManager.setLetterSpacing(letterSpacing) ?? false
		},
		[canvas],
	)

	const setLineHeight = useCallback(
		(lineHeight: number | undefined): boolean => {
			return canvas?.textFormattingManager.setLineHeight(lineHeight) ?? false
		},
		[canvas],
	)

	const setTextAlign = useCallback(
		(textAlign: TextAlignValue): boolean => {
			return canvas?.textFormattingManager.setTextAlign(textAlign) ?? false
		},
		[canvas],
	)

	const setListType = useCallback(
		(listType: TextListTypeValue | null): boolean => {
			return canvas?.textFormattingManager.setListType(listType) ?? false
		},
		[canvas],
	)

	return {
		...toolbarState,
		restoreSelection,
		setFillColor,
		setFontFamily,
		setFontWeight,
		setBold,
		setItalic,
		setUnderline,
		setStrikethrough,
		setFontSize,
		setLetterSpacing,
		setLineHeight,
		setTextAlign,
		setListType,
	}
}
