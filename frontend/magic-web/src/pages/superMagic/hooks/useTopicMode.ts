import { useEffect, useState } from "react"
import { ProjectListItem, Topic, TopicMode } from "../pages/Workspace/types"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import ProjectTopicService from "@/services/superMagic/ProjectTopicService"
import { useIsMobile } from "@/hooks/useIsMobile"

function useTopicMode({
	selectedTopic,
	selectedProject,
}: {
	selectedTopic: Topic | undefined | null
	selectedProject: ProjectListItem | undefined | null
}) {
	const isMobile = useIsMobile()
	const [topicMode, setTopicMode] = useState<TopicMode>(
		selectedTopic?.topic_mode ||
		ProjectTopicService.getProjectDefaultTopicMode(
			selectedProject?.workspace_id || "",
			selectedProject?.id || "",
		) ||
		TopicMode.General,
	)

	useEffect(() => {
		/**
		 * 移动端不能使用聊天模式
		 */
		if (isMobile && topicMode === TopicMode.Chat) {
			setTopicMode(TopicMode.General)
		}
	}, [topicMode, isMobile])

	useDeepCompareEffect(() => {
		setTopicMode(
			selectedTopic?.topic_mode ||
			ProjectTopicService.getProjectDefaultTopicMode(
				selectedProject?.workspace_id || "",
				selectedProject?.id || "",
			) ||
			TopicMode.General,
		)
	}, [selectedTopic, selectedProject])

	const handleSetTopicMode = useMemoizedFn((mode: TopicMode) => {
		setTopicMode(mode)
		if (selectedProject?.workspace_id && selectedProject?.id) {
			ProjectTopicService.setProjectDefaultTopicMode(
				selectedProject?.workspace_id,
				selectedProject?.id,
				mode,
			)
		}
	})

	return { topicMode, setTopicMode: handleSetTopicMode }
}

export default useTopicMode
