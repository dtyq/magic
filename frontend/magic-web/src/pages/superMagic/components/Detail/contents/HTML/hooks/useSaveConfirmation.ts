import { useEffect, useState } from "react"
import { useFileSaveStatus } from "../../../hooks/useFileSaveStatus"
import { FILE_SAVE_STATUS } from "../../../services/fileSaveQueue"

export type SaveConfirmationStage = "idle" | "saving" | "saved"

export const SAVED_HOLD_MS = 1500

/**
 * One continuous save feedback: saving -> saved. `saved` is held until
 * `settled`, so preview refreshes triggered by the save stay inside it
 * instead of surfacing as separate notices.
 */
export function useSaveConfirmation(fileId: string | undefined, settled: boolean) {
	const status = useFileSaveStatus(fileId)
	const isPersisting = status === FILE_SAVE_STATUS.Saving || status === FILE_SAVE_STATUS.Retrying
	const [stage, setStage] = useState<SaveConfirmationStage>(isPersisting ? "saving" : "idle")

	const [trackedFileId, setTrackedFileId] = useState(fileId)
	if (trackedFileId !== fileId) {
		setTrackedFileId(fileId)
		setStage(isPersisting ? "saving" : "idle")
	}

	useEffect(() => {
		if (isPersisting) setStage("saving")
		// Failed saves are reported by the sync badge; never claim success.
		else if (status === FILE_SAVE_STATUS.Failed) setStage("idle")
		else setStage((current) => (current === "saving" ? "saved" : current))
	}, [isPersisting, status])

	useEffect(() => {
		if (stage !== "saved" || !settled) return
		const timer = setTimeout(() => setStage("idle"), SAVED_HOLD_MS)
		return () => clearTimeout(timer)
	}, [stage, settled])

	return stage
}
