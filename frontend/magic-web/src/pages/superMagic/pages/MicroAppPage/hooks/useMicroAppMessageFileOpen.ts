import { useEffect, useRef, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"

import type { DetailRef } from "@/pages/superMagic/components/Detail"
import { isStandalonePreviewFile } from "@/pages/superMagic/components/Detail/components/FilesViewer/hooks/previewPolicy"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type {
	OpenFileTabRecord,
	SuperMagicOpenFileTabPayload,
	SuperMagicOpenMicroAppTabPayload,
} from "@/pages/superMagic/events/openFileTab"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

import { getAttachmentId } from "../utils/microAppFiles"

interface PendingFileOpen {
	file: AttachmentItem | OpenFileTabRecord
	locateFileId?: string
}

interface PendingMicroAppOpen {
	appId: string
	appName?: string
}

interface UseMicroAppMessageFileOpenOptions {
	attachmentList: AttachmentItem[]
	detailRef: RefObject<DetailRef | null>
	isFilesViewActive: boolean
	showFilesView: () => void
	enabled?: boolean
}

const MICRO_APP_TAB_OPEN_DELAY_MS = 100

export function useMicroAppMessageFileOpen({
	attachmentList,
	detailRef,
	isFilesViewActive,
	showFilesView,
	enabled = true,
}: UseMicroAppMessageFileOpenOptions) {
	const pendingFileOpenRef = useRef<PendingFileOpen | null>(null)
	const pendingMicroAppOpenRef = useRef<PendingMicroAppOpen | null>(null)
	const microAppOpenTimerRef = useRef<number | null>(null)

	const clearMicroAppOpenTimer = useMemoizedFn(() => {
		if (microAppOpenTimerRef.current == null) return
		window.clearTimeout(microAppOpenTimerRef.current)
		microAppOpenTimerRef.current = null
	})

	const openPendingFile = useMemoizedFn(() => {
		const pendingFileOpen = pendingFileOpenRef.current
		if (!pendingFileOpen || !detailRef.current) return false

		detailRef.current.openFileTab(pendingFileOpen.file)
		if (pendingFileOpen.locateFileId) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, pendingFileOpen.locateFileId)
		}
		pendingFileOpenRef.current = null
		return true
	})

	const openPendingMicroApp = useMemoizedFn(() => {
		const pendingMicroAppOpen = pendingMicroAppOpenRef.current
		if (!pendingMicroAppOpen || !detailRef.current) return false

		const payload = pendingMicroAppOpen
		pendingMicroAppOpenRef.current = null
		clearMicroAppOpenTimer()
		microAppOpenTimerRef.current = window.setTimeout(() => {
			microAppOpenTimerRef.current = null
			detailRef.current?.openMicroAppTab?.(payload)
		}, MICRO_APP_TAB_OPEN_DELAY_MS)
		return true
	})

	const handleOpenFileTab = useMemoizedFn((payload: SuperMagicOpenFileTabPayload) => {
		const matchedFile = attachmentList.find((item) => getAttachmentId(item) === payload.fileId)
		const standaloneFile =
			payload.fileData && isStandalonePreviewFile(payload.fileData as AttachmentItem)
				? payload.fileData
				: undefined
		pendingMicroAppOpenRef.current = null
		clearMicroAppOpenTimer()
		pendingFileOpenRef.current = {
			file: standaloneFile ?? matchedFile ?? payload.fileData ?? { file_id: payload.fileId },
			locateFileId: standaloneFile ? undefined : matchedFile?.file_id,
		}

		if (isFilesViewActive && openPendingFile()) return
		showFilesView()
	})

	const handleOpenFileTabByPath = useMemoizedFn(
		(payload: { filePath?: string; fileName?: string; action?: "open" | "download" }) => {
			if (payload.action === "download" || !payload.filePath) return
			const targetPath = payload.filePath.replace(/^\//, "")
			const matchedFile = attachmentList.find(
				(item) => (item.relative_file_path || "").replace(/^\//, "") === targetPath,
			)
			if (!matchedFile?.file_id) return
			handleOpenFileTab({
				fileId: matchedFile.file_id,
				fileData: matchedFile,
			})
		},
	)

	const handleOpenMicroAppTab = useMemoizedFn((payload: SuperMagicOpenMicroAppTabPayload) => {
		const appId = payload.appId?.trim()
		if (!appId) return

		pendingFileOpenRef.current = null
		pendingMicroAppOpenRef.current = {
			appId,
			appName: payload.appName?.trim() || undefined,
		}

		if (isFilesViewActive && openPendingMicroApp()) return
		showFilesView()
	})

	useEffect(() => {
		if (!enabled) {
			clearMicroAppOpenTimer()
			pendingFileOpenRef.current = null
			pendingMicroAppOpenRef.current = null
			return
		}
		if (!isFilesViewActive) {
			clearMicroAppOpenTimer()
			return
		}
		openPendingFile()
		openPendingMicroApp()
	}, [clearMicroAppOpenTimer, enabled, isFilesViewActive, openPendingFile, openPendingMicroApp])

	useEffect(() => {
		if (!enabled) return
		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
		pubsub.subscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
			pubsub.unsubscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
			clearMicroAppOpenTimer()
		}
	}, [
		clearMicroAppOpenTimer,
		enabled,
		handleOpenFileTab,
		handleOpenFileTabByPath,
		handleOpenMicroAppTab,
	])
}
