import { lazy, Suspense, useEffect, useState } from "react"
import { useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import { projectStore, topicStore } from "../stores/core"
import Navigate from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import ProjectPageDesktopSkeleton from "./skeleton/ProjectPageDesktopSkeleton"
import ProjectPageMobileSkeleton from "./skeleton/ProjectPageMobileSkeleton"
import { isOwner, isReadOnlyProject } from "../utils/permission"
import superMagicService from "../services"
import { useUpdateEffect } from "ahooks"
import type { ProjectListItem } from "../pages/Workspace/types"
import {
	ensureChatWorkspaceId,
	getCachedChatWorkspaceId,
} from "@/pages/superMagic/hooks/useChatWorkspace"

const ProjectPageDesktop = lazy(() => import("@/pages/superMagic/pages/ProjectPage/index.desktop"))
const ProjectPageMobile = lazy(() => import("@/pages/superMagicMobile/pages/ProjectPage"))

/**
 * 判断 topicStore 是否已是「目标项目」下的非空话题列表，用于避免与 switchProjectInMobile 等路径重复请求。
 */
function hasLoadedNonEmptyTopicsForProject(targetProjectId: string): boolean {
	const topics = topicStore.topics
	if (topics.length === 0) return false
	return topics.every((t) => t.project_id === targetProjectId)
}

/**
 * 移动端项目详情就绪后按需补拉话题列表；只读项目不拉。与 getTopicsByProjectId 的 pending 同参去重协同处理并发。
 */
function tryFetchProjectTopicsIfNeeded(project: ProjectListItem): void {
	if (isReadOnlyProject(project.user_role)) return
	if (hasLoadedNonEmptyTopicsForProject(project.id)) return
	void superMagicService.topic.fetchTopics({
		projectId: project.id,
		isAutoSelect: false,
		page: 1,
	})
}

function isChatWorkspaceProject(
	project: Pick<ProjectListItem, "workspace_id"> | null | undefined,
	chatWorkspaceId: string | null,
): boolean {
	return Boolean(project && chatWorkspaceId && project.workspace_id === chatWorkspaceId)
}

const ProjectPage = observer(() => {
	const isMobile = useIsMobile()
	const { projectId } = useParams()
	const [chatWorkspaceId, setChatWorkspaceId] = useState<string | null>(() =>
		getCachedChatWorkspaceId(),
	)
	const [isResolvingChatWorkspaceId, setIsResolvingChatWorkspaceId] = useState(() =>
		Boolean(isMobile && projectId && getCachedChatWorkspaceId() == null),
	)
	const selectedProject = projectStore.selectedProject

	/**
	 * 移动端刷新时优先按当前 projectId 回补项目上下文，避免先渲染出旧项目内容。
	 */
	useEffect(() => {
		if (!isMobile || !projectId) return
		let isCancelled = false

		const resolveChatWorkspaceId = async () => {
			const cachedWorkspaceId = getCachedChatWorkspaceId()
			if (cachedWorkspaceId != null) {
				if (!isCancelled) {
					setChatWorkspaceId(cachedWorkspaceId)
					setIsResolvingChatWorkspaceId(false)
				}
				return cachedWorkspaceId
			}

			if (!isCancelled) {
				setIsResolvingChatWorkspaceId(true)
			}

			const resolvedWorkspaceId = await ensureChatWorkspaceId()
			if (!isCancelled) {
				setChatWorkspaceId(resolvedWorkspaceId)
				setIsResolvingChatWorkspaceId(false)
			}
			return resolvedWorkspaceId
		}

		const restoreMobileProject = async () => {
			let currentProject =
				projectStore.selectedProject?.id === projectId ? projectStore.selectedProject : null

			if (!currentProject) {
				currentProject = await superMagicService.project.getProjectDetail(projectId, {
					enableErrorMessagePrompt: false,
				})
				if (isCancelled || !currentProject || currentProject.id !== projectId) return
				projectStore.setSelectedProject(currentProject)
			}

			const resolvedChatWorkspaceId = await resolveChatWorkspaceId()
			if (isCancelled) return

			if (isChatWorkspaceProject(currentProject, resolvedChatWorkspaceId)) {
				return
			}

			tryFetchProjectTopicsIfNeeded(currentProject)
		}

		void restoreMobileProject().catch((error) => {
			if (!isCancelled) {
				setIsResolvingChatWorkspaceId(false)
			}
			console.error("Failed to restore mobile project detail:", error)
		})

		return () => {
			isCancelled = true
		}
	}, [isMobile, projectId])

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
		if (projectId && isChatWorkspaceProject(selectedProject, chatWorkspaceId)) {
			const chatTopicId =
				topicStore.selectedTopic?.project_id === projectId
					? topicStore.selectedTopic.id
					: selectedProject?.current_topic_id
			return (
				<Navigate
					name={RouteName.SuperChatProjectState}
					params={{ projectId, topicId: chatTopicId }}
					replace
				/>
			)
		}

		if (projectId && (selectedProject?.id !== projectId || isResolvingChatWorkspaceId)) {
			return <ProjectPageMobileSkeleton />
		}

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
