import { observer } from "mobx-react-lite"
import { useMemo, useRef } from "react"
import type { WorkspaceSelectRef } from "../../../../components/WorkspaceSelect"
import WorkspaceSelect from "../../../../components/WorkspaceSelect"
import FlexBox from "@/components/base/FlexBox"
import { ChevronLeft } from "lucide-react"
import { PORTAL_IDS } from "@/constants"
import { useLocation, useParams } from "react-router"
import { RouteName } from "@/routes/constants"
import { routesMatch } from "@/routes/history/helpers"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { ProjectDetailHeader } from "./ProjectDetailHeader"
import useNavigate from "@/routes/hooks/useNavigate"
import {
	getMobileTopicPageCapabilities,
	MobileTopicPageKind,
} from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"
import { isCollaborationProject, isCollaborationWorkspace } from "@/pages/superMagic/constants"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { resolveProjectDetailHeaderActions } from "@/pages/superMagicMobile/utils/sharedProjectActionPolicy"
import {
	handleProjectTopicBackNavigation,
	navigateSuperMobileBack,
	resolveSuperMobileProjectDetailBackFallback,
} from "./backNavigation"

interface MainHeaderProps {
	/**
	 * Whether to show the back button
	 */
	showBackButton?: boolean
	/**
	 * Custom back button click handler
	 */
	onBackClick?: () => void
}

function MainHeader({ showBackButton, onBackClick }: MainHeaderProps) {
	const { projectId } = useParams()
	const location = useLocation()
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const navigate = useNavigate()

	const workspaceSelectRef = useRef<WorkspaceSelectRef>(null)

	const onProjectPage = showBackButton ?? !!projectId
	const routeName = routesMatch(location.pathname)?.route.name
	const isChatModeProjectPage = onProjectPage && routeName === RouteName.SuperChatProjectState
	const isProjectDetailPage = onProjectPage && routeName === RouteName.SuperWorkspaceProjectState
	const isProjectTopicPage =
		onProjectPage && routeName === RouteName.SuperWorkspaceProjectTopicState
	const projectTopicCapabilities = getMobileTopicPageCapabilities(
		MobileTopicPageKind.ProjectTopic,
	)
	const { canManageCollaborators } = useCollaboratorUpdatePanel({
		selectedProject: isProjectDetailPage ? selectedProject : null,
	})
	const projectDetailHeaderActions = useMemo(
		() =>
			isProjectDetailPage
				? resolveProjectDetailHeaderActions(selectedProject, { canManageCollaborators })
				: null,
		[canManageCollaborators, isProjectDetailPage, selectedProject],
	)

	if (isChatModeProjectPage) {
		return <></>
	}

	if (isProjectDetailPage || isProjectTopicPage) {
		// 项目话题子页的壳层头部应展示当前会话名；只有项目入口页才继续展示项目名和右侧动作组。
		const projectHeaderTitle = isProjectTopicPage
			? selectedTopic?.topic_name?.trim() || selectedProject?.project_name
			: selectedProject?.project_name
		// 项目话题子页只暴露一个“更多”槽位，协作管理仍只属于项目入口页。
		const projectHeaderActionsLayout = isProjectTopicPage ? "project-topic" : "project-entry"

		return (
			<ProjectDetailHeader
				title={projectHeaderTitle}
				showActions
				showActionCapsule={projectDetailHeaderActions?.showActionCapsule ?? true}
				actionSlots={projectDetailHeaderActions?.actionSlots}
				actionsLayout={projectHeaderActionsLayout}
				onBackClick={() => {
					if (
						isProjectTopicPage &&
						handleProjectTopicBackNavigation({
							projectId,
							projectTopicCapabilities,
							setSelectedTopic: topicStore.setSelectedTopic,
							navigate,
						})
					) {
						return
					}

					if (isProjectDetailPage) {
						const currentWorkspaceId =
							selectedWorkspace?.id || selectedProject?.workspace_id || ""
						const isSharedProjectDetail =
							isCollaborationWorkspace(selectedWorkspace) ||
							isCollaborationProject(selectedProject)
						const fallback = resolveSuperMobileProjectDetailBackFallback({
							workspaceId: currentWorkspaceId,
							isSharedProjectDetail,
						})

						if (fallback) {
							navigateSuperMobileBack({ navigate, fallback })
							return
						}
					}

					onBackClick?.()
				}}
			/>
		)
	}

	return (
		<div className="mobile-floating-page-header flex h-[50px] items-center gap-2 rounded-b-xl border-b bg-background p-2.5">
			{onProjectPage ? (
				<ChevronLeft
					size={32}
					onClick={onBackClick}
					className="cursor-pointer"
				/>
			) : null}
			<div className="flex-1 overflow-hidden">
				<WorkspaceSelect ref={workspaceSelectRef} />
			</div>
			{onProjectPage && (
				<FlexBox className="w-fit flex-[0_0_auto] items-center justify-center text-muted-foreground">
					<div
						className="flex flex-[0_0_auto] items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON}
					/>
					<div
						className="flex flex-[0_0_auto] items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON}
					/>
				</FlexBox>
			)}
		</div>
	)
}

export default observer(MainHeader)
