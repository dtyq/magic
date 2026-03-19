import { useState, useCallback, useEffect, useRef } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconLoader } from "@tabler/icons-react"
import { useDebounce } from "ahooks"
import { useShareManagementStore } from "../hooks/useShareManagementStore"
import { SharedTopicFilterStatus, SharedResourceType, type ProjectShareItem } from "../types"
import { ShareType, ShareMode, type ShareExtraData } from "../../Share/types"
import MobileProjectFileShareItem from "../components/MobileProjectFileShareItem"
import MobileSearchBar from "../components/MobileSearchBar"
import ShareListEmptyState from "../components/ShareListEmptyState"
import LoadingSpinner from "../components/LoadingSpinner"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import ShareModal from "../../Share/Modal"
import MagicModal from "@/components/base/MagicModal"
import { createStyles } from "antd-style"
import { generateShareUrl } from "../utils/shareTypeHelpers"
import magicToast from "@/components/base/MagicToaster/utils"

const useStyles = createStyles(({ token }) => ({
	container: {
		height: "100%",
		display: "flex",
		flexDirection: "column",
		padding: "12px",
		gap: "12px",
		paddingTop: 0,
	},
	searchBarWrapper: {
		display: "flex",
		gap: "8px",
		alignItems: "center",
	},
	listWrapper: {
		flex: 1,
		overflow: "hidden",
	},
	scrollContainer: {
		width: "100%",
		height: "100%",
	},
	loadingFooter: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		gap: "8px",
		padding: "12px 0",
		color: token.colorTextSecondary,
	},
	loaderIcon: {
		animation: "spin 1s linear infinite",
	},
	reachedBottomFooter: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		gap: "8px",
		padding: "12px 0",
		color: token.colorTextSecondary,
		fontSize: token.fontSizeSM,
	},
	dividerLine: {
		flex: 1,
		height: "1px",
		backgroundColor: token.colorBorder,
	},
}))

interface MobileProjectShareListProps {
	projectId?: string
	filterStatus?: SharedTopicFilterStatus
	hideSearchBar?: boolean
	searchText?: string // 外部传入的搜索文本（已防抖）
	disableProjectNavigation?: boolean // 是否禁用项目跳转
	showProjectBadge?: boolean // 是否显示项目名 Badge
}

function MobileProjectShareList({
	projectId,
	filterStatus,
	hideSearchBar = false,
	searchText: externalSearchText,
	disableProjectNavigation = false,
	showProjectBadge = true,
}: MobileProjectShareListProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [selectedItem, setSelectedItem] = useState<ProjectShareItem | null>(null)
	const scrollableNodeRef = useRef<HTMLElement>()

	// 本地搜索状态（仅在 hideSearchBar=false 时使用）
	const [localSearchText, setLocalSearchText] = useState("")
	const debouncedLocalSearchText = useDebounce(localSearchText, { wait: 300 })

	// 使用外部传入的搜索文本，如果没有则使用本地的
	const searchText =
		externalSearchText !== undefined ? externalSearchText : debouncedLocalSearchText

	// 使用 MobX store，传入防抖后的搜索文本
	const {
		data,
		isLoading,
		isLoadingMore,
		hasMore,
		lastFetchTime,
		fetchMore,
		updateShareType,
		cancelShare,
		refresh,
	} = useShareManagementStore(SharedResourceType.Project, projectId, filterStatus, searchText)

	// 使用 IntersectionObserver 检测底部元素，触发加载更多
	const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!loadMoreTriggerRef.current || !hasMore || isLoadingMore) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
					fetchMore()
				}
			},
			{
				root: null,
				rootMargin: "100px",
				threshold: 0.1,
			},
		)

		observer.observe(loadMoreTriggerRef.current)

		return () => {
			observer.disconnect()
		}
	}, [fetchMore, hasMore, isLoadingMore])

	// 复制分享链接
	const handleCopyLink = useCallback(
		async (item: ProjectShareItem) => {
			try {
				const shareUrl = generateShareUrl(item.resource_id, item.password)
				await clipboard.writeText(shareUrl)
				magicToast.success(t("common.copySuccess"))
			} catch (error) {
				magicToast.error(t("common.copyFailed"))
			}
		},
		[t],
	)

	// 打开编辑分享弹窗
	const handleEditShare = useCallback((item: ProjectShareItem) => {
		setSelectedItem(item)
		setShareModalOpen(true)
	}, [])

	// 关闭分享Modal
	const handleCloseShareModal = useCallback(() => {
		setShareModalOpen(false)
		setSelectedItem(null)
	}, [])

	// 处理分享设置更新
	const handleShareSettingsUpdate = useCallback(
		(newType: ShareType, extraData: ShareExtraData) => {
			if (selectedItem) {
				updateShareType(selectedItem.resource_id, newType, extraData)
				handleCloseShareModal()
				// 静默刷新列表
				refresh()
			}
		},
		[selectedItem, updateShareType, handleCloseShareModal, refresh],
	)

	const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false)
	const [itemToCancel, setItemToCancel] = useState<ProjectShareItem | null>(null)

	const handleCancelShare = useCallback((item: ProjectShareItem) => {
		setItemToCancel(item)
		setCancelConfirmVisible(true)
	}, [])

	const handleConfirmCancelShare = useCallback(async () => {
		if (itemToCancel) {
			await cancelShare(itemToCancel.resource_id)
			setCancelConfirmVisible(false)
			setItemToCancel(null)
		}
	}, [itemToCancel, cancelShare])

	const handleCancelConfirm = useCallback(() => {
		setCancelConfirmVisible(false)
		setItemToCancel(null)
	}, [])

	// 下拉刷新
	const handleRefresh = useCallback(async () => {
		await refresh()
	}, [refresh])

	// 显示 loading - 只有初次加载时才显示
	if (isLoading && data.length === 0 && lastFetchTime === 0) {
		return <LoadingSpinner />
	}

	// 显示空状态
	if (!isLoading && data.length === 0) {
		return (
			<div className={styles.container}>
				{/* 搜索栏 */}
				{!hideSearchBar && (
					<div className={styles.searchBarWrapper}>
						<MobileSearchBar
							searchText={localSearchText}
							onSearchChange={setLocalSearchText}
							searchPlaceholder={t("shareManagement.searchProjectName")}
						/>
					</div>
				)}
				<div className={styles.listWrapper}>
					<ShareListEmptyState resourceType={SharedResourceType.Project} />
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			{/* 搜索栏 */}
			{!hideSearchBar && (
				<div className={styles.searchBarWrapper}>
					<MobileSearchBar
						searchText={localSearchText}
						onSearchChange={setLocalSearchText}
						searchPlaceholder={t("shareManagement.searchProjectName")}
					/>
				</div>
			)}

			{/* 列表 */}
			<div className={styles.listWrapper}>
				<MagicPullToRefresh
					onRefresh={handleRefresh}
					height="100%"
					showSuccessMessage={false}
				>
					<MagicScrollBar
						autoHide={false}
						className={styles.scrollContainer}
						scrollableNodeProps={{
							ref: scrollableNodeRef as React.MutableRefObject<HTMLElement>,
						}}
					>
						{/* 列表项 */}
						<div className="flex flex-col gap-0">
							{data.map((item) => (
								<MobileProjectFileShareItem
									key={item.resource_id}
									item={item}
									onEdit={() => handleEditShare(item)}
									onCancelShare={() => handleCancelShare(item)}
									disableProjectNavigation={disableProjectNavigation}
									showProjectBadge={showProjectBadge}
								/>
							))}
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

						{/* 加载更多触发器 - 使用 IntersectionObserver */}
						{hasMore && !isLoadingMore && data.length > 0 && (
							<div ref={loadMoreTriggerRef} style={{ height: "1px" }} />
						)}
					</MagicScrollBar>
				</MagicPullToRefresh>
			</div>

			{/* 分享Modal */}
			{selectedItem && (
				<ShareModal
					open={shareModalOpen}
					onCancel={handleCloseShareModal}
					shareMode={ShareMode.Project}
					resourceId={selectedItem.resource_id}
					projectId={selectedItem.project_id}
					types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
					handleOk={handleShareSettingsUpdate}
					onCancelShare={cancelShare}
					onSaveSuccess={refresh}
				/>
			)}

			{/* 取消分享确认对话框 */}
			<MagicModal
				open={cancelConfirmVisible}
				onCancel={handleCancelConfirm}
				onOk={handleConfirmCancelShare}
				title={t("shareManagement.cancelShareConfirmTitle")}
				okText={t("common.confirm")}
				cancelText={t("common.cancel")}
				okButtonProps={{
					className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
				}}
			>
				{t("shareManagement.cancelShareConfirmContent")}
			</MagicModal>
		</div>
	)
}

export default observer(MobileProjectShareList)
