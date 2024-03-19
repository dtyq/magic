import { useCallback } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { IconPencil, IconCopy, IconTrash, IconInfoCircle } from "@tabler/icons-react"
import MagicModal from "@/opensource/components/base/MagicModal"
import type { ActionsPopup } from "@/opensource/pages/superMagicMobile/components/ActionsPopup/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { ShareType } from "../../Share/types"

export interface ShareItem {
	resource_id: string
	resource_name: string
	share_type: ShareType
	share_url: string
	password?: string
	expire_at?: string
	extend?: {
		file_count?: number
		copy_count?: number
	}
	main_file_name?: string
	file_ids?: string[] // 添加 file_ids 字段，用于查找 metadata
	share_project?: boolean
	project_name?: string
}

export interface UseShareItemActionsOptions {
	onEdit: (item: ShareItem) => void
	onCancelShare: (resourceId: string) => Promise<void>
	onViewInfo: (item: ShareItem) => void
}

type DropdownMenuItem =
	| {
			key: string
			label: string
			icon: React.ReactNode
			onClick: (info: { domEvent: React.MouseEvent }) => void
			danger?: boolean
	  }
	| {
			type: "divider"
			key: string
	  }

export interface UseShareItemActionsReturn {
	// Desktop dropdown menu items
	getDropdownItems: (item: ShareItem) => DropdownMenuItem[]
	// Mobile action items
	getMobileActions: (item: ShareItem) => ActionsPopup.ActionButtonConfig[]
	// Individual action handlers
	handleEdit: (item: ShareItem) => void
	handleCopyLink: (item: ShareItem) => void
	handleViewInfo: (item: ShareItem) => void
	handleConfirmCancel: (item: ShareItem) => void
}

/**
 * 通用的分享项操作hook
 * 提供编辑、复制链接、查看信息、取消分享等通用操作
 */
export function useShareItemActions(
	options: UseShareItemActionsOptions,
): UseShareItemActionsReturn {
	const { onEdit, onCancelShare, onViewInfo } = options
	const { t } = useTranslation("super")

	// Handle edit share
	const handleEdit = useCallback(
		(item: ShareItem) => {
			onEdit(item)
		},
		[onEdit],
	)

	// Handle copy share link
	const handleCopyLink = useCallback(
		(item: ShareItem) => {
			clipboard.writeText(item.share_url)
			magicToast.success(t("share.copySuccess"))
		},
		[t],
	)

	// Handle view share info
	const handleViewInfo = useCallback(
		(item: ShareItem) => {
			onViewInfo(item)
		},
		[onViewInfo],
	)

	// Handle cancel share with confirmation
	const handleConfirmCancel = useCallback(
		(item: ShareItem) => {
			MagicModal.confirm({
				title: t("shareManagement.cancelShareConfirmTitle"),
				content: t("shareManagement.cancelShareConfirmContent"),
				variant: "destructive",
				showIcon: true,
				onOk: async () => {
					await onCancelShare(item.resource_id)
				},
				okText: t("shareManagement.confirmCancel"),
				cancelText: t("common.cancel"),
				zIndex: 1300, // 确保在 ShareManagementModal (1200) 之上
			})
		},
		[onCancelShare, t],
	)

	// Get dropdown menu items for desktop
	const getDropdownItems = useCallback(
		(item: ShareItem): DropdownMenuItem[] => {
			const items: DropdownMenuItem[] = [
				{
					key: "edit",
					label: t("shareManagement.editShare"),
					icon: <IconPencil size={16} />,
					onClick: ({ domEvent }) => {
						domEvent.stopPropagation()
						handleEdit(item)
					},
				},
			]

			// 话题分享不显示"查看分享信息"
			if (item.share_type !== ShareType.Public) {
				items.push({
					key: "viewInfo",
					label: t("shareManagement.viewShareInfo"),
					icon: <IconInfoCircle size={16} />,
					onClick: ({ domEvent }) => {
						domEvent.stopPropagation()
						handleViewInfo(item)
					},
				})
			}

			items.push(
				{
					key: "copy",
					label: t("shareManagement.copyLink"),
					icon: <IconCopy size={16} />,
					onClick: ({ domEvent }) => {
						domEvent.stopPropagation()
						handleCopyLink(item)
					},
				},
				{
					type: "divider",
					key: "divider",
				},
				{
					key: "cancel",
					label: t("shareManagement.cancelShare"),
					icon: <IconTrash size={16} />,
					danger: true,
					onClick: ({ domEvent }) => {
						domEvent.stopPropagation()
						handleConfirmCancel(item)
					},
				},
			)

			return items
		},
		[t, handleEdit, handleViewInfo, handleCopyLink, handleConfirmCancel],
	)

	// Get mobile action items
	const getMobileActions = useCallback(
		(item: ShareItem): ActionsPopup.ActionButtonConfig[] => {
			const actions: ActionsPopup.ActionButtonConfig[] = [
				{
					key: "edit",
					label: t("shareManagement.editShare"),
					onClick: () => handleEdit(item),
				},
			]

			// 话题分享不显示"查看分享信息"
			if (item.share_type !== ShareType.Public) {
				actions.push({
					key: "viewInfo",
					label: t("shareManagement.viewShareInfo"),
					onClick: () => handleViewInfo(item),
				})
			}

			actions.push(
				{
					key: "copy",
					label: t("shareManagement.copyLink"),
					onClick: () => handleCopyLink(item),
				},
				{
					key: "cancel",
					label: t("shareManagement.cancelShare"),
					onClick: () => handleConfirmCancel(item),
					variant: "danger",
				},
			)

			return actions
		},
		[t, handleEdit, handleViewInfo, handleCopyLink, handleConfirmCancel],
	)

	return {
		getDropdownItems,
		getMobileActions,
		handleEdit,
		handleCopyLink,
		handleViewInfo,
		handleConfirmCancel,
	}
}
