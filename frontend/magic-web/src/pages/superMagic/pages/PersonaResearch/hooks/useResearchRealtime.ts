import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import type { PersonaResearchStore } from "../store/research-store"

/** Polling interval while a study runs; realtime events remain the primary update path. */
const RUNNING_POLL_INTERVAL_MS = 8000

/**
 * Keeps research files current.
 *
 * | Source                     | When                                   |
 * | File-change websocket      | always, primary path                   |
 * | Polling every 8s           | only while the selected study is running |
 * | Full re-read               | page visible again / bfcache restore / back online |
 *
 * Re-reads keep the rendered panels until new data has been parsed (see reloadParsedContent).
 */
export function useResearchRealtime(store: PersonaResearchStore, isStudyRunning: boolean) {
	const projectId = store.selectedProject?.id
	const previousRun = useRef({ projectId, running: isStudyRunning })
	useEffect(() => {
		const previous = previousRun.current
		previousRun.current = { projectId, running: isStudyRunning }
		// A final chat answer can land between the last poll and task completion. Reconcile once
		// after completion through the existing data owner; never replay the submitted question.
		if (projectId && previous.projectId === projectId && previous.running && !isStudyRunning) {
			void store.refreshAttachments().catch(() => undefined)
		}
	}, [projectId, isStudyRunning, store])

	const handleAttachments = useMemoizedFn(
		({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
			store.setAttachments(tree, list)
		},
	)

	useProjectAttachmentsChangeRealtime({
		projectId,
		store: store.projectFilesStore,
		onAttachmentsChange: handleAttachments,
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime research attachments:", error)
		}),
	})

	const { startPolling, stopPolling } = useAttachmentsPolling({
		projectId,
		store: store.projectFilesStore,
		interval: RUNNING_POLL_INTERVAL_MS,
		autoStart: false,
		onAttachmentsChange: handleAttachments,
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll research attachments:", error)
		}),
	})

	useEffect(() => {
		if (!projectId || !isStudyRunning) return
		startPolling()
		return () => stopPolling()
	}, [isStudyRunning, projectId, startPolling, stopPolling])

	useEffect(() => {
		if (!projectId) return
		const recover = () => {
			if (document.visibilityState !== "visible") return
			void store.refreshAttachments().catch(() => undefined)
			void store.refreshTopics().catch(() => undefined)
		}
		const handlePageShow = (event: PageTransitionEvent) => {
			if (event.persisted) recover()
		}
		document.addEventListener("visibilitychange", recover)
		window.addEventListener("pageshow", handlePageShow)
		window.addEventListener("online", recover)
		return () => {
			document.removeEventListener("visibilitychange", recover)
			window.removeEventListener("pageshow", handlePageShow)
			window.removeEventListener("online", recover)
		}
	}, [projectId, store])
}
