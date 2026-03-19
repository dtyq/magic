import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DetailRef } from "../../../components/Detail"
import type { RefObject } from "react"

interface UseTopicFilesParams {
	selectedProject: any
	selectedWorkspace: any
	selectedTopic: any
	projects: any[]
	workspaces: any[]
	attachments: any[]
	setAttachments: (attachments: any[]) => void
	setUserSelectDetail: (detail: any) => void
	detailRef: RefObject<DetailRef>
	isReadOnly: boolean
}

interface UseTopicFilesReturn {
	activeFileId: string | null
	handleFileClick: (fileItem?: any) => void
	topicFilesProps: {
		attachments: any[]
		setUserSelectDetail: (detail: any) => void
		onFileClick: (fileItem?: any) => void
		projectId: string | undefined
		activeFileId: string | null
		selectedTopic: any
		onAttachmentsChange: (attachments: any[]) => void
		allowEdit: boolean
		selectedWorkspace: any
		selectedProject: any
		projects: any[]
		workspaces: any[]
		isInProject: boolean
	}
	setActiveFileId: (fileId: string | null) => void
}

/**
 * Custom hook to manage topic files logic
 * Handles file selection, active file tracking, and read-only permissions
 */
export function useTopicFiles({
	selectedProject,
	selectedWorkspace,
	selectedTopic,
	projects,
	workspaces,
	attachments,
	setAttachments,
	setUserSelectDetail,
	detailRef,
	isReadOnly,
}: UseTopicFilesParams): UseTopicFilesReturn {
	// Track the currently active file ID
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

	// Subscribe to active file ID updates via PubSub
	useEffect(() => {
		const handleActiveFileIdUpdate = (fileId: string | null) => {
			console.log("🟢 Received activeFileId update via PubSub:", fileId)
			setActiveFileId(fileId)
		}

		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
		}
	}, [])

	/**
	 * Update active file ID - exposed for external updates
	 */
	const updateActiveFileId = useMemoizedFn((fileId: string | null) => {
		setActiveFileId(fileId)
	})

	/**
	 * Handle file click event
	 * Opens the file in the detail panel and updates active file state
	 */
	const handleFileClick = useMemoizedFn((fileItem?: any) => {
		setUserSelectDetail(null)

		// Use setTimeout to ensure the DOM is updated before opening tab
		setTimeout(() => {
			detailRef.current?.openFileTab?.(fileItem)
		}, 100)
	})

	// Prepare all props needed for TopicFilesButton component
	const topicFilesProps = {
		attachments,
		setUserSelectDetail,
		onFileClick: handleFileClick,
		projectId: selectedProject?.id,
		activeFileId,
		selectedTopic,
		onAttachmentsChange: setAttachments,
		allowEdit: !isReadOnly,
		selectedWorkspace,
		selectedProject,
		projects,
		workspaces,
		isInProject: true,
	}

	return {
		activeFileId,
		handleFileClick,
		topicFilesProps,
		setActiveFileId: updateActiveFileId,
	}
}
