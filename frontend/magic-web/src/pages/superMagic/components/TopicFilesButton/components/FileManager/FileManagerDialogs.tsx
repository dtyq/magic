import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import { SelectDirectoryModal } from "../../../SelectPathModal"
import CrossProjectFileOperationModal from "../../../SelectPathModal/components/CrossProjectFileOperationModal"
import ImportFromOtherProjectModal from "../../../SelectPathModal/components/ImportFromOtherProjectModal"
import workspaceStore from "../../../../stores/core/workspace"
import ShareModal from "../../../Share/Modal"
import ShareSuccessModal from "../../../Share/FileShareModal/ShareSuccessModal"
import SimilarSharesDialog from "../../../Share/SimilarSharesDialog"
import { ShareMode, ShareType } from "../../../Share/types"
import { generateShareUrl } from "../../../ShareManagement/utils/shareTypeHelpers"
import { DuplicateFileModal } from "../DuplicateFileModal"
import { FolderConflictModal, type FolderConflictModalProps } from "../FolderConflictModal"
import { FileManagerConfirmationDialog } from "./FileManagerConfirmationDialog"
import { FileManagerPreparationDialog } from "./FileManagerPreparationDialog"
import { FileManagerNameDialog } from "./FileManagerNameDialog"
import type { FileManagerProps } from "./types"
import type { useFileManagerOperations } from "../../hooks/useFileManagerOperations"

/** 原操作 hooks 的对话框统一挂载在管理器内，所有触发方式共用同一个确认流程。 */
export function FileManagerDialogs({
	manager,
	controller,
}: {
	manager: FileManagerProps
	controller: ReturnType<typeof useFileManagerOperations>
}) {
	const { t } = useTranslation("super")
	const { operations, share, move, crossProject, importOperation, duplicate } = controller
	let folderConflict: FolderConflictModalProps | null = null
	if (duplicate.folderConflictModalVisible)
		folderConflict = {
			visible: true,
			folderName: duplicate.currentFolderName,
			totalConflicts: duplicate.totalFolderConflicts,
			canMerge: duplicate.canMergeFolderConflict,
			onCancel: duplicate.handleFolderConflictCancel,
			onMerge: duplicate.handleFolderConflictMerge,
			onKeepBoth: duplicate.handleFolderConflictKeepBoth,
			onReplace: duplicate.handleFolderConflictReplace,
		}
	else
		for (const operation of [move, crossProject, importOperation]) {
			if (!operation.folderConflictModalVisible) continue
			folderConflict = {
				visible: true,
				folderName: operation.currentFolderConflictName,
				totalConflicts: operation.totalFolderConflicts,
				canMerge: operation.canMergeFolderConflict,
				onCancel: operation.handleFolderConflictCancel,
				onMerge: operation.handleFolderConflictMerge,
				onKeepBoth: operation.handleFolderConflictKeepBoth,
			}
			break
		}
	const directorySource = manager.spaceConfig?.directorySource
	const success = share.shareSuccessInfo?.shareInfo
	return (
		<>
			<FileManagerPreparationDialog controller={controller} />
			<FileManagerConfirmationDialog controller={controller.confirmation} />
			<FileManagerNameDialog names={controller.names} />
			{controller.info.fileInfoPanel}
			{controller.imageDownload.agreementModal}
			{controller.aiCard.dialogElement}
			{controller.batch.deleteConfirmNode}
			{controller.menu.deleteConfirmNode}
			<SelectDirectoryModal
				{...move.selectorConfig}
				onSubmit={controller.confirmMoveWithPreparation}
			/>
			{directorySource && (
				<SelectDirectoryModal
					{...controller.copy.selectorConfig}
					disabledFolderIds={controller.copy.pendingCopyFileIds}
					onSubmit={async ({ path }) => {
						await controller.crossProjectWithPreparation("copy", {
							fileIds: controller.copy.pendingCopyFileIds,
							targetProjectId: "",
							targetPath: path.length ? path : [directorySource.root],
							sourceAttachments: manager.attachments,
							targetAttachments: manager.attachments,
						})
						controller.copy.hideCopySelector()
					}}
				/>
			)}
			{manager.selectedProject && (
				<CrossProjectFileOperationModal
					visible={crossProject.visible}
					title={
						crossProject.operationType === "move"
							? t("topicFiles.contextMenu.moveTo")
							: t("topicFiles.contextMenu.copyTo")
					}
					operationType={crossProject.operationType}
					selectedWorkspace={controller.selectedWorkspace ?? undefined}
					selectedProject={manager.selectedProject}
					workspaces={workspaceStore.workspaces}
					fileIds={crossProject.fileIds}
					sourceAttachments={manager.attachments}
					sourceAttachmentsLoading={manager.loading}
					initialPath={crossProject.initialPath}
					onClose={crossProject.closeModal}
					onSubmit={
						crossProject.operationType === "move"
							? (data) => controller.crossProjectWithPreparation("move", data)
							: (data) => controller.crossProjectWithPreparation("copy", data)
					}
				/>
			)}
			{manager.projectId && (
				<ImportFromOtherProjectModal
					visible={importOperation.visible}
					workspaces={workspaceStore.workspaces}
					currentProjectId={manager.projectId}
					currentProject={manager.selectedProject ?? null}
					targetPath={importOperation.targetPath}
					targetAttachments={manager.attachments}
					onClose={importOperation.closeModal}
					onSubmit={importOperation.executeImportOperation}
				/>
			)}
			{folderConflict && <FolderConflictModal {...folderConflict} />}
			<DuplicateFileModal {...controller.duplicateProps} />
			<Dialog
				open={move.failures.length > 0}
				onOpenChange={(open) => {
					if (!open) move.clearFailures()
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("userSpace.operationFailed")}</DialogTitle>
					</DialogHeader>
					<ul className="max-h-80 overflow-auto text-sm">
						{move.failures.map(({ file, message }) => (
							<li key={file.file_id}>
								{file.file_name}：{message}
							</li>
						))}
					</ul>
					<Button onClick={move.clearFailures}>{t("common.confirm")}</Button>
				</DialogContent>
			</Dialog>
			{operations.shareFileInfo && (
				<ShareModal
					open={operations.shareModalVisible}
					onCancel={() => {
						operations.setShareModalVisible(false)
						operations.setShareFileInfo(null)
					}}
					shareMode={ShareMode.File}
					types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
					attachments={manager.attachments}
					resourceId={operations.shareFileInfo.resourceId || success?.resource_id}
					defaultSelectedFileIds={operations.shareFileInfo.fileIds}
					projectName={operations.shareFileInfo.projectName}
					projectId={manager.projectId}
				/>
			)}
			{success && (
				<ShareSuccessModal
					open
					onClose={share.closeSuccessModal}
					onCancelShare={share.handleCancelShare}
					onEditShare={share.handleEditShare}
					shareName={success.resource_name || ""}
					projectName={success.project_name}
					fileCount={success.extend?.file_count || 1}
					mainFileName={success.main_file_name || t("share.untitled")}
					shareUrl={generateShareUrl(success.resource_id, success.password, "files")}
					password={success.password}
					expire_at={success.expire_at}
					shareType={success.share_type}
					shareProject={success.share_project}
					fileIds={success.file_ids}
					createdAt={success.created_at}
					updatedAt={success.updated_at}
					viewCount={success.view_count}
				/>
			)}
			{share.similarSharesInfo && (
				<SimilarSharesDialog
					open
					onClose={share.closeSimilarSharesDialog}
					shares={share.similarSharesInfo.similarShares}
					onSelectShare={share.handleSelectSimilarShare}
					onCreateNew={share.handleCreateNewShare}
				/>
			)}
		</>
	)
}
