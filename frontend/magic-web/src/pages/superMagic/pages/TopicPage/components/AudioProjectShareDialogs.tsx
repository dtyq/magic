import { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { generateShareUrl } from "../../../components/ShareManagement/utils/shareTypeHelpers"
import type { useShareProject } from "../../../layouts/MainLayout/hooks/useShareProject"

const SimilarSharesDialog = lazy(() => import("../../../components/Share/SimilarSharesDialog"))
const ShareSuccessModal = lazy(
	() => import("../../../components/Share/FileShareModal/ShareSuccessModal"),
)

type ShareController = ReturnType<typeof useShareProject>

interface AudioProjectShareDialogsProps {
	controller: ShareController
}

/** Renders the ordinary project's similar-share and success follow-up dialogs for audio projects. */
export default function AudioProjectShareDialogs({ controller }: AudioProjectShareDialogsProps) {
	const { t } = useTranslation("super")

	return (
		<>
			{controller.similarSharesInfo ? (
				<Suspense fallback={null}>
					<SimilarSharesDialog
						open
						onClose={controller.closeSimilarSharesDialog}
						shares={controller.similarSharesInfo.similarShares}
						onSelectShare={controller.handleSelectSimilarShare}
						onCreateNew={controller.handleCreateNewShare}
					/>
				</Suspense>
			) : null}

			{controller.shareSuccessInfo ? (
				<Suspense fallback={null}>
					<ShareSuccessModal
						open
						onClose={controller.closeSuccessModal}
						onCancelShare={controller.handleCancelShare}
						onEditShare={controller.handleEditShare}
						shareName={controller.shareSuccessInfo.shareInfo.resource_name || ""}
						fileCount={controller.shareSuccessInfo.shareInfo?.extend?.file_count || 1}
						mainFileName={
							controller.shareSuccessInfo.shareInfo.main_file_name ||
							t("share.untitled")
						}
						shareUrl={generateShareUrl(
							controller.shareSuccessInfo.shareInfo.resource_id,
							controller.shareSuccessInfo.shareInfo.password,
							"files",
						)}
						projectName={controller.shareSuccessInfo.shareInfo.project_name}
						shareType={controller.shareSuccessInfo.shareInfo.share_type}
						createdAt={controller.shareSuccessInfo.shareInfo.created_at}
						updatedAt={controller.shareSuccessInfo.shareInfo.updated_at}
						viewCount={controller.shareSuccessInfo.shareInfo.view_count}
					/>
				</Suspense>
			) : null}
		</>
	)
}
