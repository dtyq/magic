import { useEffect, useState } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { getFileContentsByIds } from "@/pages/superMagic/utils/api"
import { usePersonaResearchStore } from "../context"
import {
	attachmentVersionKey,
	getAttachmentPath,
	listLibraryFiles,
} from "../services/researchFiles"
import {
	TEMPLATE_CHATS_DIR,
	parseTemplateChatMarker,
	resolveTemplateChatState,
	type TemplateChatMarker,
	type TemplateChatState,
} from "../services/templateChats"

export interface TemplateChatEntry {
	marker: TemplateChatMarker
	markerFile: AttachmentItem
	topic: Topic
	state: Exclude<TemplateChatState, "done">
}

/** How often topic statuses are re-read while a template is generating in the background. */
const GENERATING_REFRESH_MS = 8000

/**
 * Template conversations that still need the user: generating, waiting for an answer, stopped,
 * or failed, newest first. Finished ones that produced a template drop out (the template card
 * shows instead), and markers whose topic was deleted are ignored.
 * Markers never change after they are written, so each is read once per file.
 */
export function useTemplateChats(): TemplateChatEntry[] {
	const store = usePersonaResearchStore()
	const markerFiles = listLibraryFiles(store.attachmentList, TEMPLATE_CHATS_DIR)
	const [markers, setMarkers] = useState<Map<string, TemplateChatMarker | null>>(new Map())
	const missingIds = markerFiles
		.map((item) => String(item.file_id ?? ""))
		.filter((id) => id && !markers.has(id))
	const missingKey = missingIds.join(",")

	useEffect(() => {
		if (!missingKey) return
		let cancelled = false
		const ids = missingKey.split(",")
		void getFileContentsByIds(ids, { responseType: "text", access: store.fileAccess })
			.then(({ successes }) => {
				if (cancelled) return
				setMarkers((current) => {
					const next = new Map(current)
					for (const id of ids) next.set(id, parseTemplateChatMarker(successes.get(id)))
					return next
				})
			})
			.catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [missingKey, store.fileAccess])

	// Cheap to rebuild: a handful of markers, and the caller is an observer of these lists.
	const templates = store.reportTemplates.map((item) => ({
		path: getAttachmentPath(item),
		version: attachmentVersionKey(item),
	}))
	const topicById = new Map(store.topicStore.topics.map((topic) => [String(topic.id), topic]))
	const entries: TemplateChatEntry[] = markerFiles
		.flatMap((markerFile) => {
			const marker = markers.get(String(markerFile.file_id ?? ""))
			const topic = marker ? topicById.get(marker.topic_id) : undefined
			if (!marker || !topic) return []
			const state = resolveTemplateChatState(marker, topic, templates)
			return state === "done" ? [] : [{ marker, markerFile, topic, state }]
		})
		.sort((a, b) => b.marker.started_at.localeCompare(a.marker.started_at))

	// Topic statuses may be stale when the page opens (a chat kept running after the panel
	// closed); read them once, then keep re-reading while one generates in the background.
	useEffect(() => {
		void store.refreshTopics().catch(() => undefined)
	}, [store])

	// Background conversations only report through topic status; re-read it while one runs.
	const generating = entries.some((entry) => entry.state === "generating")
	useEffect(() => {
		if (!generating) return
		const timer = window.setInterval(() => {
			void store.refreshTopics().catch(() => undefined)
		}, GENERATING_REFRESH_MS)
		return () => window.clearInterval(timer)
	}, [generating, store])

	return entries
}
