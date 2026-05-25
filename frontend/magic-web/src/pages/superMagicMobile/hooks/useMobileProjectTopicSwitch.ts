import { useMemoizedFn } from "ahooks"

import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

interface UseMobileProjectTopicSwitchOptions {
	/** Explicit project id; falls back to `projectStore.selectedProject`. */
	projectId?: string | null
}

/**
 * Mobile project-topic navigation: sync route `topicId` with store selection.
 * Required so `lazy/TopicPage` restore effect does not overwrite a newly copied topic.
 */
export function useMobileProjectTopicSwitch(options: UseMobileProjectTopicSwitchOptions = {}) {
	const navigate = useNavigate()

	const switchToProjectTopic = useMemoizedFn((topic: Topic) => {
		if (!topic?.id) {
			topicStore.setSelectedTopic(topic)
			return
		}

		const resolvedProjectId = options.projectId ?? projectStore.selectedProject?.id
		if (!resolvedProjectId) {
			topicStore.setSelectedTopic(topic)
			return
		}

		// Update URL first to avoid lazy TopicPage restoring the previous route topicId.
		navigate({
			name: RouteName.SuperWorkspaceProjectTopicState,
			params: {
				projectId: resolvedProjectId,
				topicId: topic.id,
			},
		})
		topicStore.setSelectedTopic(topic)
	})

	return { switchToProjectTopic }
}
