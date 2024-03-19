import { lazy, Suspense } from "react"
import { useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { projectStore, topicStore } from "../stores/core"
import Navigate from "@/opensource/routes/components/Navigate"
import { RouteName } from "@/opensource/routes/constants"
import ProjectPageDesktopSkeleton from "./skeleton/ProjectPageDesktopSkeleton"
import ProjectPageMobileSkeleton from "./skeleton/ProjectPageMobileSkeleton"
import { isOwner, isReadOnlyProject } from "../utils/permission"
import superMagicService from "../services"
import { useUpdateEffect } from "ahooks"

const ProjectPageDesktop = lazy(
	() => import("@/opensource/pages/superMagic/pages/ProjectPage/index.desktop"),
)
const ProjectPageMobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/ProjectPage"),
)

const ProjectPage = observer(() => {
	const isMobile = useIsMobile()
	const { projectId } = useParams()

	// Load topic detail if needed
	useUpdateEffect(() => {
		// Skip if mobile or missing required params
		if (isMobile || !projectId) return

		// Check if we need to load topic
		const isReadOnly = isReadOnlyProject(projectStore.selectedProject?.user_role)
		const isOwnerRole = isOwner(projectStore.selectedProject?.user_role)
		const hasSelectedTopic = !!topicStore.selectedTopic

		// Skip if readonly project without selected topic
		if (isReadOnly && !hasSelectedTopic) return

		// Get the target topic ID
		const lastTopicId =
			topicStore.selectedTopic?.id ||
			(isOwnerRole ? projectStore.selectedProject?.current_topic_id : undefined)

		// Skip if no topic ID or already loaded
		if (!lastTopicId || topicStore.selectedTopic?.id === lastTopicId) return

		superMagicService.topic
			.getTopicDetail(lastTopicId)
			.then((topic) => {
				if (topic) {
					topicStore.setSelectedTopic(topic)
				}
			})
			.catch((error) => {
				console.error("Failed to load topic detail:", error)
			})
	}, [isMobile])

	// Handle mobile view
	if (isMobile) {
		return (
			<Suspense fallback={<ProjectPageMobileSkeleton />}>
				<ProjectPageMobile />
			</Suspense>
		)
	}

	// Handle desktop redirect to topic page
	if (projectId) {
		const isReadOnly = isReadOnlyProject(projectStore.selectedProject?.user_role)
		const hasSelectedTopic = !!topicStore.selectedTopic

		if (hasSelectedTopic || !isReadOnly) {
			const lastTopicId =
				topicStore.selectedTopic?.id || projectStore.selectedProject?.current_topic_id

			if (lastTopicId) {
				return (
					<Navigate
						name={RouteName.SuperWorkspaceProjectTopicState}
						params={{ projectId, topicId: lastTopicId }}
						replace
					/>
				)
			}
		}
	}

	// Default desktop view
	return (
		<Suspense fallback={<ProjectPageDesktopSkeleton />}>
			<ProjectPageDesktop />
		</Suspense>
	)
})

export default ProjectPage
