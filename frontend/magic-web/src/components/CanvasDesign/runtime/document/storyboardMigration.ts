import type { CanvasDocument, LayerElement, StoryboardShot } from "./types"
import { ElementTypeEnum } from "./types"
import { cloneCanvasConnections } from "./connectionIndex"

export function normalizeStoryboardShot(shot: StoryboardShot): StoryboardShot {
	return {
		id: shot.id,
		description: shot.description,
		...(shot.outputImageElementId !== undefined
			? { outputImageElementId: shot.outputImageElementId }
			: {}),
	}
}

/**
 * Normalize storyboard DSL by removing deprecated shot fields such as durationSeconds.
 */
export function normalizeStoryboardDocument(doc: CanvasDocument): CanvasDocument {
	const normalizeElement = (element: LayerElement): LayerElement => {
		if (element.type === ElementTypeEnum.Storyboard) {
			return {
				...element,
				contents: element.contents.map((content) => ({
					...content,
					shots: content.shots?.map(normalizeStoryboardShot),
				})),
			}
		}

		if ("children" in element && Array.isArray(element.children)) {
			return { ...element, children: element.children.map(normalizeElement) }
		}

		return element
	}

	const elements = doc.elements?.map(normalizeElement)
	return {
		...doc,
		elements,
		...(doc.connections ? { connections: cloneCanvasConnections(doc.connections) } : {}),
	}
}
