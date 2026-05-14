import { memo } from "react"
import ShareModal from "@/pages/superMagic/components/Share/Modal"
import ShareSuccessModal from "@/pages/superMagic/components/Share/FileShareModal/ShareSuccessModal"
import SimilarSharesDialog from "@/pages/superMagic/components/Share/SimilarSharesDialog"
import SimilarSharesDrawer from "@/pages/superMagic/components/Share/SimilarSharesDrawer"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { projectStore } from "@/pages/superMagic/stores/core"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"

interface FileShareModalsProps {
	/** Share modal visibility */
	shareModalVisible: boolean
	/** Close share modal */
	onCloseShareModal: () => void
	/** Success modal visibility */
	showSuccessModal: boolean
	/** Existing share info */
	existingShareInfo: any | null
	/** Current file */
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
		projectId?: string
		projectName?: string
	}
	/** Share file ID */
	shareFileId?: string
	/** Attachments list */
	attachments?: AttachmentItem[]
	/** Cancel share handler */
	onCancelShare: () => void
	/** Edit share handler */
	onEditShare: () => void
	/** Close success modal */
	onCloseSuccessModal: () => void
	/** Similar shares dialog visibility */
	showSimilarSharesDialog: boolean
	/** Similar shares list */
	similarShares: any[]
	/** Select similar share handler */
	onSelectSimilarShare: (share: any) => void
	/** Create new share handler */
	onCreateNewShare: () => void
	/** Close similar shares dialog */
	onCloseSimilarSharesDialog: () => void
	/** Is mobile */
	isMobile?: boolean
}

/**
 * File share modals component - renders all share-related modals
 */
function FileShareModals({
	shareModalVisible,
	onCloseShareModal,
	showSuccessModal,
	existingShareInfo,
	currentFile,
	shareFileId,
	attachments,
	onCancelShare,
	onEditShare,
	onCloseSuccessModal,
	showSimilarSharesDialog,
	similarShares,
	onSelectSimilarShare,
	onCreateNewShare,
	onCloseSimilarSharesDialog,
	isMobile = false,
}: FileShareModalsProps) {
	const projectId =
		findProjectIdInAttachments(attachments) ||
		currentFile?.projectId ||
		projectStore.selectedProject?.id
	const projectName =
		currentFile?.projectName ||
		projectStore.projects.find((item) => item.id === projectId)?.project_name ||
		projectStore.selectedProject?.project_name

	return (
		<>
			{isMobile ? (
				<ProjectShareSheet
					open={shareModalVisible || (showSuccessModal && Boolean(existingShareInfo))}
					onClose={() => {
						onCloseShareModal()
						onCloseSuccessModal()
					}}
					mode="file"
					attachments={attachments || []}
					projectName={projectName}
					projectId={projectId}
					defaultSelectedFileIds={shareFileId ? [shareFileId] : undefined}
					defaultOpenFileId={shareFileId || currentFile?.id}
					initialSelectedShare={showSuccessModal ? existingShareInfo : null}
				/>
			) : (
				<>
					{/* Share Modal */}
					<ShareModal
						open={shareModalVisible}
						onCancel={onCloseShareModal}
						shareMode={ShareMode.File}
						types={[
							ShareType.PasswordProtected,
							ShareType.Public,
							ShareType.Organization,
						]}
						attachments={attachments}
						resourceId={existingShareInfo?.resource_id}
						defaultSelectedFileIds={shareFileId ? [shareFileId] : undefined}
						defaultOpenFileId={shareFileId || currentFile?.id}
						projectName={projectName}
						projectId={projectId}
					/>

					{/* Share Success Modal - for existing shares */}
					{showSuccessModal && existingShareInfo && currentFile && (
						<ShareSuccessModal
							open={showSuccessModal}
							onClose={onCloseSuccessModal}
							onCancelShare={onCancelShare}
							onEditShare={onEditShare}
							shareName={existingShareInfo.resource_name || currentFile.name}
							projectName={existingShareInfo.project_name}
							fileCount={1}
							mainFileName={currentFile.name}
							shareUrl={`${window.location.origin}/share/files/${existingShareInfo.resource_id}${
								existingShareInfo.password
									? `?password=${existingShareInfo.password}`
									: ""
							}`}
							password={existingShareInfo.password}
							expire_at={existingShareInfo.expire_at}
							shareType={existingShareInfo.share_type}
							shareProject={existingShareInfo.share_project}
							fileIds={existingShareInfo.file_ids}
						/>
					)}
				</>
			)}

			{/* Similar Shares Dialog/Drawer */}
			{isMobile ? (
				<SimilarSharesDrawer
					open={showSimilarSharesDialog}
					onClose={onCloseSimilarSharesDialog}
					shares={similarShares}
					onSelectShare={onSelectSimilarShare}
					onCreateNew={onCreateNewShare}
				/>
			) : (
				<SimilarSharesDialog
					open={showSimilarSharesDialog}
					onClose={onCloseSimilarSharesDialog}
					shares={similarShares}
					onSelectShare={onSelectSimilarShare}
					onCreateNew={onCreateNewShare}
				/>
			)}
		</>
	)
}

function findProjectIdInAttachments(attachments?: AttachmentItem[]): string | undefined {
	if (!attachments?.length) return undefined

	for (const item of attachments) {
		if (item.project_id) return item.project_id

		const childProjectId = findProjectIdInAttachments(item.children)
		if (childProjectId) return childProjectId
	}

	return undefined
}

export default memo(FileShareModals)
