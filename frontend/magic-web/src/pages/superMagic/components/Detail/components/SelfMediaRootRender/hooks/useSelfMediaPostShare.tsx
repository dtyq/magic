import { lazy, Suspense, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useFileShare } from "../../CommonHeader/hooks"
import { resolveSelfMediaPostDirectoryAttachmentItem } from "../services/selfMediaCardChat"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { SelfMediaAttachmentNode } from "../types"

interface UseSelfMediaPostShareOptions {
	attachments?: SelfMediaAttachmentNode[]
	selectedProject?: ProjectListItem | null
	enabled: boolean
}

const FileShareModals = lazy(() => import("../../CommonHeader/components/FileShareModals"))

export function useSelfMediaPostShare({
	attachments,
	selectedProject,
	enabled,
}: UseSelfMediaPostShareOptions) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const {
		permissions: { share },
	} = useFileAccess()
	const shareAttachments = attachments as AttachmentItem[] | undefined
	const {
		shareModalVisible,
		showSuccessModal,
		existingShareInfo,
		shareFileId,
		showSimilarSharesDialog,
		similarShares,
		isCheckingShare,
		shareTarget,
		handleShare,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setShareModalVisible,
		setShowSuccessModal,
		setExistingShareInfo,
		closeSimilarSharesDialog,
	} = useFileShare({ attachments: shareAttachments })
	const canShare = enabled && share

	const sharePost = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			if (!canShare) return
			const postDirectory = resolveSelfMediaPostDirectoryAttachmentItem(
				attachments,
				target.post.article?.fileId ||
					target.post.cards.find((card) => card.fileId)?.fileId,
				target.entry.entry,
			)
			if (!postDirectory?.file_id) {
				magicToast.error(t("detail.selfMedia.errors.postDirectoryMissing"))
				return
			}

			await handleShare({
				id: postDirectory.file_id,
				name: postDirectory.file_name || target.entry.name,
				type: "folder",
				projectId: selectedProject?.id,
				projectName: selectedProject?.project_name,
			})
		},
		[attachments, canShare, handleShare, selectedProject, t],
	)

	const shareModals = useMemo(() => {
		if (!shareModalVisible && !showSuccessModal && !showSimilarSharesDialog) {
			return null
		}

		return (
			<Suspense fallback={null}>
				<FileShareModals
					shareModalVisible={shareModalVisible}
					onCloseShareModal={() => {
						setShareModalVisible(false)
						setExistingShareInfo(null)
					}}
					showSuccessModal={showSuccessModal}
					existingShareInfo={existingShareInfo}
					currentFile={shareTarget}
					shareFileId={shareFileId}
					attachments={shareAttachments}
					onCancelShare={handleCancelShare}
					onEditShare={handleEditShare}
					onCloseSuccessModal={() => {
						setShowSuccessModal(false)
						setExistingShareInfo(null)
					}}
					showSimilarSharesDialog={showSimilarSharesDialog}
					similarShares={similarShares}
					onSelectSimilarShare={handleSelectSimilarShare}
					onCreateNewShare={handleCreateNewShare}
					onCloseSimilarSharesDialog={closeSimilarSharesDialog}
					isMobile={isMobile}
				/>
			</Suspense>
		)
	}, [
		closeSimilarSharesDialog,
		existingShareInfo,
		handleCancelShare,
		handleCreateNewShare,
		handleEditShare,
		handleSelectSimilarShare,
		isMobile,
		setExistingShareInfo,
		setShareModalVisible,
		setShowSuccessModal,
		shareAttachments,
		shareFileId,
		shareModalVisible,
		shareTarget,
		showSimilarSharesDialog,
		showSuccessModal,
		similarShares,
	])

	return {
		canShare,
		isCheckingShare,
		sharePost,
		shareModals,
	}
}
