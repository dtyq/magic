import { useMemoizedFn } from "ahooks"
import { projectStore, topicStore } from "../stores/core"
import type { ProjectListItem, Topic } from "../pages/Workspace/types"

/**
 * Hook for handling project and topic selection in empty state (no selected project/topic)
 * Used in EmptyWorkspacePanel (Desktop) and WorkspacePage (Mobile)
 */
export function useEmptyStateHandlers() {
	/**
	 * Set selected project and clear topics list
	 * This is used when selecting a project in empty state
	 */
	const handleSetSelectedProject = useMemoizedFn((project: ProjectListItem | null) => {
		projectStore.setSelectedProject(project)
		// Clear topics list when switching projects in empty state
		topicStore.setTopics([])
	})

	/**
	 * Set selected topic and update topics list
	 * This is used when selecting a topic in empty state
	 */
	const handleSetSelectedTopic = useMemoizedFn((topic: Topic | null) => {
		if (topic) {
			topicStore.setSelectedTopic(topic)
			// Set topics list to only the selected topic in empty state
			topicStore.setTopics([topic])
		}
	})

	return {
		handleSetSelectedProject,
		handleSetSelectedTopic,
	}
}
