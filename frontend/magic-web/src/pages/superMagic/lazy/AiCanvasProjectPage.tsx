import { useEffect } from "react"
import { useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import { projectStore, topicStore } from "../stores/core"
import superMagicService from "../services"
import { useAiCanvasRouteRedirect } from "../hooks/useAiCanvasRouteRedirect"
import { isReadOnlyProject } from "../utils/permission"
import { ProjectTopicMapCache } from "../utils/superMagicCache"
import ProjectPage from "./ProjectPage"
import TopicPage from "./TopicPage"
import AiCanvasProjectPageDesktopSkeleton from "./skeleton/AiCanvasProjectPageDesktopSkeleton"

/**
 * Page of the AI canvas project route (`/super/ai-canvas/:projectId`). The address carries no
 * topic: topic switching only changes the store, and the topic page (which reads the store, not
 * the URL) switches to the canvas-only layout by the project's mode.
 *
 * When the project is selected without one of its topics (entered from a project-level link),
 * this page opens its last topic: the cached one, then the project's current topic; the service
 * falls back to the latest topic when that one is gone. Read-only projects without a topic keep
 * the project entry page, as on the generic route.
 */
const AiCanvasProjectPage = observer(function AiCanvasProjectPage() {
	const { projectId } = useParams()
	const project = projectStore.selectedProject
	const projectReady = Boolean(projectId) && project?.id === projectId
	const hasProjectTopic = topicStore.selectedTopic?.project_id === projectId
	const isReadOnly = isReadOnlyProject(project?.user_role)
	const needsTopic = projectReady && !hasProjectTopic && !isReadOnly

	useAiCanvasRouteRedirect()

	useEffect(() => {
		if (!needsTopic || !project) return
		let cancelled = false
		const preferredTopicId =
			ProjectTopicMapCache.get(userStore.user.userInfo, project.id) ||
			project.current_topic_id ||
			undefined

		superMagicService
			.getTopicDataByProject(project, preferredTopicId)
			.then((topic) => {
				// Ignore a late result after the user moved to another project.
				if (cancelled || !topic || projectStore.selectedProject?.id !== project.id) return
				topicStore.setSelectedTopic(topic)
			})
			.catch((error) => console.error("Failed to open the canvas project topic:", error))

		return () => {
			cancelled = true
		}
	}, [needsTopic, project])

	if (projectReady && isReadOnly && !hasProjectTopic) return <ProjectPage />
	return <TopicPage desktopSkeleton={<AiCanvasProjectPageDesktopSkeleton />} />
})

export default AiCanvasProjectPage
