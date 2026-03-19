import { lazy, Suspense, useRef } from "react"
import { observer } from "mobx-react-lite"
import useStyles from "./style"
import IconWorkspaceProjectStar from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectStar"
import { IconKeyboard } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { TopicMode } from "../../pages/Workspace/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useDebounceFn } from "ahooks"
import ProjectItem, { ViewMode } from "./components/ProjectItem"
import ProjectItemSkeleton from "./components/ProjectItemSkeleton"
import CreateItem from "./components/CreateItem"
import projectStore from "../../stores/core/project"
import { ViewToggle } from "../WorkspacesMenu/components/CollaborationProjectsPanel/components"
import { useViewTogglePersistValue } from "../WorkspacesMenu/components/CollaborationProjectsPanel/components/ViewToggle/hooks"
import Slogan from "./components/Slogan"
import LazyCasesWrapper from "./components/LazyCasesWrapper"
import { workspaceStore } from "../../stores/core"
import SuperMagicService from "../../services"
import { isPrivateDeployment } from "@/utils/env"
import MessagePanelSkeleton from "./components/MessagePanelSkeleton"
import { preloadTopicPage } from "../../pages/TopicPage/utils"
import { cn } from "@/lib/utils"
import { useEmptyStateHandlers } from "../../hooks/useEmptyStateHandlers"
import useProjectItemActionProps from "./hooks/useProjectItemActionProps"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import EditionActivityBanner from "@/components/business/EditionActivity/Banner"

const MessagePanel = lazy(() => import("../MessagePanel"))

interface EmptyWorkspacePanelProps {
	messages: unknown[]
}

function EmptyWorkspacePanel({ messages }: EmptyWorkspacePanelProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	const isFetchingProjects = projectStore.isFetchingProjects
	const selectedWorkspace = workspaceStore.selectedWorkspace

	const projects = selectedWorkspace
		? projectStore.getProjectsByWorkspace(selectedWorkspace.id)
		: []

	const isPrivateDeploymentEnv = isPrivateDeployment()

	const { viewMode, setViewMode } = useViewTogglePersistValue({
		localStorageKey: "empty_workspace_panel_view_toggle_value",
	})

	const messagePanelContainerRef = useRef<HTMLDivElement>(null)

	const { run: handleCreateProjectDebounced } = useDebounceFn(
		() => {
			SuperMagicService.handleCreateProject({
				projectMode: TopicMode.Empty,
				isEditProject: false,
			})
		},
		{ wait: 300, leading: true, trailing: false },
	)

	const handleShowShortcutKeys = () => {
		pubsub.publish(PubSubEvents.Show_Shortcut_Keys)
	}
	const {
		projectModals,
		handleProjectClick,
		handleMoveProject,
		handleTransferProject,
		handleDeleteProjectConfirm,
		handleRenameProject,
		handlePinProject,
		onAddCollaborators,
		handleCancelWorkspaceShortcut,
	} = useProjectItemActionProps({ selectedWorkspace })

	// Use hook for empty state handlers
	const { handleSetSelectedProject, handleSetSelectedTopic } = useEmptyStateHandlers()

	return (
		<ScrollArea className="h-full w-full [&_[data-slot='scroll-area-viewport']>div]:!block">
			<Slogan />

			<Suspense fallback={<MessagePanelSkeleton className="mx-auto max-w-[980px]" />}>
				<MessagePanel
					messages={messages}
					taskData={null}
					showLoading={false}
					size="default"
					selectedProject={null}
					setSelectedProject={handleSetSelectedProject}
					selectedTopic={null}
					setSelectedTopic={handleSetSelectedTopic}
					isEmptyStatus
					containerRef={messagePanelContainerRef}
					className={styles.messagePanel}
					classNames={{
						editorWrapper: cn(
							"mx-auto flex max-w-[960px] flex-col gap-2 rounded-2xl border border-muted-foreground bg-white p-2",
						),
						editor: "rounded-[10px] border-gray-300 shadow-none ",
						editorContent: "min-h-[78px]",
					}}
					selectedWorkspace={selectedWorkspace}
				/>
			</Suspense>

			<div className={styles.content}>
				{!isPrivateDeploymentEnv && <EditionActivityBanner />}

				{/* 项目列表 */}
				<div className={styles.pojectsWrapper}>
					<div className={styles.projectsTitle}>
						<div className={styles.projectsTitleLeft}>
							<IconWorkspaceProjectStar size={32} />
							<div>{t("project.workspaceProjects")}</div>
						</div>
						<div className={styles.projectsTitleRight}>
							<ViewToggle value={viewMode} onChange={setViewMode} />
						</div>
					</div>
					<div className={styles.projectsList}>
						<CreateItem
							onCreateProject={handleCreateProjectDebounced}
							viewMode={viewMode}
						/>
						{isFetchingProjects ? (
							<>
								{Array.from({ length: viewMode === ViewMode.GRID ? 3 : 7 }).map(
									(_, index) => (
										<ProjectItemSkeleton key={index} viewMode={viewMode} />
									),
								)}
							</>
						) : (
							<>
								{projects.map((item, index) => {
									return (
										<ProjectItem
											key={item.id}
											index={index}
											project={item}
											viewMode={viewMode}
											onClick={handleProjectClick}
											onRenameProject={handleRenameProject}
											onDeleteProject={handleDeleteProjectConfirm}
											onMoveProject={handleMoveProject}
											onTransferProject={handleTransferProject}
											onPinProject={handlePinProject}
											onAddCollaborators={onAddCollaborators}
											onCancelWorkspaceShortcut={
												handleCancelWorkspaceShortcut
											}
											onMouseEnter={() => preloadTopicPage()}
										/>
									)
								})}
							</>
						)}
					</div>
				</div>

				{!isPrivateDeploymentEnv && <LazyCasesWrapper />}
			</div>

			<div className={styles.shortcutKeysButton} onClick={handleShowShortcutKeys}>
				<IconKeyboard size={20} />
			</div>

			{projectModals}
		</ScrollArea>
	)
}

export default observer(EmptyWorkspacePanel)
