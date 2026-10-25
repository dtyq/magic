import type { ImageModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import type { SelectionContentSnapshot } from "../selection/selectionContentCollector"
import { createElementFromSelectionConnection } from "./selectionConnectionCreation"
import {
	completeStoryboardConnectionCreation,
	createStoryboardConnectionElement,
	getStoryboardConnectionCreateSize,
} from "./storyboardConnectionCreation"

export function getStoryboardSelectionCreateSize(): { width: number; height: number } {
	return getStoryboardConnectionCreateSize()
}

export interface CreateStoryboardFromSelectionOptions {
	snapshot: SelectionContentSnapshot
	imageModelList: ImageModelItem[]
	x: number
	y: number
}

export function createStoryboardFromSelection(
	context: CreateStoryboardFromSelectionOptions & { canvas: Canvas },
): string | null {
	const { canvas, snapshot } = context
	if (snapshot.imageSequence.length < 1 || !snapshot.allRootsCanConnect) return null

	return createElementFromSelectionConnection({
		canvas,
		snapshot,
		originSide: "right",
		createElement: () => createStoryboardConnectionElement(canvas, context),
		afterConnect: ({ createdElementId: elementId }) => {
			completeStoryboardConnectionCreation(canvas, elementId)
		},
	})
}
