import MagicModal from "@/components/base/MagicModal"
import { memo, useMemo, useState, useEffect, useCallback } from "react"
import FileShareModal from "./FileShareModal"
import ShareSuccessModal from "./FileShareModal/ShareSuccessModal"
import MobileTopicShare from "./MobileTopicShare"
import TopicSharePopover from "@/pages/superMagic/components/TopicSharePopover"
import { Tooltip, Button } from "antd"
import { createStyles } from "antd-style"
import type { ShareModalProps } from "./types"
import { ShareType, ShareMode } from "./types"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { useResetState, useResponsive, useUpdateEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import MobileButton from "@/pages/superMagicMobile/components/MobileButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import { openShareManagementModal } from "@/pages/superMagic/components/ShareManagement/openShareManagementModal"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ShareListRefreshType } from "@/pages/superMagic/components/ShareManagement/types"
import magicToast from "@/components/base/MagicToaster/utils"
import projectFilesStore from "@/stores/projectFiles"
import { isInApp } from "@/pages/superMagicMobile/utils/mobile"

const useStyles = createStyles(({ css, token }) => ({
	shareModal: {
		padding: "10px !important",
		width: "inherit",
	},
	modalTitle: {
		maxWidth: "70%",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	shareFileModal: {
		".magic-modal-body": {
			padding: "0 !important",
		},
	},
	titleWithButton: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: calc(100% - 42px);
	`,
	cancelShareButton: css`
		color: ${token.colorError}!important;
		background: ${token.magicColorUsages.dangerLight.default};
		&:hover {
			color: ${token.colorError}!important;
			background: ${token.magicColorUsages.dangerLight.hover}!important;
		}
	`,
	headerDotsButton: {
		width: "24px !important",
		height: "24px !important",
	},
}))

export default memo(function ShareModel(props: ShareModalProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const {
		types,
		shareContext,
		onCancel,
		shareMode = ShareMode.Topic,
		open,
		attachments,
		resourceId,
		defaultSelectedFileIds,
		defaultOpenFileId,
		topicTitle,
		projectName,
		projectId,
		handleOk: externalHandleOk,
		onCancelShare,
		onSaveSuccess,
	} = props

	// 默认的取消分享方法
	const handleCancelShareDefault = useCallback(
		async (resourceId: string) => {
			try {
				await SuperMagicApi.cancelShareResource({ resourceId })
				magicToast.success(t("shareManagement.cancelShareSuccess"))
				// 关闭成功弹窗
				setShareSuccessModalVisible(false)
				setShareSuccessData(null)
			} catch (error) {
				console.error("Cancel share failed:", error)
				magicToast.error(t("shareManagement.cancelShareFailed"))
			}
		},
		[t],
	)

	// 最终使用的取消分享方法：如果传入了则使用传入的，否则使用默认的
	const finalCancelShare = onCancelShare || handleCancelShareDefault

	const [type, setType, resetType] = useResetState<ShareType>(() => {
		// 对于话题分享模式，默认使用 None，表示未分享状态
		// 对于文件/项目分享，使用第一个可用类型
		if (shareMode === ShareMode.Topic) {
			return ShareType.None
		}
		return types?.[0] || ShareType.Public
	})

	const [extraData, setExtraData] = useState<any>(undefined) // Start with undefined, let Share component initialize
	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const [modalKey, setModalKey] = useState(0)
	const [actionsPopupVisible, setActionsPopupVisible] = useState(false)

	// ShareSuccessModal 状态（提升到 Modal 层级）
	const [shareSuccessModalVisible, setShareSuccessModalVisible] = useState(false)
	const [shareSuccessData, setShareSuccessData] = useState<{
		shareName: string
		fileCount: number
		mainFileName: string
		shareUrl: string
		password?: string
		expire_at?: string // 过期时间（格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx）
		shareType: ShareType
		resourceId?: string // 添加 resourceId
		shareProject?: boolean // 是否分享整个项目
		projectName?: string // 项目原始名称（用于项目分享时显示）
		fileIds?: string[] // 文件ID列表，用于查询文件详情
	} | null>(null)

	// Reset modal key when modal opens to force remount
	useEffect(() => {
		if (open) {
			setModalKey((prev) => prev + 1)
		}
	}, [open])

	// Load existing share settings when modal opens with resourceId
	useEffect(() => {
		if (!open) return

		const loadShareSettings = async () => {
			try {
				// For topic sharing
				if (shareMode === ShareMode.Topic && shareContext?.resource_id) {
					const settings = await SuperMagicApi.getShareInfoByCode({
						code: shareContext.resource_id,
					})
					const settingsData = settings?.data || settings

					// Update share type if exists (only if already shared)
					if (
						settingsData?.share_type !== undefined &&
						settingsData.share_type !== ShareType.None
					) {
						setType(settingsData.share_type as ShareType)

						// Load extraData only if already shared
						const extra = settingsData?.extra || {}
						const passwordEnabled = !!settingsData?.password
						const password = settingsData?.password || ""
						const baseUrl = `${window.location.origin}/share/topic/${shareContext.resource_id}`
						const shareUrlWithPassword =
							passwordEnabled && password
								? `${baseUrl}?password=${password}`
								: baseUrl

						setExtraData({
							passwordEnabled,
							password,
							shareUrl: shareUrlWithPassword,
							allowCopy: extra?.allow_copy_project_files ?? true,
							view_file_list: extra?.view_file_list ?? true,
							showOriginalInfo: extra?.show_original_info ?? true,
							hideCreatorInfo: extra?.hide_created_by_super_magic ?? false,
							allowDownloadProjectFile: extra?.allow_download_project_file ?? true,
						})
					} else {
						// 如果没有分享设置
						if (shareMode === ShareMode.Topic) {
							// 话题模式下，设置为 None 表示未分享
							setType(ShareType.None)
						} else {
							// 文件/项目模式下，使用默认分享类型
							setType(types?.[0] || ShareType.Public)
						}
						setExtraData(undefined)
					}
				}
			} catch (error) {
				console.error("Failed to load share settings:", error)
			}
		}

		loadShareSettings()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, shareMode, shareContext?.resource_id])

	// Reset type when resource_id changes (but not when loading settings)
	useUpdateEffect(() => {
		// Only reset if modal is not open (to avoid resetting after loading settings)
		if (!open) {
			resetType()
		}
	}, [shareContext?.resource_id, open])

	// Generate title based on sharing mode
	const modalTitle = useMemo(() => {
		if (shareMode === ShareMode.File || shareMode === ShareMode.Project) {
			return t("share.shareFile")
		}
		return t("share.shareTopic")
	}, [shareMode, t])

	const handleOk = async (newType: ShareType, newExtraData?: any) => {
		// Call external handleOk if provided (for list management scenarios)
		if (externalHandleOk) {
			externalHandleOk(newType, newExtraData)
		}
		// Share component handles saving internally
	}

	const handleCancel = useCallback(
		async (event?: React.MouseEvent<HTMLButtonElement>) => {
			onCancel?.(event)
			setExtraData(undefined)
			setShareSuccessData(null)
		},
		[onCancel],
	)

	// 头部不再显示取消分享按钮，因为 Footer 已经有了
	const shouldShowCancelButton = false

	// 取消分享的回调
	const handleCancelShare = useCallback(() => {
		if (!resourceId || !onCancelShare) {
			return
		}

		// 根据分享模式选择不同的确认文案
		const confirmContent =
			shareMode === ShareMode.File
				? t("shareManagement.cancelFileShareConfirm")
				: t("shareManagement.cancelShareConfirm")

		// 显示确认弹窗
		MagicModal.confirm({
			title: t("common.tip"),
			content: confirmContent,
			onOk: async () => {
				// 调用父组件传入的 onCancelShare 回调，由它负责调用 API 和更新列表
				await onCancelShare(resourceId)

				// 关闭弹层
				handleCancel()
			},
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			okButtonProps: {
				variant: "destructive",
			},
		})
	}, [resourceId, onCancelShare, handleCancel, shareMode, t])

	// 渲染带取消分享按钮的标题
	const renderTitleWithCancelButton = useCallback(
		(title: string) => {
			if (!shouldShowCancelButton) {
				return <div className={styles.modalTitle}>{title}</div>
			}

			return (
				<div className={styles.titleWithButton}>
					<Tooltip
						title={title}
						placement="topLeft"
						styles={{ root: { maxWidth: "600px" } }}
					>
						<div className={styles.modalTitle}>{title}</div>
					</Tooltip>
					<Button
						type="primary"
						className={styles.cancelShareButton}
						onClick={handleCancelShare}
					>
						{t("share.cancelShare")}
					</Button>
				</div>
			)
		},
		[shouldShowCancelButton, styles, t, handleCancelShare],
	)

	// ===== Mobile 特有的逻辑 =====
	// Mobile actions popup config
	const mobileActions = useMemo<ActionsPopup.ActionButtonConfig[]>(() => {
		const actions: ActionsPopup.ActionButtonConfig[] = []

		// 管理分享链接（移动端始终显示）
		actions.push({
			key: "manageShare",
			label: t("share.manageShareLinks"),
			onClick: () => {
				setActionsPopupVisible(false)
				// 打开分享管理面板
				openShareManagementModal()
				handleCancel()
			},
		})

		// 取消分享（只有编辑模式才显示）
		if (shouldShowCancelButton) {
			actions.push({
				key: "cancelShare",
				label: t("share.cancelShare"),
				onClick: () => {
					setActionsPopupVisible(false)
					handleCancelShare()
				},
				variant: "danger",
			})
		}

		return actions
	}, [shouldShowCancelButton, t, handleCancelShare, handleCancel])

	const handleOpenActionsPopup = useCallback(() => {
		setActionsPopupVisible(true)
	}, [])

	const handleCloseActionsPopup = useCallback(() => {
		setActionsPopupVisible(false)
	}, [])

	// 文件分享模式和项目分享模式都使用FileShareModal
	if (shareMode === ShareMode.File || shareMode === ShareMode.Project) {
		return (
			<>
				{!isMobile ? (
					<MagicModal
						title={renderTitleWithCancelButton(modalTitle)}
						open={open && !shareSuccessModalVisible}
						width={800}
						onCancel={handleCancel}
						classNames={{ content: styles.shareFileModal }}
						footer={null}
						zIndex={1400}
						maskClosable={false} // 禁止点击 mask 关闭
					>
						<FileShareModal
							key={`file-share-${resourceId || shareSuccessData?.resourceId || "new"}-${modalKey}`}
							attachments={attachments}
							attachmentList={projectFilesStore.workspaceFilesList}
							types={types}
							resourceId={resourceId || shareSuccessData?.resourceId}
							defaultSelectedFileIds={defaultSelectedFileIds}
							defaultOpenFileId={defaultOpenFileId}
							shareMode={shareMode}
							projectName={projectName}
							projectId={projectId}
							onCancel={handleCancel}
							onSaveSuccess={(data) => {
								// 设置成功数据并显示 ShareSuccessModal
								setShareSuccessData(data)
								setShareSuccessModalVisible(true)
								// 关闭主弹窗
								// handleCancel()
								// 调用外部回调
								onSaveSuccess?.()
							}}
							onCancelShareSuccess={() => {
								// 调用父组件传递的回调（用于更新列表）
								if (resourceId || shareSuccessData?.resourceId) {
									onCancelShare?.(
										resourceId || shareSuccessData?.resourceId || "",
									)
								}
								// 取消分享后关闭弹窗
								handleCancel()
							}}
						/>
					</MagicModal>
				) : (
					<CommonPopup
						title={modalTitle}
						headerExtra={
							<MobileButton
								borderDisabled={open}
								className={styles.headerDotsButton}
								onClick={handleOpenActionsPopup}
							>
								<MagicIcon size={22} stroke={2} component={IconDots} />
							</MobileButton>
						}
						popupProps={{
							visible: open && !shareSuccessModalVisible,
							onClose: () => {
								handleCancel()
							},
							onMaskClick: () => {
								handleCancel()
							}, // 移动端允许点击 mask 关闭
							showCloseButton: false,
						}}
						wrapperStyle={{
							maxHeight: `calc(100vh - ${isInApp() ? 44 : 130}px - 60px - var(--safe-area-inset-top) - var(--safe-area-inset-bottom))`,
						}}
					>
						<FileShareModal
							key={`file-share-${resourceId || shareSuccessData?.resourceId || "new"}-${modalKey}`}
							attachments={attachments}
							attachmentList={projectFilesStore.workspaceFilesList}
							types={types}
							resourceId={resourceId || shareSuccessData?.resourceId}
							defaultSelectedFileIds={defaultSelectedFileIds}
							defaultOpenFileId={defaultOpenFileId}
							shareMode={shareMode}
							projectName={projectName}
							projectId={projectId}
							onCancel={handleCancel}
							onSaveSuccess={(data) => {
								// 设置成功数据并显示 ShareSuccessModal
								setShareSuccessData(data)
								setShareSuccessModalVisible(true)
								// 关闭主弹窗
								// handleCancel()
								// 调用外部回调
								onSaveSuccess?.()
							}}
							onCancelShareSuccess={() => {
								// 调用父组件传递的回调（用于更新列表）
								if (resourceId || shareSuccessData?.resourceId) {
									onCancelShare?.(
										resourceId || shareSuccessData?.resourceId || "",
									)
								}
								// 取消分享后关闭弹窗
								handleCancel()
							}}
						/>
					</CommonPopup>
				)}

				{/* Actions Popup for mobile */}
				<ActionsPopupComponent
					visible={actionsPopupVisible}
					title={t("shareManagement.more")}
					actions={mobileActions}
					onClose={handleCloseActionsPopup}
				/>

				{/* Share Success Modal - 独立渲染，不受 FileShareModal 关闭影响 */}
				{shareSuccessData && (
					<ShareSuccessModal
						open={shareSuccessModalVisible}
						onClose={() => {
							setShareSuccessModalVisible(false)

							// 发布刷新分享列表事件 - 在关闭成功提示后才刷新列表
							if (shareSuccessData?.shareProject) {
								pubsub.publish(
									PubSubEvents.Refresh_Share_List,
									ShareListRefreshType.Project,
								)
							} else {
								pubsub.publish(
									PubSubEvents.Refresh_Share_List,
									ShareListRefreshType.File,
								)
							}

							setShareSuccessData(null)
							// 关闭最外层的 Modal
							handleCancel()
						}}
						onEditShare={
							shareSuccessData?.resourceId
								? () => {
									// 关闭成功弹窗，回到编辑模式
									setShareSuccessModalVisible(false)
									// 保留 shareSuccessData，确保 FileShareModal 能够获取 resourceId
									// FileShareModal 会重新显示，并以编辑模式加载（因为 resourceId 存在）
								}
								: undefined
						}
						onCancelShare={
							shareSuccessData?.resourceId
								? () => finalCancelShare(shareSuccessData.resourceId || "")
								: undefined
						}
						{...shareSuccessData}
					/>
				)}
			</>
		)
	}

	// 话题分享模式使用 TopicSharePopover 组件
	// PC端：使用 TopicSharePopover（内部使用 Dialog）
	// 移动端：保持使用 MobileTopicShare
	if (!isMobile) {
		// 如果没有 topicId，不渲染
		if (!shareContext?.resource_id) {
			return null
		}
		return (
			<TopicSharePopover
				open={open ?? false}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						handleCancel()
					}
				}}
				topicId={shareContext.resource_id}
				topicTitle={topicTitle}
				onSaveSuccess={onSaveSuccess}
			/>
		)
	}

	// 移动端保持原有逻辑
	return (
		<CommonPopup
			title={t("share.shareTopic")}
			popupProps={{
				visible: open,
				onClose: () => {
					handleCancel()
				},
				onMaskClick: () => {
					handleCancel()
				}, // 移动端允许点击 mask 关闭
				showCloseButton: false,
				bodyStyle: {
					height: "auto",
				},
			}}
		>
			<MobileTopicShare
				shareContext={shareContext}
				extraData={extraData}
				setExtraData={setExtraData}
				type={type}
				onSaveSuccess={onSaveSuccess}
				onClose={handleCancel}
			/>
		</CommonPopup>
	)
})
