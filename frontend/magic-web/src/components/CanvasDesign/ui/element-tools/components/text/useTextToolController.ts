import { useCallback, useMemo, useState } from "react"
import type { TextAlignValue, TextListTypeValue } from "../../../../runtime/text/editorFormatting"
import { createInactiveTextFormattingToolbarState } from "../../../../runtime/interaction/text-editing/TextFormattingManager"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useCanvasEvent } from "../../../../app/hooks/canvas"
import { ElementToolTypeEnum } from "../../../../public/props"
import { useElementToolResolution } from "../../model/ElementToolResolutionContext"

export function useTextToolController() {
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()
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
			if (tool?.id !== ElementToolTypeEnum.TextFillColor) return false
			void tool.execute?.({ color })
			return true
		},
		[tool],
	)

	const setFontFamily = useCallback(
		(fontFamily: string): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextFontFamily) return false
			void tool.execute?.({ fontFamily })
			return true
		},
		[tool],
	)

	const setFontWeight = useCallback(
		(fontWeight: number): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextFontStyle) return false
			void tool.execute?.({ fontWeight })
			return true
		},
		[tool],
	)

	const setBold = useCallback(
		(bold: boolean): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextFontStyle) return false
			void tool.execute?.({ bold })
			return true
		},
		[tool],
	)

	const setItalic = useCallback(
		(italic: boolean): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextFontStyle) return false
			void tool.execute?.({ italic })
			return true
		},
		[tool],
	)

	const setUnderline = useCallback(
		(underline: boolean): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAdvanced) return false
			void tool.execute?.({ underline })
			return true
		},
		[tool],
	)

	const setStrikethrough = useCallback(
		(strikethrough: boolean): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAdvanced) return false
			void tool.execute?.({ strikethrough })
			return true
		},
		[tool],
	)

	const setFontSize = useCallback(
		(fontSize: number): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextFontSize) return false
			void tool.execute?.({ fontSize })
			return true
		},
		[tool],
	)

	const setLetterSpacing = useCallback(
		(letterSpacing: number | undefined): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAdvanced) return false
			void tool.execute?.({ letterSpacing })
			return true
		},
		[tool],
	)

	const setLineHeight = useCallback(
		(lineHeight: number | undefined): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAdvanced) return false
			void tool.execute?.({ lineHeight })
			return true
		},
		[tool],
	)

	const setTextAlign = useCallback(
		(textAlign: TextAlignValue): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAlign) return false
			void tool.execute?.({ textAlign })
			return true
		},
		[tool],
	)

	const setListType = useCallback(
		(listType: TextListTypeValue | null): boolean => {
			if (tool?.id !== ElementToolTypeEnum.TextAdvanced) return false
			void tool.execute?.({ listType })
			return true
		},
		[tool],
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
