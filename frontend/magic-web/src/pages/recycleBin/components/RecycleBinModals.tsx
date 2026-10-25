import type { TFunction } from "i18next"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import MoveProjectModal from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MoveProjectModal"
import CrossProjectFileOperationModal from "@/pages/superMagic/components/SelectPathModal/components/CrossProjectFileOperationModal"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import { DeleteModal } from "./DeleteModal"
import { NameConflictRestoreModal } from "./NameConflictRestoreModal"
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
	projectFileMode?: boolean
	isActionPending?: boolean
	requireDeleteConfirmation?: boolean
	items: RecycleBinItem[]
	restoreTarget: RestoreTarget | null
	restoreCheckResult: RestoreCheckResult | null
	pendingNameConflictRestore: {
		fileName: string
		pendingCount: number
	} | null
	deleteTarget: DeleteTarget | null
	moveProjectModalOpen: boolean
	selectPathModalOpen: boolean
	selectPathTarget: SelectPathTarget | null
	selectPathSelectedWorkspace?: Workspace
	selectPathSelectedProject?: ProjectListItem
	workspaces: Workspace[]
	isMoveProjectLoading: boolean
	isPermanentDeleteLoading: boolean
	isResolvingAllNameConflicts: boolean
	onRestoreOpenChange: (open: boolean) => void
	onDeleteOpenChange: (open: boolean) => void
	onConfirmRestore: () => void
	onNameConflictRestoreCancel: () => void
	onNameConflictRestoreReplace: (applyToRemaining: boolean) => void
	onNameConflictRestoreSkip: (applyToRemaining: boolean) => void
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
	projectFileMode = false,
	isActionPending = false,
	requireDeleteConfirmation = false,
	items,
	restoreTarget,
	restoreCheckResult,
	pendingNameConflictRestore,
	deleteTarget,
	moveProjectModalOpen,
	selectPathModalOpen,
	selectPathTarget,
	selectPathSelectedWorkspace,
	selectPathSelectedProject,
	workspaces,
	isMoveProjectLoading,
	isPermanentDeleteLoading,
	isResolvingAllNameConflicts,
	onRestoreOpenChange,
	onDeleteOpenChange,
	onConfirmRestore,
	onNameConflictRestoreCancel,
	onNameConflictRestoreReplace,
	onNameConflictRestoreSkip,
	onConfirmDelete,
	onMoveProjectClose,
	onMoveProjectConfirm,
	onSelectPathClose,
	onSelectPathSubmit,
	t,
}: RecycleBinModalsProps) {
	const deleteItems =
		deleteTarget?.kind === "item"
			? [deleteTarget.item]
			: items.filter((item) => deleteTarget?.itemIds.includes(item.id))
	const restoreItems =
		restoreTarget?.kind === "item"
			? [restoreTarget.item]
			: items.filter((item) => restoreTarget?.itemIds.includes(item.id))
	const folderNotice =
		projectFileMode && restoreItems.some((item) => item.fileKind === "folder")
			? t("recycleBin.project.folderOnly")
			: ""
	return (
		<>
			<RestoreModal
				open={restoreTarget !== null}
				onOpenChange={onRestoreOpenChange}
				title={getRestoreModalTitle(restoreTarget, t)}
				statusMessage={[
					getRestoreStatusMessage(restoreCheckResult, restoreTarget, t, items),
					folderNotice,
				]
					.filter(Boolean)
					.join("\n")}
				confirmDisabled={
					(projectFileMode && isActionPending) ||
					restoreCheckResult?.status === "invalid" ||
					restoreCheckResult?.status === "error"
				}
				onConfirm={onConfirmRestore}
			/>

			<DeleteModal
				items={requireDeleteConfirmation ? deleteItems : undefined}
				confirmationPhrase={
					requireDeleteConfirmation
						? t("fileManager.recycle.permanentPhrase", { count: deleteItems.length })
						: undefined
				}
				open={deleteTarget !== null}
				onOpenChange={onDeleteOpenChange}
				title={getDeleteModalTitle(deleteTarget, t)}
				description={[
					projectFileMode
						? t("recycleBin.project.deleteDescription", { count: deleteItems.length })
						: getDeleteModalDescription(deleteTarget, t, (cat) =>
								getCategoryLabel(cat, t),
							),
					projectFileMode && deleteItems.some((item) => item.fileKind === "folder")
						? t("recycleBin.project.folderOnly")
						: "",
				]
					.filter(Boolean)
					.join("\n")}
				onConfirm={onConfirmDelete}
				confirmLoading={isPermanentDeleteLoading}
			/>

			<NameConflictRestoreModal
				open={pendingNameConflictRestore !== null}
				fileName={pendingNameConflictRestore?.fileName ?? ""}
				pendingCount={pendingNameConflictRestore?.pendingCount ?? 0}
				isResolvingAll={isResolvingAllNameConflicts}
				onCancel={onNameConflictRestoreCancel}
				onReplace={onNameConflictRestoreReplace}
				onSkip={onNameConflictRestoreSkip}
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
