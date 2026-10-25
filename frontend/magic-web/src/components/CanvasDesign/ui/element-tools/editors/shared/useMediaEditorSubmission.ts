import { useCallback, useMemo, useState } from "react"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useGenerationSubmissionState } from "../../../../app/hooks/canvas"
import type {
	GenerationSubmissionPhase,
	GenerationSubmissionRuntimeState,
} from "../../../../runtime/generation/GenerationRuntimeManager"
import { generateUUID } from "../../../../runtime/shared/ids"
import { resolveMediaEditorSubmissionVisibility } from "./mediaEditorSubmissionVisibility"

export interface MediaEditorSubmissionResult {
	accepted: boolean
}

export interface MediaEditorSubmissionControls {
	submissionId: string
	setPhase: (phase: GenerationSubmissionPhase) => void
}

export interface MediaEditorSubmissionRunOptions {
	initialPhase: GenerationSubmissionPhase
	execute: (controls: MediaEditorSubmissionControls) => Promise<MediaEditorSubmissionResult>
}

export interface MediaEditorSubmissionController {
	hidden: boolean
	busy: boolean
	activeSubmission: GenerationSubmissionRuntimeState | null
	begin: (phase: GenerationSubmissionPhase) => string
	setPhase: (submissionId: string, phase: GenerationSubmissionPhase) => void
	finish: (submissionId: string, accepted: boolean) => void
	run: (options: MediaEditorSubmissionRunOptions) => Promise<MediaEditorSubmissionResult>
	reveal: () => void
}

interface DismissedSubmission {
	targetKey: string
	submissionId: string
}

function getTargetKey(elementId: string, contentId?: string): string {
	return `${elementId}\u0000${contentId ?? ""}`
}

/**
 * Owns the editor-facing side of a transient generation submission. The Canvas
 * runtime stores the phase for other surfaces; this hook also remembers that a
 * successfully submitted editor must stay closed after the backend accepts it.
 */
export function useMediaEditorSubmission(options: {
	elementId: string
	contentId?: string
	isGenerating: boolean
	isTimedOut: boolean
	isRetryEditing: boolean
}): MediaEditorSubmissionController {
	const { canvas } = useCanvas()
	const { elementId, contentId, isGenerating, isTimedOut, isRetryEditing } = options
	const targetKey = getTargetKey(elementId, contentId)
	const activeSubmission = useGenerationSubmissionState(elementId, contentId)
	const [dismissedSubmission, setDismissedSubmission] = useState<DismissedSubmission | null>(null)

	const reveal = useCallback(() => {
		setDismissedSubmission((current) => (current?.targetKey === targetKey ? null : current))
	}, [targetKey])

	const begin = useCallback(
		(phase: GenerationSubmissionPhase) => {
			const manager = canvas?.generationRuntimeManager
			const submissionId =
				manager?.beginSubmission({
					elementId,
					...(contentId !== undefined ? { contentId } : {}),
					phase,
				}) ?? `${targetKey}:${generateUUID()}`
			setDismissedSubmission({ targetKey, submissionId })
			return submissionId
		},
		[canvas, contentId, elementId, targetKey],
	)

	const setPhase = useCallback(
		(submissionId: string, phase: GenerationSubmissionPhase) => {
			canvas?.generationRuntimeManager?.updateSubmissionPhase(submissionId, phase)
		},
		[canvas],
	)

	const finish = useCallback(
		(submissionId: string, accepted: boolean) => {
			if (!accepted) {
				setDismissedSubmission((current) =>
					current?.submissionId === submissionId ? null : current,
				)
			}
			canvas?.generationRuntimeManager?.clearSubmission(submissionId)
		},
		[canvas],
	)

	const run = useCallback(
		async (runOptions: MediaEditorSubmissionRunOptions) => {
			const submissionId = begin(runOptions.initialPhase)

			let accepted = false
			try {
				const result = await runOptions.execute({
					submissionId,
					setPhase: (phase) => setPhase(submissionId, phase),
				})
				accepted = result.accepted
				return result
			} finally {
				finish(submissionId, accepted)
			}
		},
		[begin, finish, setPhase],
	)

	const hidden = resolveMediaEditorSubmissionVisibility({
		hasActiveSubmission: Boolean(activeSubmission),
		hasDismissedSubmission: dismissedSubmission?.targetKey === targetKey,
		isGenerating,
		isTimedOut,
		isRetryEditing,
	})
	const busy = !isTimedOut && !isRetryEditing && (Boolean(activeSubmission) || isGenerating)

	return useMemo(
		() => ({ hidden, busy, activeSubmission, begin, setPhase, finish, run, reveal }),
		[hidden, busy, activeSubmission, begin, setPhase, finish, run, reveal],
	)
}
