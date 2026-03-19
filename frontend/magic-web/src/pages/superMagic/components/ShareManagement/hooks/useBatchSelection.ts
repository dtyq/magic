import { useState, useCallback, useRef } from "react"
import { type MenuProps } from "antd"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseBatchSelectionOptions<T> {
	data: T[]
	getItemId: (item: T) => string
	onRefresh: () => void
}

export function useBatchSelection<T>({ data, getItemId, onRefresh }: UseBatchSelectionOptions<T>) {
	const { t } = useTranslation("super")
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

	// 进入选择模式
	const handleEnterSelectionMode = useCallback(() => {
		setIsSelectionMode(true)
	}, [])

	// 退出选择模式
	const handleExitSelectionMode = useCallback(() => {
		setIsSelectionMode(false)
		setSelectedIds([])
	}, [])

	// 列表项点击（选择模式下）
	const handleListItemClick = useCallback(
		(item: T) => {
			if (!isSelectionMode) return

			const itemId = getItemId(item)
			setSelectedIds((prev) => {
				if (prev.includes(itemId)) {
					return prev.filter((id) => id !== itemId)
				}
				return [...prev, itemId]
			})
		},
		[isSelectionMode, getItemId],
	)

	// 长按触发选择模式
	const handleTouchStart = useCallback(
		(item: T) => {
			longPressTimerRef.current = setTimeout(() => {
				if (!isSelectionMode) {
					setIsSelectionMode(true)
					setSelectedIds([getItemId(item)])
				}
			}, 500)
		},
		[isSelectionMode, getItemId],
	)

	const handleTouchEnd = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current)
			longPressTimerRef.current = null
		}
	}, [])

	// 全选/取消全选
	const handleSelectAll = useCallback(() => {
		if (selectedIds.length === data.length) {
			setSelectedIds([])
		} else {
			setSelectedIds(data.map((item) => getItemId(item)))
		}
	}, [selectedIds, data, getItemId])

	// 批量取消分享
	const handleBatchCancelShare = useCallback(async () => {
		if (selectedIds.length === 0) {
			magicToast.warning(t("shareManagement.noItemSelected"))
			return
		}

		MagicModal.confirm({
			title: t("common.tip"),
			content: t("shareManagement.batchCancelShareConfirm", { count: selectedIds.length }),
			centered: true,
			onOk: async () => {
				try {
					await SuperMagicApi.batchCancelShareResources({ resourceIds: selectedIds })
					magicToast.success(t("shareManagement.batchCancelShareSuccess"))
					setSelectedIds([])
					setIsSelectionMode(false)
					onRefresh()
				} catch (error) {
					console.error("Batch cancel share failed:", error)
					magicToast.error(t("shareManagement.batchCancelShareFailed"))
				}
			},
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			okButtonProps: {
				danger: true,
			},
		})
	}, [selectedIds, t, onRefresh])

	// 批量操作菜单项
	const batchMenuItems: MenuProps["items"] = [
		{
			key: "cancelShare",
			label: t("shareManagement.cancelShare"),
			danger: true,
			disabled: selectedIds.length === 0,
			onClick: handleBatchCancelShare,
		},
	]

	return {
		isSelectionMode,
		selectedIds,
		handleEnterSelectionMode,
		handleExitSelectionMode,
		handleListItemClick,
		handleTouchStart,
		handleTouchEnd,
		handleSelectAll,
		handleBatchCancelShare,
		batchMenuItems,
	}
}
