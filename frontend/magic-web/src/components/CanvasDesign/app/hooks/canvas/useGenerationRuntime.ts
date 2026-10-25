import { useSyncExternalStore } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import type {
	GenerationRuntimeTargetState,
	GenerationSubmissionRuntimeState,
} from "../../../runtime/generation/GenerationRuntimeManager"

export function useGenerationRuntime(
	elementId: string | null,
	contentId?: string | null,
): GenerationRuntimeTargetState | null {
	const { canvas } = useCanvas()
	const manager = canvas?.generationRuntimeManager
	const targetContentId = contentId ?? undefined

	return useSyncExternalStore(
		(listener) => {
			if (!manager || !elementId) return () => undefined
			return manager.subscribeElement(elementId, listener)
		},
		() => (manager && elementId ? manager.getTargetState(elementId, targetContentId) : null),
		() => null,
	)
}

export function useGenerationRuntimeRevision(elementId: string | null): number {
	const { canvas } = useCanvas()
	const manager = canvas?.generationRuntimeManager

	return useSyncExternalStore(
		(listener) => {
			if (!manager || !elementId) return () => undefined
			return manager.subscribeElement(elementId, listener)
		},
		() => (manager && elementId ? manager.getRevision(elementId) : 0),
		() => 0,
	)
}

export function useGenerationSubmissionState(
	elementId: string | null,
	contentId?: string | null,
): GenerationSubmissionRuntimeState | null {
	const { canvas } = useCanvas()
	const manager = canvas?.generationRuntimeManager
	const targetContentId = contentId ?? undefined

	return useSyncExternalStore(
		(listener) => {
			if (!manager || !elementId) return () => undefined
			return manager.subscribeElement(elementId, listener)
		},
		() =>
			manager && elementId ? manager.getSubmissionState(elementId, targetContentId) : null,
		() => null,
	)
}
