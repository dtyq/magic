import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { useMemo } from "react"
import { useCurrentRecordingSessionIdentity } from "@/components/business/RecordingSummary/internal/editorRuntime"

export function useIsCurrentRecording(
	selectedTopic: Topic | null,
	selectedProject: ProjectListItem | null,
	selectedWorkspace: Workspace | null | undefined,
) {
	const currentSession = useCurrentRecordingSessionIdentity()

	const isCurrentRecording = useMemo(() => {
		if (selectedTopic) {
			return (
				currentSession.workspaceId === selectedWorkspace?.id &&
				currentSession.projectId === selectedProject?.id &&
				currentSession.topicId === selectedTopic?.id
			)
		}

		return false
	}, [
		currentSession.projectId,
		currentSession.topicId,
		currentSession.workspaceId,
		selectedProject?.id,
		selectedTopic,
		selectedWorkspace?.id,
	])

	return isCurrentRecording
}
