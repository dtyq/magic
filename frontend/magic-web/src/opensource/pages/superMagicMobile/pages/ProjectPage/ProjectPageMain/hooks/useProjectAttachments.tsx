import { useBoolean, useMemoizedFn } from "ahooks"
import { useEffect, useRef } from "react"
import { useAttachments } from "../../../../components/HierarchicalWorkspacePopup/hooks"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { TopicFilesCoreRef } from "@/opensource/pages/superMagic/components/TopicFilesButton/TopicFilesCore"
import type { PreviewDetail } from "../../../../components/PreviewDetailPopup"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"

interface UseProjectAttachmentsParams {
	selectedProject?: ProjectListItem | null
	selectedWorkspace?: Workspace | null
	selectedTopic?: Topic | null
	currentTopics: Topic[]
	projects: ProjectListItem[]
	workspaces: Workspace[]
	setUserSelectDetail?: (detail: PreviewDetail | null) => void
}

export function useProjectAttachments({ selectedProject }: UseProjectAttachmentsParams) {
	const [attachmentVisible, { setTrue: _openAttachmentPopup, setFalse: _closeAttachmentPopup }] =
		useBoolean(false)

	// Attachments management
	const {
		attachments,
		attachmentList,
		handleDownloadAll,
		allLoading,
		updateAttachments,
		clearAttachments,
		setAttachments,
	} = useAttachments()

	useEffect(() => {
		const handleUpdateAttachments = (callback: any) => {
			if (selectedProject) {
				updateAttachments(selectedProject, callback)
			}
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [selectedProject, updateAttachments])

	// TopicFilesCore ref
	const topicFilesCoreRef = useRef<TopicFilesCoreRef>(null)

	const closeAttachmentPopup = useMemoizedFn(() => {
		_closeAttachmentPopup()
		// Reset TopicFilesCore states
		setTimeout(() => {
			topicFilesCoreRef.current?.resetAllStates()
		}, 0)
	})

	const openAttachmentPopup = useMemoizedFn(() => {
		if (!selectedProject) return
		updateAttachments(selectedProject)
		_openAttachmentPopup()
	})

	const handleUpdateAttachments = useMemoizedFn(() => {
		if (selectedProject) {
			updateAttachments(selectedProject)
		}
	})

	return {
		attachments,
		attachmentVisible,
		attachmentList,
		openAttachmentPopup,
		closeAttachmentPopup,
		handleDownloadAll,
		allLoading,
		updateAttachments,
		clearAttachments,
		handleUpdateAttachments,
		setAttachments,
	}
}
