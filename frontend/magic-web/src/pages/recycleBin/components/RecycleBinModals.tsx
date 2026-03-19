import type { TFunction } from "i18next"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import MoveProjectModal from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MoveProjectModal"
import CrossProjectFileOperationModal from "@/pages/superMagic/components/SelectPathModal/components/CrossProjectFileOperationModal"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import { DeleteModal } from "./DeleteModal"
import { RestoreModal } from "./RestoreModal"
import {
	getCategoryLabel,
	getDeleteModalDescription,
	getDeleteModalTitle,
	getRestoreModalTitle,
	getRestoreStatusMessage,
	type DeleteTarget,
	type RecycleBinItem,
	type RestoreCheckResult,
	type RestoreTarget,
	type SelectPathTarget,
} from "./recycle-bin-domain"

interface RecycleBinModalsProps {
	items: RecycleBinItem[]
	restoreTarget: RestoreTarget | null
	restoreCheckResult: RestoreCheckResult | null
	deleteTarget: DeleteTarget | null
	moveProjectModalOpen: boolean
	selectPathModalOpen: boolean
	selectPathTarget: SelectPathTarget | null
	selectPathSelectedWorkspace?: Workspace
	selectPathSelectedProject?: ProjectListItem
	workspaces: Workspace[]
	isMoveProjectLoading: boolean
	isPermanentDeleteLoading: boolean
	onRestoreOpenChange: (open: boolean) => void
	onDeleteOpenChange: (open: boolean) => void
	onConfirmRestore: () => void
	onConfirmDelete: () => void
	onMoveProjectClose: () => void
	onMoveProjectConfirm: (workspaceId: string) => void
	onSelectPathClose: () => void
	onSelectPathSubmit: (data: {
		targetProjectId: string
		targetPath: AttachmentItem[]
		targetAttachments: AttachmentItem[]
		sourceAttachments: AttachmentItem[]
	}) => void
	t: TFunction
}

export function RecycleBinModals({
	items,
	restoreTarget,
	restoreCheckResult,
	deleteTarget,
	moveProjectModalOpen,
	selectPathModalOpen,
	selectPathTarget,
	selectPathSelectedWorkspace,
	selectPathSelectedProject,
	workspaces,
	isMoveProjectLoading,
	isPermanentDeleteLoading,
	onRestoreOpenChange,
	onDeleteOpenChange,
	onConfirmRestore,
	onConfirmDelete,
	onMoveProjectClose,
	onMoveProjectConfirm,
	onSelectPathClose,
	onSelectPathSubmit,
	t,
}: RecycleBinModalsProps) {
	return (
		<>
			<RestoreModal
				open={restoreTarget !== null}
				onOpenChange={onRestoreOpenChange}
				title={getRestoreModalTitle(restoreTarget, t)}
				statusMessage={getRestoreStatusMessage(restoreCheckResult, restoreTarget, t, items)}
				confirmDisabled={
					restoreCheckResult?.status === "invalid" ||
					restoreCheckResult?.status === "error"
				}
				onConfirm={onConfirmRestore}
			/>

			<DeleteModal
				open={deleteTarget !== null}
				onOpenChange={onDeleteOpenChange}
				title={getDeleteModalTitle(deleteTarget, t)}
				description={getDeleteModalDescription(deleteTarget, t, (cat) =>
					getCategoryLabel(cat, t),
				)}
				onConfirm={onConfirmDelete}
				confirmLoading={isPermanentDeleteLoading}
			/>

			<MoveProjectModal
				selectedWorkspace={workspaceStore.selectedWorkspace}
				workspaces={workspaces}
				fetchWorkspaces={(params) => SuperMagicService.workspace.fetchWorkspaces(params)}
				open={moveProjectModalOpen}
				onClose={onMoveProjectClose}
				onConfirm={onMoveProjectConfirm}
				isMoveProjectLoading={isMoveProjectLoading}
			/>

			{selectPathTarget ? (
				<CrossProjectFileOperationModal
					visible={selectPathModalOpen}
					title={t("recycleBin.selectPath.title")}
					operationType="move"
					selectedWorkspace={selectPathSelectedWorkspace}
					selectedProject={selectPathSelectedProject}
					workspaces={workspaces}
					fileIds={[]}
					sourceAttachments={[]}
					onClose={onSelectPathClose}
					onSubmit={onSelectPathSubmit}
				/>
			) : null}
		</>
	)
}
