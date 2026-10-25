import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { PPTNotesAction } from "../components/PPTNotesActions"
import type { PPTSpeakerNotesPanelProps } from "../components/pptNotesTypes"

/** A generation belongs to one file and one draft; late responses never replace newer edits. */
export function usePPTNotesAI({
	fileId,
	draft,
	rawContent,
	enabled,
	generate,
}: {
	fileId: string
	draft: string
	rawContent: string
	enabled: boolean
	generate: PPTSpeakerNotesPanelProps["onGenerate"]
}) {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<"failed" | "changed" | undefined>()
	const request = useRef<AbortController>()
	const latest = useRef({ fileId, draft, rawContent, enabled })
	latest.current = { fileId, draft, rawContent, enabled }
	const cancel = useMemoizedFn(() => {
		request.current?.abort()
		request.current = undefined
		setBusy(false)
	})
	useEffect(() => {
		if (!enabled) cancel()
	}, [enabled, cancel])
	useEffect(() => {
		setBusy(false)
		setError(undefined)
		return () => {
			request.current?.abort()
			request.current = undefined
		}
	}, [fileId])

	const run = useMemoizedFn(
		async (action: PPTNotesAction, instruction?: string): Promise<string | undefined> => {
			if (!generate || !enabled || request.current) return
			const controller = new AbortController()
			const snapshot = latest.current
			request.current = controller
			setBusy(true)
			setError(undefined)
			try {
				const result = await generate(
					action,
					fileId,
					draft,
					controller.signal,
					...(instruction ? [instruction] : []),
				)
				if (request.current !== controller || controller.signal.aborted) return
				const current = latest.current
				if (
					!current.enabled ||
					current.fileId !== snapshot.fileId ||
					current.draft !== snapshot.draft ||
					current.rawContent !== snapshot.rawContent
				) {
					setError("changed")
					return
				}
				return result
			} catch {
				if (request.current === controller && !controller.signal.aborted) setError("failed")
			} finally {
				if (request.current === controller) {
					request.current = undefined
					setBusy(false)
				}
			}
		},
	)
	return { busy, error, run, cancel }
}
