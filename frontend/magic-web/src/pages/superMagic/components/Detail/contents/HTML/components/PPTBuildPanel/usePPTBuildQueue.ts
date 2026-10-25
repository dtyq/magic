import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import type {
	HTMLEditorV2Ref,
	PPTBuildEntry,
	PPTBuildUpdate,
} from "../../iframe-bridge/types/props"

export function usePPTBuildQueue(
	editorRef: RefObject<HTMLEditorV2Ref>,
	contentRevision: number,
	onCommit?: () => Promise<boolean>,
) {
	const { t } = useTranslation("super")
	const [entries, setEntries] = useState<PPTBuildEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [failed, setFailed] = useState(false)
	const alive = useRef(false)
	const requestId = useRef(0)
	const pending = useRef(false)
	const reload = useCallback(async () => {
		const request = ++requestId.current
		try {
			const editor = editorRef.current
			if (!editor) throw new Error("Editor unavailable")
			const next = await editor.getPPTBuilds()
			if (!alive.current || request !== requestId.current) return
			setEntries(next)
			setFailed(false)
		} catch {
			if (alive.current && request === requestId.current) setFailed(true)
		} finally {
			if (alive.current && request === requestId.current) setLoading(false)
		}
	}, [editorRef])
	useEffect(() => {
		alive.current = true
		let active = true
		const editor = editorRef.current
		void editor?.setPPTBuildMarkers(true).catch(() => {
			if (active) magicToast.error(t("ppt.build.markersFailed"))
		})
		return () => {
			alive.current = false
			active = false
			// Runtime also removes markers on edit exit and document disposal.
			void editor?.setPPTBuildMarkers(false).catch(() => {
				/* The iframe may already have been disposed. */
			})
		}
	}, [editorRef, t])
	useEffect(() => {
		void reload()
	}, [contentRevision, reload])
	/** One serialized, persisted edit; a failed save rolls the editor back by one step. */
	const runCommitted = useCallback(
		async (apply: () => Promise<void>, rollback: () => Promise<void>) => {
			if (pending.current || !editorRef.current) return
			pending.current = true
			setBusy(true)
			let needsRollback = false
			try {
				await apply()
				needsRollback = Boolean(onCommit)
				// Browsing has no save toolbar: persist each completed queue operation.
				// A failed save rolls back this one atomic command rather than leaving
				// an invisible draft that could be lost when the sidebar closes.
				if (onCommit && !(await onCommit())) throw new Error("PPT_BUILD_SAVE_FAILED")
				needsRollback = false
				await reload()
			} catch {
				if (needsRollback) {
					await rollback().catch(() => {
						/* The slide may have been disposed. */
					})
					await reload()
				}
				if (alive.current) magicToast.error(t("ppt.build.saveFailed"))
			} finally {
				pending.current = false
				if (alive.current) setBusy(false)
			}
		},
		[editorRef, reload, onCommit, t],
	)
	const update = useCallback(
		async (updates: PPTBuildUpdate[]) => {
			const editor = editorRef.current
			if (!updates.length || !editor) return
			await runCommitted(
				() => editor.updatePPTBuilds(updates),
				() => editor.undo(),
			)
		},
		[editorRef, runCommitted],
	)
	const travel = useCallback(
		async (direction: "undo" | "redo") => {
			const editor = editorRef.current
			if (!editor) return
			await runCommitted(
				() => editor[direction](),
				() => editor[direction === "undo" ? "redo" : "undo"](),
			)
		},
		[editorRef, runCommitted],
	)
	return { entries, loading, busy, failed, update, travel, reload }
}
