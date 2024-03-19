import { PropsWithChildren, ReactNode, useCallback, useMemo, Children } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import {
	IconChevronLeft,
	IconChevronRight,
	IconDownload,
	IconCopy,
	IconShare,
	IconMaximize,
	IconMinimize,
	IconDots,
	IconViewfinder,
	IconCaretDownFilled,
} from "@tabler/icons-react"
import { Flex, Divider, Dropdown } from "antd"
import { DetailType } from "../../types"
import { useStyles } from "./ActionButton.style"
import { useTranslation } from "react-i18next"
import { ActionButton, NavigationButton, FileShareModals } from "./components"
import ViewModeSwitcher from "../ViewModeSwitcher"
import IconOpenWindow from "@/opensource/pages/superMagic/assets/svg/tabler-icon-open-window.svg"
import { useLocation } from "react-router"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import useShareRoute from "@/opensource/pages/superMagic/hooks/useShareRoute"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useShowButtonText } from "@/opensource/hooks/useShowButtonText"
import RotateIcon from "@/opensource/pages/superMagic/assets/svg/rotate_2.svg"
import {
	DownloadImageMode,
	FileHistoryVersion,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useDownloadImageMenu } from "../../contents/Image/hooks/useDownloadImageMenu"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"
import { observer } from "mobx-react-lite"
import { useFileVersionsMenuItems, useFileShare } from "./hooks"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface ActionButtonsProps extends PropsWithChildren {
	type?: string
	currentAttachmentIndex?: number
	totalFiles?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: (mode?: DownloadImageMode) => void
	onClose?: () => void
	setUserSelectDetail?: (detail: any) => void
	hasUserSelectDetail?: boolean
	isFromNode?: boolean
	isFullscreen?: boolean
	isMobile?: boolean
	// New props for file sharing
	viewMode?: "code" | "desktop" | "phone" // Current view mode
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void // Switch view mode
	onCopy?: (fileVersion?: number) => void // Copy functionality
	onShare?: () => void // Share functionality
	onFavorite?: () => void // Favorite functionality
	fileContent?: string // File content for copying
	isFavorited?: boolean // Whether favorited
	// File sharing specific props
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
		source?: AttachmentSource
	}
	topicId?: string
	baseShareUrl?: string
	onOpenUrl?: () => void
	detailMode?: "single" | "files"
	showDownload?: boolean
	children?: ReactNode
	/** 当前是否编辑状态 */
	isEditMode?: boolean
	exportButton?: ReactNode
	/** 文件版本 */
	fileVersion?: number
	/** 是否是最新的文件版本 */
	isNewestFileVersion?: boolean
	/** 是否显示刷新按钮 */
	showRefreshButton?: boolean
	/** 文件版本列表 */
	fileVersionsList?: FileHistoryVersion[]
	/** 切换文件版本 */
	handleChangeFileVersion?: (version: number, isNewestVersion: boolean) => void
	/** 是否允许编辑 */
	allowEdit?: boolean
	/** 附件列表 */
	attachments?: any[]
	/** 是否为 PPT 根渲染 */
	isPPTRootRender?: boolean
	/** 是否允许下载（用于分享页面权限控制） */
	allowDownload?: boolean
}

function ActionButtons(props: ActionButtonsProps) {
	const {
		type,
		currentAttachmentIndex = -1,
		totalFiles = 0,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		onClose,
		setUserSelectDetail,
		hasUserSelectDetail = true,
		isFromNode = false,
		isFullscreen = false,
		viewMode = "desktop",
		onViewModeChange,
		onCopy,
		onShare,
		onFavorite,
		fileContent,
		isFavorited = false,
		currentFile,
		topicId,
		baseShareUrl,
		onOpenUrl,
		detailMode,
		showDownload = true,
		children,
		isEditMode,
		exportButton,
		fileVersion,
		isNewestFileVersion = true,
		showRefreshButton = true,
		fileVersionsList,
		handleChangeFileVersion,
		allowEdit = true,
		attachments,
		isPPTRootRender = false,
		allowDownload,
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const { pathname } = useLocation()
	const { isFileShare, isShareRoute } = useShareRoute()
	const isMobile = useIsMobile()
	const showButtonText = useShowButtonText()

	// File sharing hook
	const {
		shareModalVisible,
		showSuccessModal,
		existingShareInfo,
		shareFileId,
		showSimilarSharesDialog,
		similarShares,
		isCheckingShare,
		handleShare: handleFileShare,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setShareModalVisible,
		setShowSuccessModal,
		setExistingShareInfo,
		closeSimilarSharesDialog,
	} = useFileShare({
		currentFile,
		attachments,
	})

	// Handle copy
	const handleCopy = useCallback(
		async (fileVersion?: number) => {
			if (onCopy) {
				onCopy(fileVersion)
			} else if (fileContent) {
				try {
					await clipboard.writeText(fileContent)
					magicToast.success(t("common.copySuccess"))
				} catch (error) {
					console.error("复制失败:", error)
					magicToast.error(t("common.copyFailed"))
				}
			}
		},
		[onCopy, fileContent, t],
	)

	// Handle favorite
	const handleFavorite = useCallback(() => {
		if (onFavorite) {
			onFavorite()
		}
	}, [onFavorite])

	// 判断是否可以导航
	const canNavigatePrev = currentAttachmentIndex > 0
	const canNavigateNext = currentAttachmentIndex < totalFiles - 1 && totalFiles > 0

	// 判断当前文件类型是否可以下载
	const isDownloadable = () => {
		if (isFromNode) return false
		// 判断是否为可下载的文件类型：pdf、html、md、文本或代码文件
		return (
			type &&
			(type === DetailType.Pdf ||
				type === DetailType.Docx ||
				type === DetailType.Html ||
				type === DetailType.Md ||
				type === DetailType.Text ||
				type === DetailType.Code ||
				type === DetailType.Excel ||
				type === DetailType.Docx ||
				type === DetailType.PowerPoint ||
				type === DetailType.Image ||
				type === DetailType.Video ||
				type === DetailType.Audio ||
				type === DetailType.NotSupport)
		)
	}

	// 判断是否支持代码/预览切换
	const supportsViewModeToggle = () => {
		// PPT 根渲染不显示视图切换
		if (isPPTRootRender) return false

		if (type === DetailType.Md) return true

		if (type === DetailType.Html) return !isEditMode
		return false
	}

	// 判断是否支持复制功能（主要是代码文件和markdown/html的代码模式）
	const supportsCopy = () => {
		if (isFromNode) return false
		return (
			type === DetailType.Code ||
			type === DetailType.Text ||
			type === DetailType.Md ||
			(type === DetailType.Html && viewMode === "code")
		)
	}

	// 判断是否需要显示分享、收藏等基础功能
	const showBasicActions = () => {
		return (
			type === DetailType.Pdf ||
			type === DetailType.Docx ||
			type === DetailType.Excel ||
			type === DetailType.Docx ||
			type === DetailType.PowerPoint ||
			type === DetailType.Md ||
			type === DetailType.Html ||
			type === DetailType.Code ||
			type === DetailType.Text ||
			type === DetailType.Image ||
			type === DetailType.Video ||
			type === DetailType.Audio ||
			type === DetailType.NotSupport
		)
	}

	const showOpenUrlButton = useMemo(() => {
		return type === DetailType.Browser
	}, [type])

	const handleOpenUrl = () => {
		if (onOpenUrl) {
			onOpenUrl()
		}
	}

	// 处理左右切换
	const handlePrevious = () => {
		if (onPrevious) {
			if (onViewModeChange) {
				onViewModeChange("desktop")
			}
			onPrevious()
		}
	}

	const handleNext = () => {
		if (onNext) {
			if (onViewModeChange) {
				onViewModeChange("desktop")
			}
			onNext()
		}
	}

	// 处理全屏
	const handleFullscreen = () => {
		if (onFullscreen) {
			onFullscreen()
		}
	}

	// 处理下载
	const handleDownload = () => {
		if (onDownload) {
			onDownload()
		}
	}

	// 处理关闭
	const handleClose = () => {
		if (onClose) {
			onClose()
		} else if (setUserSelectDetail) {
			setUserSelectDetail(null)
		}
	}

	// 处理查看模式切换
	const handleViewModeChange = (mode: "code" | "desktop" | "phone") => {
		if (onViewModeChange) {
			onViewModeChange(mode)
		}
	}

	const handleRefresh = () => {
		pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
	}

	/** 处理定位到文件 */
	const handleLocateFile = useCallback(() => {
		if (currentFile?.id) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, currentFile.id)
		}
	}, [currentFile])

	// Generate file versions menu items
	const fileVersionsMenuItem = useFileVersionsMenuItems({
		fileVersionsList,
		fileVersion,
		handleChangeFileVersion,
		t,
		styles,
	})

	/** 更多操作下拉菜单 */
	const moreOperationsDropdownItems = useMemo(() => {
		if (isPPTRootRender) {
			return []
		}

		const items: any[] = [
			{
				label: (
					<div className={styles.fileVersionsDropdownItem}>
						<IconViewfinder size={16} />
						<div className={styles.fileVersionsDropdownItemTitle}>
							{t("fileViewer.locateFile")}
						</div>
					</div>
				),
				key: "locateFile",
				onClick: handleLocateFile,
			},
			...(isShareRoute ? [] : [fileVersionsMenuItem]),
		]

		return items
	}, [isShareRoute, isPPTRootRender, t, styles, handleLocateFile, fileVersionsMenuItem])

	// 下载图片下拉菜单
	const { agreementModal, downloadImageDropdownItems, downloadMenuClick, isFreeTrialVersion } =
		useDownloadImageMenu({
			onDownload,
		})

	const isAIImage = currentFile?.source === AttachmentSource.AI && type === DetailType.Image

	return (
		<>
			<div className={cx(styles.actionButtons, isMobile && styles.mobileActionButtons)}>
				{/* 文件导航按钮，只在移动端显示，分享文件不显示导航按钮 */}
				{!isFromNode && hasUserSelectDetail && isMobile && !isFileShare && (
					<Flex gap={4} align="center">
						<NavigationButton
							icon={IconChevronLeft}
							onClick={handlePrevious}
							disabled={!canNavigatePrev}
							title={t("fileViewer.previous")}
						/>
						<NavigationButton
							icon={IconChevronRight}
							onClick={handleNext}
							disabled={!canNavigateNext}
							title={t("fileViewer.next")}
						/>
					</Flex>
				)}
				<Flex gap={2} align="center" justify="flex-end">
					{/* 代码/预览切换按钮 - 仅对 MD/HTML 文件显示 */}
					{supportsViewModeToggle() && (
						<>
							<ViewModeSwitcher
								viewMode={viewMode}
								onViewModeChange={handleViewModeChange}
								isMobile={isMobile}
							/>
							<Divider type="vertical" />
						</>
					)}
					{children}
					{Children.toArray(children)?.length > 1 && <Divider type="vertical" />}
					{/* 功能按钮组 */}
					{showBasicActions() && !isEditMode && (
						<>
							<>
								{detailMode === "files" &&
									type !== DetailType.NotSupport &&
									isNewestFileVersion &&
									showRefreshButton && (
										<ActionButton
											element={<img src={RotateIcon} />}
											onClick={handleRefresh}
											title={t("fileViewer.refresh")}
											text={t("fileViewer.refresh")}
											showText={showButtonText}
										/>
									)}

								{/* 下载按钮 */}
								{currentFile?.id &&
									isDownloadable() &&
									showDownload &&
									!(isShareRoute && allowDownload === false) &&
									(isAIImage ? (
										<Dropdown
											key={`download-dropdown-${isFreeTrialVersion}`}
											menu={{
												rootClassName: styles.moreOperationsDropdown,
												items: downloadImageDropdownItems,
												onClick: downloadMenuClick,
											}}
											trigger={["click"]}
											placement="bottomRight"
										>
											<ActionButton
												icon={IconDownload}
												rightIcon={IconCaretDownFilled}
												rightIconSize={14}
												title={t("fileViewer.download")}
												text={t("fileViewer.download")}
												showText={showButtonText}
											/>
										</Dropdown>
									) : (
										<ActionButton
											icon={IconDownload}
											onClick={handleDownload}
											title={t("fileViewer.download")}
											text={t("fileViewer.download")}
											showText={showButtonText}
										/>
									))}
								{exportButton}

								{/* 复制按钮 - 代码文件或代码模式下显示 */}
								{supportsCopy() && (
									<ActionButton
										icon={IconCopy}
										onClick={() => handleCopy(fileVersion)}
										title={t("fileViewer.copy")}
										text={t("fileViewer.copy")}
										showText={showButtonText}
									/>
								)}

								{/* 收藏按钮 */}
								{/* <ActionButton
								icon={IconStar}
								onClick={handleFavorite}
								title={t("fileViewer.favorite")}
								text={showButtonText ? t("fileViewer.favorite") : undefined}
								showText={showButtonText}
								className={isFavorited ? styles.favorited : ""}
							/> */}

								{/* 分享按钮 */}
								{currentFile?.id &&
									!isShareRoute &&
									allowEdit &&
									isNewestFileVersion && (
										<ActionButton
											icon={IconShare}
											onClick={handleFileShare}
											title={t("fileViewer.share")}
											text={t("fileViewer.share")}
											showText={showButtonText}
											loading={isCheckingShare}
											disabled={isCheckingShare}
										/>
									)}
							</>
						</>
					)}
					{showOpenUrlButton && !isEditMode && (
						<ActionButton
							icon_url={IconOpenWindow}
							onClick={handleOpenUrl}
							text={t("fileViewer.openUrl")}
							showText={true}
							className={styles.openUrlButton}
						/>
					)}
					{/* 全屏按钮 - 移动端不显示 */}
					{!isMobile && (
						<ActionButton
							icon={isFullscreen ? IconMinimize : IconMaximize}
							onClick={handleFullscreen}
							title={
								isFullscreen
									? t("fileViewer.exitFullscreen")
									: t("fileViewer.fullscreen")
							}
							text={
								isFullscreen
									? t("fileViewer.exitFullscreen")
									: t("fileViewer.fullscreen")
							}
							showText={showButtonText}
						/>
					)}

					{!isMobile &&
						!isFromNode &&
						detailMode === "files" &&
						moreOperationsDropdownItems.length > 0 && (
							<Dropdown
								menu={{
									rootClassName: styles.moreOperationsDropdown,
									items: moreOperationsDropdownItems,
								}}
								trigger={["click"]}
								placement="bottomRight"
							>
								<ActionButton
									icon={IconDots}
									title={t("fileViewer.more")}
									text={t("fileViewer.more")}
									showText={showButtonText}
								/>
							</Dropdown>
						)}
					{/* 关闭按钮 - 保留原有逻辑，暂时注释 */}
					{/* {hasUserSelectDetail && !isMobile && (
				<MagicIcon
					size={28}
					component={IconX}
					stroke={2}
					className={`${styles.iconCommon}`}
					onClick={handleClose}
				/>
			)} */}
				</Flex>
			</div>

			{/* File sharing modals */}
			<FileShareModals
				shareModalVisible={shareModalVisible}
				onCloseShareModal={() => {
					setShareModalVisible(false)
					setExistingShareInfo(null)
				}}
				showSuccessModal={showSuccessModal}
				existingShareInfo={existingShareInfo}
				currentFile={currentFile}
				shareFileId={shareFileId}
				attachments={attachments}
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

			{agreementModal}
		</>
	)
}

export default observer(ActionButtons)
