import { memo, useState, useCallback, useMemo } from "react"
import { Input, Checkbox, Dropdown, type MenuProps } from "antd"
import {
	IconSearch,
	IconLoader,
	IconExternalLink,
	IconMessageCircle,
	IconX,
	IconChevronDown,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { cx } from "antd-style"
import { useStyles } from "./styles"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import type { TopicShareItem } from "../types"
import { ShareType, ResourceType, ShareMode } from "../../Share/types"
import MagicModal from "@/opensource/components/base/MagicModal"
import ShareModal from "../../Share/Modal"
import { getShareTypeIcon, getShareTypeIconClassName } from "../utils/shareTypeHelpers"
import { useShareList } from "../hooks/useShareList"
import { useNavigateToProject } from "../hooks/useNavigateToProject"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface TopicShareListProps {
	onClose?: () => void
	projectId?: string
}

function TopicShareList({ onClose, projectId }: TopicShareListProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { navigateToProject } = useNavigateToProject({ onClose })

	// 使用共用的 hook
	const {
		data,
		setData,
		isLoadingMore,
		hasMore,
		searchText,
		setSearchText,
		scrollableNodeRef,
		refreshList,
		page,
		handleShareSettingsUpdate: updateShareType,
		handleCancelShare: cancelShare,
		handleBatchCancelShare: batchCancelShare,
	} = useShareList<TopicShareItem>({
		resourceType: ResourceType.Topic,
		projectId,
		transformData: (item, t) => ({
			title: item.resource_name || t("messageHeader.untitledTopic"),
			topic_id: item.resource_id,
			project_id: item?.project_id || "",
			project_name: item?.project_name || t("common.untitledProject"),
			workspace_id: item?.workspace_id || "",
			workspace_name: item?.workspace_name || "",
			resource_type: ResourceType.Topic,
			share_type: item.share_type as ShareType,
			resource_id: item.resource_id,
			has_password: false,
			password: item.password,
			shared_at: item.shared_at || "",
			created_at: item.created_at,
		}),
	})

	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [selectedShareItem, setSelectedShareItem] = useState<TopicShareItem | null>(null)

	// 全选/取消全选
	const handleSelectAll = useCallback(
		(checked: boolean) => {
			if (checked) {
				setSelectedIds(data.map((item) => item.resource_id))
			} else {
				setSelectedIds([])
			}
		},
		[data],
	)

	// 单项选择
	const handleSelectItem = useCallback((id: string, checked: boolean) => {
		if (checked) {
			setSelectedIds((prev) => [...prev, id])
		} else {
			setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
		}
	}, [])

	// 取消分享（封装 UI 确认逻辑）
	const handleCancelShare = useCallback(
		async (item: TopicShareItem) => {
			MagicModal.confirm({
				title: t("common.tip"),
				content: t("shareManagement.cancelShareConfirm"),
				centered: true,
				onOk: async () => {
					await cancelShare(item.resource_id)
				},
				okText: t("common.confirm"),
				cancelText: t("common.cancel"),
				okButtonProps: {
					danger: true,
				},
			})
		},
		[t, cancelShare],
	)

	// 设置分享
	const handleSettingShare = useCallback((item: TopicShareItem) => {
		setSelectedShareItem(item)
		setShareModalOpen(true)
	}, [])

	// 处理分享设置更新
	const handleShareSettingsUpdate = useCallback(
		(newType: ShareType, extraData: any) => {
			if (selectedShareItem) {
				updateShareType(selectedShareItem.resource_id, newType, extraData)
			}
		},
		[selectedShareItem, updateShareType],
	)

	// 关闭分享Modal
	const handleCloseShareModal = useCallback(() => {
		setShareModalOpen(false)
		setSelectedShareItem(null)
	}, [])

	// 批量取消分享
	const handleBatchCancelShare = useCallback(async () => {
		if (selectedIds.length === 0) {
			magicToast.warning(t("shareManagement.noItemSelected") || "请先选择要取消分享的项目")
			return
		}

		MagicModal.confirm({
			title: t("common.tip"),
			content:
				t("shareManagement.batchCancelShareConfirm", {
					count: selectedIds.length,
				}) || `确定要取消 ${selectedIds.length} 个分享吗？`,
			centered: true,
			onOk: async () => {
				await batchCancelShare(selectedIds)
				// 清空选中项
				setSelectedIds([])
			},
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			okButtonProps: {
				danger: true,
			},
		})
	}, [selectedIds, t, batchCancelShare, setSelectedIds])

	// 批量操作菜单项
	const batchMenuItems: MenuProps["items"] = useMemo(
		() => [
			{
				key: "cancelShare",
				label: t("shareManagement.cancelShare"),
				danger: true,
				disabled: selectedIds.length === 0,
				onClick: handleBatchCancelShare,
			},
		],
		[selectedIds.length, handleBatchCancelShare, t],
	)

	// 获取分享类型文本
	const getShareTypeText = useCallback(
		(shareType: ShareType) => {
			switch (shareType) {
				case ShareType.Public:
					return t("share.publicAccess")
				case ShareType.PasswordProtected:
					return t("share.passwordProtected")
				case ShareType.Organization:
					return t("share.teamShare")
				default:
					return ""
			}
		},
		[t],
	)

	// 获取分享类型图标（使用共享工具）
	const getShareTypeIconMemo = useCallback(
		(shareType: ShareType) => getShareTypeIcon(shareType),
		[],
	)

	// 获取分享类型图标样式类（使用共享工具）
	const getShareTypeIconClassNameMemo = useCallback(
		(shareType: ShareType) => getShareTypeIconClassName(shareType, styles),
		[styles],
	)

	return (
		<div className={styles.container}>
			{/* Header */}
			<div className={styles.header}>
				<div className={styles.headerWrapper}>
					<div className={styles.headerIcon}>
						<IconMessageCircle size={24} color="#FFFFFF" />
					</div>
					<div className={styles.headerInfo}>
						<div className={styles.headerTitle}>{t("shareManagement.topicShare")}</div>
						<div className={styles.headerDesc}>
							{t("shareManagement.topicShareDesc")}
						</div>
					</div>
				</div>
				<div className={styles.headerClose} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>

			{/* Search */}
			<div className={styles.searchWrapper}>
				<Input
					value={searchText}
					onChange={(e) => setSearchText(e.target.value)}
					prefix={<IconSearch size={16} />}
					placeholder={t("shareManagement.searchTopic")}
					className={styles.searchInput}
				/>
				<Dropdown menu={{ items: batchMenuItems }} trigger={["click"]}>
					<button className={styles.batchButton}>
						<span>{t("shareManagement.batchOperation")}</span>
						<IconChevronDown size={20} />
					</button>
				</Dropdown>
			</div>

			{/* Table Header */}
			<div className={styles.tableHeader}>
				<div className={styles.table}>
					<div className={`${styles.column} ${styles.columnCheckbox}`}>
						<div className={`${styles.headerCell} ${styles.checkboxCell}`}>
							<Checkbox
								checked={data.length > 0 && selectedIds.length === data.length}
								indeterminate={
									selectedIds.length > 0 && selectedIds.length < data.length
								}
								onChange={(e) => handleSelectAll(e.target.checked)}
							/>
						</div>
					</div>
					<div className={`${styles.column} ${styles.columnTopic}`}>
						<div className={styles.headerCell}>{t("shareManagement.topicName")}</div>
					</div>
					<div className={`${styles.column} ${styles.columnShareType}`}>
						<div className={styles.headerCell}>{t("shareManagement.shareType")}</div>
					</div>
					<div className={`${styles.column} ${styles.columnOperation}`}>
						<div className={styles.headerCell}>{t("shareManagement.operation")}</div>
					</div>
				</div>
			</div>

			{/* Body */}
			<div className={styles.body}>
				<MagicScrollBar
					autoHide={false}
					className={styles.scrollContainer}
					scrollableNodeProps={{
						ref: scrollableNodeRef as any,
					}}
				>
					<div className={styles.table}>
						{/* Checkbox列 */}
						<div className={`${styles.column} ${styles.columnCheckbox}`}>
							{data.map((item) => (
								<div
									key={item.resource_id}
									className={`${styles.cell} ${styles.checkboxCell}`}
								>
									<Checkbox
										checked={selectedIds.includes(item.resource_id)}
										onChange={(e) =>
											handleSelectItem(item.resource_id, e.target.checked)
										}
									/>
								</div>
							))}
						</div>

						{/* 话题名列 */}
						<div className={`${styles.column} ${styles.columnTopic}`}>
							{data.map((item) => (
								<div
									key={item.resource_id}
									className={`${styles.cell} ${styles.topicCell}`}
								>
									<div className={styles.topicIcon}>
										<IconMessageCircle size={16} />
									</div>
									<div className={styles.topicContent}>
										<div className={styles.topicName}>
											<span>{item.title}</span>
										</div>
										<div
											className={styles.projectTag}
											onClick={(e) => {
												e.stopPropagation()
												navigateToProject(item)
											}}
											style={{ cursor: "pointer" }}
										>
											<span>{item.project_name}</span>
											<IconExternalLink
												size={13}
												className={styles.externalLink}
											/>
										</div>
									</div>
								</div>
							))}
						</div>

						{/* 分享方式列 */}
						<div className={`${styles.column} ${styles.columnShareType}`}>
							{data.map((item) => (
								<div
									key={item.resource_id}
									className={`${styles.cell} ${styles.shareTypeCell}`}
								>
									<div
										className={cx(
											styles.shareTypeIcon,
											getShareTypeIconClassNameMemo(item.share_type),
										)}
									>
										{getShareTypeIconMemo(item.share_type)}
									</div>
									<span>{getShareTypeText(item.share_type)}</span>
								</div>
							))}
						</div>

						{/* 操作列 */}
						<div className={`${styles.column} ${styles.columnOperation}`}>
							{data.map((item) => (
								<div
									key={item.resource_id}
									className={`${styles.cell} ${styles.operationCell}`}
								>
									<button
										className={styles.operationButton}
										onClick={() => handleSettingShare(item)}
									>
										{t("shareManagement.setting")}
									</button>
									<button
										className={styles.operationButton}
										onClick={() => handleCancelShare(item)}
									>
										{t("shareManagement.cancelShare")}
									</button>
								</div>
							))}
						</div>
					</div>

					{/* Footer */}
					{isLoadingMore && hasMore && (
						<div className={styles.loadingFooter}>
							<IconLoader size={20} className={styles.loaderIcon} />
							<span>{t("shareManagement.loading")}</span>
						</div>
					)}
					{!isLoadingMore && !hasMore && data.length > 0 && (
						<div className={styles.reachedBottomFooter}>
							<div className={styles.dividerLine} />
							<span>{t("shareManagement.reachedBottom")}</span>
							<div className={styles.dividerLine} />
						</div>
					)}
				</MagicScrollBar>
			</div>

			{/* 分享Modal */}
			<ShareModal
				open={shareModalOpen}
				onCancel={handleCloseShareModal}
				types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
				shareMode={ShareMode.Topic}
				shareContext={
					selectedShareItem
						? {
								resource_id: selectedShareItem.resource_id,
								resource_type: ResourceType.Topic,
							}
						: undefined
				}
				topicTitle={selectedShareItem?.title}
				handleOk={handleShareSettingsUpdate}
				resourceId={selectedShareItem?.resource_id}
				onCancelShare={cancelShare}
			/>
		</div>
	)
}

export default memo(TopicShareList)
