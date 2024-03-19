import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { projectStore } from "../../../stores/core"

interface UseShareProjectOptions {
	attachments?: AttachmentItem[]
	projectName?: string
}

interface ShareSuccessInfo {
	shareInfo: any
}

interface SimilarSharesInfo {
	similarShares: any[]
	fileIds: string[]
}

interface UseShareProjectReturn {
	shareModalOpen: boolean
	defaultSelectedFileIds: string[]
	editingResourceId: string | undefined
	similarSharesInfo: SimilarSharesInfo | null
	shareSuccessInfo: ShareSuccessInfo | null
	isCheckingShare: boolean
	openShareModal: () => void
	closeShareModal: () => void
	closeSimilarSharesDialog: () => void
	closeSuccessModal: () => void
	handleSelectSimilarShare: (share: any) => void
	handleCreateNewShare: () => void
	handleCancelShare: () => Promise<void>
	handleEditShare: () => void
}

/**
 * 处理分享项目的 hook
 * - 自动提取第一层文件的 file_id
 * - 检查是否有可分享的文件
 * - 检查相似分享
 * - 管理分享弹窗状态
 */
export function useShareProject(options: UseShareProjectOptions): UseShareProjectReturn {
	const { attachments = [] } = options
	const { t } = useTranslation("super")
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [isCheckingShare, setIsCheckingShare] = useState(false)
	const [shareSuccessInfo, setShareSuccessInfo] = useState<ShareSuccessInfo | null>(null)
	const [similarSharesInfo, setSimilarSharesInfo] = useState<SimilarSharesInfo | null>(null)
	const [editingResourceId, setEditingResourceId] = useState<string | undefined>(undefined)

	// 提取第一层文件的 file_id（排除文件夹）
	const defaultSelectedFileIds = useMemo(() => {
		if (!attachments || attachments.length === 0) {
			return []
		}

		return attachments
			.filter((item) => {
				// 只选择显示的文件，排除隐藏的文件
				return !item.is_hidden && item.file_id
			})
			.map((item) => item.file_id as string)
	}, [attachments])

	// 打开分享弹窗
	const openShareModal = useCallback(async () => {
		// 检查是否有可分享的文件
		if (defaultSelectedFileIds.length === 0) {
			magicToast.warning(
				t("share.noShareableFiles", {
					defaultValue: "当前项目不存在可分享的文件",
				}),
			)
			return
		}

		// 检查是否存在相似分享
		setIsCheckingShare(true)
		try {
			const similarShares = await SuperMagicApi.findSimilarShares({
				file_ids: defaultSelectedFileIds,
				project_id: projectStore.selectedProject?.id,
				share_project: true,
			})

			if (similarShares && similarShares.length > 0) {
				// 显示相似分享选择弹窗
				setSimilarSharesInfo({ similarShares, fileIds: defaultSelectedFileIds })
				return
			}
		} catch (error) {
			console.error("Check similar shares failed:", error)
		} finally {
			setIsCheckingShare(false)
		}

		// 无相似分享，直接打开分享弹窗
		setShareModalOpen(true)
	}, [defaultSelectedFileIds, t])

	// 关闭分享弹窗
	const closeShareModal = useCallback(() => {
		setShareModalOpen(false)
		setEditingResourceId(undefined)
	}, [])

	// 关闭成功弹窗
	const closeSuccessModal = useCallback(() => {
		setShareSuccessInfo(null)
	}, [])

	// 关闭相似分享弹窗
	const closeSimilarSharesDialog = useCallback(() => {
		setSimilarSharesInfo(null)
	}, [])

	// 选择相似分享（复用）
	const handleSelectSimilarShare = useCallback((share: any) => {
		// 将选中的相似分享信息转换为 ShareSuccessInfo 格式
		setShareSuccessInfo({
			shareInfo: share,
		})
		setSimilarSharesInfo(null)
	}, [])

	// 创建新分享
	const handleCreateNewShare = useCallback(() => {
		// 使用保存的 fileIds 打开分享弹窗
		if (similarSharesInfo) {
			setShareModalOpen(true)
		}
		setSimilarSharesInfo(null)
	}, [similarSharesInfo])

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

		// 关闭成功弹窗
		closeSuccessModal()
		// 设置要编辑的 resourceId 并打开编辑分享弹窗
		setEditingResourceId(shareSuccessInfo.shareInfo.resource_id)
		setShareModalOpen(true)
	}, [shareSuccessInfo, closeSuccessModal])

	return {
		shareModalOpen,
		defaultSelectedFileIds,
		editingResourceId,
		similarSharesInfo,
		shareSuccessInfo,
		isCheckingShare,
		openShareModal,
		closeShareModal,
		closeSimilarSharesDialog,
		closeSuccessModal,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
	}
}
