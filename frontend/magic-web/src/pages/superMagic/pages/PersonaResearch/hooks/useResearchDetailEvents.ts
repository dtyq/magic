import { useEffect, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type {
	SuperMagicOpenFileTabByPathPayload,
	SuperMagicOpenFileTabPayload,
	SuperMagicOpenKnowledgeBaseTabPayload,
	SuperMagicOpenMicroAppTabPayload,
} from "@/pages/superMagic/events/openFileTab"
import type { SuperMagicOpenPlaybackTabPayload } from "@/pages/superMagic/events/openPlaybackTab"
import { useResearchFileDownload } from "./useResearchFileDownload"

/** The preview tab is force-mounted; wait one frame so a hidden panel has layout before opening. */
const DETAIL_OPEN_DELAY_MS = 100
/** A study without outputs has no results panel yet; revealing it mounts the preview a moment later. */
const DETAIL_READY_RETRY_MS = 50
const DETAIL_READY_MAX_TRIES = 20

/** Runs `open` once the preview is mounted, retrying for about a second after the panel is revealed. */
export function whenDetailReady(
	detailRef: RefObject<DetailRef>,
	open: (detail: DetailRef) => void,
	tries = 0,
) {
	if (detailRef.current) {
		open(detailRef.current)
		return
	}
	if (tries >= DETAIL_READY_MAX_TRIES) return
	window.setTimeout(() => whenDetailReady(detailRef, open, tries + 1), DETAIL_READY_RETRY_MS)
}

interface UseResearchDetailEventsOptions {
	detailRef: RefObject<DetailRef>
	attachmentList: AttachmentItem[]
	/** Claims contract files that have their own UI; returns true when handled. */
	routeFile: (file: unknown) => boolean
	/** Brings the "report and files" output tab into view before a preview opens. */
	revealFiles: () => void
	/** Off on phones: the mobile preview popup owns these events there. */
	enabled?: boolean
	setActiveFileId: (fileId: string | null) => void
	setAutoDetail: (detail: unknown) => void
}

const normalizePath = (path: string) => path.replace(/^\//, "")

/**
 * Message cards (tool calls, file mentions, citations, micro-app mentions) do not call the host
 * directly; they publish pubsub events that the page owning the preview must consume, as the topic
 * and project pages do. The research studio hosts that preview in its files tab.
 */
export function useResearchDetailEvents({
	detailRef,
	attachmentList,
	routeFile,
	revealFiles,
	setActiveFileId,
	setAutoDetail,
	enabled = true,
}: UseResearchDetailEventsOptions) {
	const downloadFile = useResearchFileDownload()

	const openInPreview = useMemoizedFn((open: (detail: DetailRef) => void) => {
		revealFiles()
		window.setTimeout(() => whenDetailReady(detailRef, open), DETAIL_OPEN_DELAY_MS)
	})

	const handleOpenFileTab = useMemoizedFn((payload: SuperMagicOpenFileTabPayload) => {
		const file = payload.fileData ?? attachmentList.find((i) => i.file_id === payload.fileId)
		if (file && routeFile(file)) return
		// Messages may pass temporary file data that is not in the attachment tree yet.
		openInPreview((detail) =>
			detail.openFileTab(payload.fileData ?? { file_id: payload.fileId }),
		)
	})

	const handleOpenPlaybackTab = useMemoizedFn((toolData: SuperMagicOpenPlaybackTabPayload) => {
		setActiveFileId(null)
		// A user click on a tool card always activates the playback tab.
		openInPreview((detail) => detail.openPlaybackTab({ toolData, forceActivate: true }))
	})

	const handleOpenFileTabByPath = useMemoizedFn((payload: SuperMagicOpenFileTabByPathPayload) => {
		// @file_path mentions carry only a workspace path; resolve it against the attachment list.
		const targetPath = normalizePath(payload.filePath)
		const matched = attachmentList.find(
			(item) => normalizePath(item.relative_file_path || "") === targetPath,
		)
		if (payload.action === "download") {
			downloadFile(matched?.file_id)
			return
		}
		const target = matched ?? {
			file_name: payload.fileName,
			relative_file_path: targetPath,
			file_path: targetPath,
		}
		if (routeFile(target)) return
		openInPreview((detail) => detail.openFileTab(target))
	})

	const handleOpenKnowledgeBaseTab = useMemoizedFn(
		(payload: SuperMagicOpenKnowledgeBaseTabPayload) => {
			openInPreview((detail) => detail.openKnowledgeBaseTab(payload))
		},
	)

	const handleOpenMicroAppTab = useMemoizedFn((payload: SuperMagicOpenMicroAppTabPayload) => {
		const appId = payload.appId?.trim()
		if (!appId) return
		openInPreview((detail) => detail.openMicroAppTab({ appId, appName: payload.appName }))
	})

	// Restored or switched file tabs report their file so the tab bar highlight stays in sync.
	const handleActiveFileIdUpdate = useMemoizedFn((fileId: string) => setActiveFileId(fileId))
	// Running tools push the live step shown by the playback tab.
	const handleAutoDetailUpdate = useMemoizedFn((detail: unknown) => setAutoDetail(detail))

	useEffect(() => {
		if (!enabled) return
		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
		pubsub.subscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
		pubsub.subscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
		pubsub.subscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, handleAutoDetailUpdate)
		return () => {
			// Remove only this page's listeners; other mounted hosts may share these events.
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
			pubsub.unsubscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
			pubsub.unsubscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, handleAutoDetailUpdate)
		}
	}, [
		enabled,
		handleActiveFileIdUpdate,
		handleAutoDetailUpdate,
		handleOpenFileTab,
		handleOpenFileTabByPath,
		handleOpenKnowledgeBaseTab,
		handleOpenMicroAppTab,
		handleOpenPlaybackTab,
	])
}
