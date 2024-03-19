import { useCallback, useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import type { AttachmentItem } from "./types"
import { createShareHandler } from "../utils/createShareHandler"
import { ProjectListItem } from "../../../pages/Workspace/types"
import { ResourceType } from "../../Share/types"

interface UseShareFileOptions {
	getItemId: (item: AttachmentItem) => string
	selectedItems: Set<string>
	mergedFiles: AttachmentItem[]
	setShareFileInfo: (
		info: {
			projectName?: string
			fileIds: string[]
			defaultOpenFileId?: string
			isSingleFileMode?: boolean
			resourceId?: string
		} | null,
	) => void
	setShareModalVisible: (visible: boolean) => void
	selectedProject?: ProjectListItem
}

interface ShareSuccessInfo {
	shareInfo: any
}

interface SimilarSharesInfo {
	similarShares: any[]
	fileIds: string[]
}

/**
 * useShareFile - 处理文件分享逻辑，包括检测和状态管理
 */
export function useShareFile(options: UseShareFileOptions) {
	const {
		getItemId,
		selectedItems,
		mergedFiles,
		setShareFileInfo,
		setShareModalVisible,
		selectedProject,
	} = options
	const { t } = useTranslation("super")

	// 文件分享检测状态
	const [isCheckingShare, setIsCheckingShare] = useState(false)
	const [shareSuccessInfo, setShareSuccessInfo] = useState<ShareSuccessInfo | null>(null)
	const [similarSharesInfo, setSimilarSharesInfo] = useState<SimilarSharesInfo | null>(null)

	const handleShareItem = useCallback(
		async (item: AttachmentItem) => {
			await createShareHandler({
				item,
				selectedItems,
				allFiles: mergedFiles,
				getItemId,
				setShareFileInfo,
				setShareModalVisible,
				onCheckingStart: () => setIsCheckingShare(true),
				onCheckingEnd: () => setIsCheckingShare(false),
				onShowSimilarSharesDialog: (similarShares, fileIds) => {
					setSimilarSharesInfo({ similarShares, fileIds })
				},
			})
		},
		[getItemId, selectedItems, mergedFiles, setShareFileInfo, setShareModalVisible],
	)

	const closeSuccessModal = useCallback(() => {
		setShareSuccessInfo(null)
	}, [])

	const closeSimilarSharesDialog = useCallback(() => {
		setSimilarSharesInfo(null)
	}, [])

	const handleSelectSimilarShare = useCallback((share: any) => {
		// 将选中的相似分享信息转换为 ShareSuccessInfo 格式
		setShareSuccessInfo({
			shareInfo: share,
		})
		setSimilarSharesInfo(null)
	}, [])

	const handleCreateNewShare = useCallback(() => {
		// 使用保存的 fileIds 打开分享弹窗
		if (similarSharesInfo) {
			setShareFileInfo({
				projectName: selectedProject?.project_name,
				fileIds: similarSharesInfo.fileIds,
				defaultOpenFileId: similarSharesInfo.fileIds[0] || "",
			})
			setShareModalVisible(true)
		}
		setSimilarSharesInfo(null)
	}, [similarSharesInfo, setShareFileInfo, selectedProject?.project_name, setShareModalVisible])

	// 处理取消分享
	const handleCancelShare = useCallback(async () => {
		if (!shareSuccessInfo?.shareInfo?.resource_id) return

		try {
			await SuperMagicApi.cancelShareResource({
				resourceId: shareSuccessInfo.shareInfo.resource_id,
			})
			magicToast.success(t("shareManagement.cancelShareSuccess"))
			closeSuccessModal()
		} catch (error) {
			console.error("Cancel share failed:", error)
			magicToast.error(t("shareManagement.cancelShareFailed"))
		}
	}, [shareSuccessInfo, closeSuccessModal, t])

	// 处理编辑分享
	const handleEditShare = useCallback(() => {
		if (!shareSuccessInfo?.shareInfo?.resource_id) return

		// 先保存 resourceId，因为 closeSuccessModal 会清空 shareSuccessInfo
		const resourceId = shareSuccessInfo.shareInfo.resource_id
		const isFileCollection =
			shareSuccessInfo.shareInfo.resource_type === ResourceType.FileCollection

		// 关闭成功弹窗
		closeSuccessModal()
		// 打开编辑分享弹窗，传入 resourceId
		setShareFileInfo({
			fileIds: [],
			defaultOpenFileId: "",
			resourceId, // 传递 resourceId 用于编辑
		})
		setShareModalVisible(true)
	}, [shareSuccessInfo, closeSuccessModal, setShareFileInfo, setShareModalVisible])

	// 直接设置相似分享信息（用于批量分享等场景）
	const setSimilarShares = useCallback((similarShares: any[], fileIds: string[]) => {
		setSimilarSharesInfo({ similarShares, fileIds })
	}, [])

	return {
		handleShareItem,
		isCheckingShare,
		shareSuccessInfo,
		closeSuccessModal,
		similarSharesInfo,
		closeSimilarSharesDialog,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setSimilarShares,
	}
}
