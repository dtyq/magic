import { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/utils/cn"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"

import type { MicroAppWorkspaceView } from "./MicroAppWorkspaceNav"

const MicroAppDatabasePanel = lazy(() => import("./MicroAppDatabasePanel"))
const MicroAppSkillsWorkspace = lazy(() => import("./MicroAppSkillsWorkspace"))
const MicroAppScheduledTasksPanel = lazy(
	() => import("./MicroAppScheduledTasksPanel/MicroAppScheduledTasksPanel"),
)
const ShareManagementPanel = lazy(
	() => import("@/pages/superMagic/components/ShareManagement/ShareManagementPanel"),
)
const UserSpacePanel = lazy(() => import("@/pages/superMagic/components/UserSpace/UserSpacePanel"))

interface MicroAppProjectPanelsProps {
	placement?: "workspace" | "sidebar"
	activeView: MicroAppWorkspaceView
	attachmentList?: AttachmentItem[]
	canEdit?: boolean
	projectId?: string
	projectRole?: CollaboratorPermission
	workspaceId?: string
	workspaceName?: string
	projectName?: string
	topicId?: string
	activeUserFileId?: string | null
	onUserFileClick?: (fileItem: AttachmentItem) => void
}

const PROJECT_PANEL_VIEWS: MicroAppWorkspaceView[] = ["skills", "scheduledTasks", "shareManagement"]

const PROJECT_PANEL_CLASS_NAME = cn(
	"h-full gap-0",
	"[&_[data-slot=project-panel-header]]:h-12",
	"[&_[data-slot=project-panel-header]]:border-b",
	"[&_[data-slot=project-panel-header]]:border-border",
	"[&_[data-slot=project-panel-header]]:px-4",
	"[&_[data-slot=project-panel-header]]:py-0",
	"[&_[data-slot=project-panel-title]]:block",
	"[&_[data-slot=project-panel-title]]:text-base",
	"[&_[data-slot=project-panel-title]]:font-semibold",
	"[&_[data-slot=project-panel-title]]:leading-6",
	"[&_[data-slot=project-panel-tabs]]:ml-auto",
	"[&_[data-slot=project-panel-tabs]]:mr-2",
	"[&_[data-slot=project-panel-toolbar]]:h-12",
	"[&_[data-slot=project-panel-toolbar]]:border-b",
	"[&_[data-slot=project-panel-toolbar]]:border-border",
	"[&_[data-slot=project-panel-toolbar]]:px-4",
	"[&_[data-slot=project-panel-toolbar]]:py-2",
	"[&_[data-slot=project-panel-content]]:px-0",
	"[&_[data-slot=project-panel-content]]:pb-0",
	"[&_[data-slot=project-panel-empty]]:rounded-none",
	"[&_[data-slot=project-panel-empty]]:border-0",
	"[&_[data-layout=share-management-content]>div]:gap-0",
	"[&_[data-layout=share-management-content]>div]:p-0",
)

function PanelLoading() {
	return (
		<div
			className="flex h-full items-center justify-center"
			data-testid="micro-app-panel-loading"
		>
			<Loader2 className="size-6 animate-spin text-muted-foreground" />
		</div>
	)
}

export default function MicroAppProjectPanels({
	activeView,
	attachmentList = [],
	canEdit = false,
	placement = "workspace",
	projectId,
	projectRole,
	workspaceId,
	workspaceName,
	projectName,
	topicId,
	activeUserFileId,
	onUserFileClick,
}: MicroAppProjectPanelsProps) {
	const isProjectPanelActive = PROJECT_PANEL_VIEWS.includes(activeView)
	if (placement === "sidebar")
		return activeView === "userSpace" ? (
			<Suspense fallback={<PanelLoading />}>
				<UserSpacePanel
					projectId={projectId}
					projectName={projectName}
					topicId={topicId}
					activeFileId={activeUserFileId}
					onFileClick={onUserFileClick}
				/>
			</Suspense>
		) : null

	return (
		<>
			<div
				className={cn(
					"absolute inset-0 overflow-hidden",
					activeView !== "database" && "hidden",
				)}
				aria-hidden={activeView !== "database"}
				data-testid="micro-app-database-workspace"
			>
				<Suspense fallback={<PanelLoading />}>
					<MicroAppDatabasePanel
						active={activeView === "database"}
						projectId={projectId}
						projectRole={projectRole}
					/>
				</Suspense>
			</div>

			{isProjectPanelActive ? (
				<div
					className="absolute inset-0 overflow-hidden bg-background"
					data-testid="micro-app-project-panel-workspace"
				>
					<Suspense fallback={<PanelLoading />}>
						{activeView === "skills" ? (
							<MicroAppSkillsWorkspace
								attachmentList={attachmentList}
								canEdit={canEdit}
							/>
						) : null}
						{activeView === "scheduledTasks" ? (
							<MicroAppScheduledTasksPanel
								className={PROJECT_PANEL_CLASS_NAME}
								selectWorkspaceId={workspaceId}
								selectProjectId={projectId}
								selectTopicId={topicId}
								workspaceName={workspaceName}
								projectName={projectName}
							/>
						) : null}
						{activeView === "shareManagement" ? (
							<ShareManagementPanel
								className={PROJECT_PANEL_CLASS_NAME}
								projectId={projectId}
							/>
						) : null}
					</Suspense>
				</div>
			) : null}
		</>
	)
}
