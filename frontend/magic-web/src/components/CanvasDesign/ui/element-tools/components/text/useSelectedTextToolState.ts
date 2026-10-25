import { useMemo } from "react"
import type { TextEditorFormattingState } from "../../../../runtime/text/editorFormatting"
import { ElementTypeEnum, type TextElement } from "../../../../runtime/document/types"
import { useCanvasUI } from "../../../../app/providers/CanvasUIProvider"

export function useSelectedTextToolState(
	state: Pick<TextEditorFormattingState, "active" | "canEdit">,
) {
	const { selectedElements } = useCanvasUI()

	const selectedTextElement = useMemo(() => {
		if (selectedElements.length !== 1) {
			return null
		}

		const [element] = selectedElements
		return element?.type === ElementTypeEnum.Text ? (element as TextElement) : null
	}, [selectedElements])

	return {
		selectedTextElement,
		isEditingText: state.active && state.canEdit,
		hasTextSelectionContext: state.active,
	}
}
