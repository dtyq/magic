import { memo, useCallback, useMemo, useRef } from "react"
import type { MenuProps } from "antd"
import { Dropdown } from "antd"
import {
	Check,
	ChevronDown,
	Copy,
	Download,
	ExternalLink,
	Fullscreen,
	History,
	Maximize2,
	Minimize2,
	MoreHorizontal,
	RefreshCcw,
	Share2,
	View,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useContainerShowButtonText } from "@/hooks/useContainerShowButtonText"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { useDownloadImageMenu } from "../../contents/Image/hooks/useDownloadImageMenu"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import ViewModeSwitcher from "../ViewModeSwitcher"
import ActionButton from "../CommonHeader/components/ActionButton"
import FileShareModals from "../CommonHeader/components/FileShareModals"
import { HistoryVersionBanner } from "../CommonHeader/components/HistoryVersionBanner"
import { useFileShare } from "../CommonHeader/hooks/useFileShare"
import ActionRenderer from "./actions/renderer"
import { composeHeaderActions } from "./actions/composer"
import type { BuiltinComposedAction, CommonHeaderV2Props } from "./types"
import { DetailType } from "../../types"
import { MagicDropdown } from "@/components/base"
import { IconShare3 } from "@tabler/icons-react"

export default memo(function CommonHeaderV2(props: CommonHeaderV2Props) {
	const {
		renderMode = "full",
		type,
		onFullscreen,
		onDownload,
		isFromNode = false,
		isFullscreen = false,
		viewMode = "desktop",
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		onOpenUrl,
		detailMode,
		showDownload = true,
		isEditMode = false,
		fileVersion,
		isNewestFileVersion = true,
		showRefreshButton = true,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		quitEditMode,
		allowEdit = true,
		attachments,
		actionConfig,
		getPopupContainer,
	} = props
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const headerContainerRef = useRef<HTMLDivElement>(null)
	const rightActionsContainerRef = useRef<HTMLDivElement>(null)
	const showButtonText = useContainerShowButtonText(rightActionsContainerRef)

	const { isShareRoute } = useShareRoute()

	const handleRefresh = useCallback(() => {
		pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
	}, [])

	const handleLocateFile = useCallback(() => {
		if (currentFile?.id) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, currentFile.id)
		}
	}, [currentFile?.id])

	const handleChangeFileVersion = useCallback(
		(version: number, isNewestVersion: boolean) => {
			if ((fileVersion && fileVersion === version) || (!fileVersion && isNewestVersion))
				return
			if (isEditMode) {
				quitEditMode?.()
			}
			changeFileVersion?.(isNewestVersion ? undefined : version)
		},
		[changeFileVersion, fileVersion, isEditMode, quitEditMode],
	)

	const handleCopy = useCallback(
		async (targetVersion?: number) => {
			if (onCopy) {
				onCopy(targetVersion)
				return
			}

			if (!fileContent) {
				return
			}

			try {
				await navigator.clipboard.writeText(fileContent)
			} catch (error) {
				console.error("Copy failed:", error)
			}
		},
		[fileContent, onCopy],
	)

	const {
		shareModalVisible,
		showSuccessModal,
		existingShareInfo,
		shareFileId,
		showSimilarSharesDialog,
		similarShares,
		isCheckingShare,
		handleShare,
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

	const { agreementModal, downloadImageDropdownItems, downloadMenuClick, isFreeTrialVersion } =
		useDownloadImageMenu({
			onDownload,
		})

	const actionContext = useMemo(
		() => ({
			type,
			viewMode,
			isMobile,
			showButtonText,
			isShareRoute,
			isFromNode,
			isFullscreen,
			isEditMode,
			detailMode,
			showDownload,
			showRefreshButton,
			isNewestFileVersion,
			allowEdit,
			currentFile,
			attachments,
			fileContent,
			fileVersion,
			fileVersionsList,
			onFullscreen,
			onDownload,
			onOpenUrl,
			onViewModeChange,
			onCopy,
			onRefresh: handleRefresh,
			onLocateFile: handleLocateFile,
			onShare: handleShare,
			changeFileVersion: handleChangeFileVersion,
			getPopupContainer,
		}),
		[
			allowEdit,
			attachments,
			currentFile,
			detailMode,
			fileContent,
			fileVersion,
			fileVersionsList,
			handleChangeFileVersion,
			handleLocateFile,
			handleRefresh,
			handleShare,
			isEditMode,
			isFromNode,
			isFullscreen,
			isMobile,
			isNewestFileVersion,
			isShareRoute,
			onCopy,
			onDownload,
			onFullscreen,
			onOpenUrl,
			onViewModeChange,
			showButtonText,
			showDownload,
			showRefreshButton,
			type,
			viewMode,
			getPopupContainer,
		],
	)

	const actions = useMemo(
		() => composeHeaderActions(actionContext, actionConfig),
		[actionContext, actionConfig],
	)

	const moreOperationsDropdownItems = useMemo<MenuProps["items"]>(() => {
		const versionChildren: NonNullable<MenuProps["items"]>[number][] = (
			fileVersionsList || []
		).map((item, index) => {
			const isCurrent = item.version === fileVersion || (!fileVersion && index === 0)
			return {
				key: `version-${item.version}`,
				label: (
					<div className="flex min-w-[200px] items-center justify-between gap-3 py-1">
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-1.5 text-xs">
								<span>
									{index === 0
										? t("common.latestVersion")
										: t("common.historyVersion")}
								</span>
								<span className="rounded bg-muted px-1.5 py-0.5">
									v{item.version}
								</span>
							</div>
							<div className="text-[11px] text-muted-foreground">
								{item.created_at}
							</div>
						</div>
						{isCurrent ? <Check size={14} /> : null}
					</div>
				),
				onClick: () => handleChangeFileVersion(item.version, index === 0),
			}
		})

		const historyItem = {
			key: "historyVersion",
			label: (
				<div className="flex items-center gap-1.5 text-sm">
					<History size={16} />
					<span>{t("common.historyVersion")}</span>
				</div>
			),
			children:
				versionChildren.length > 0
					? versionChildren
					: [
						{
							key: "noHistoryVersion",
							label: (
								<div className="px-2 py-1 text-xs text-muted-foreground">
									{t("common.noHistoryVersionHint")}
								</div>
							),
						},
					],
		}

		return [
			{
				key: "locateFile",
				label: (
					<div className="flex items-center gap-1.5 text-sm">
						<View size={16} />
						<span>{t("fileViewer.locateFile")}</span>
					</div>
				),
				onClick: handleLocateFile,
			},
			...(isShareRoute ? [] : [historyItem]),
		]
	}, [fileVersionsList, fileVersion, handleChangeFileVersion, handleLocateFile, isShareRoute, t])

	const renderBuiltinAction = useCallback(
		(action: BuiltinComposedAction) => {
			const shouldShowActionText = showButtonText
			const runAction = () => {
				if (action.disabled) return
				if (action.onClick) {
					void action.onClick(actionContext)
					return
				}

				switch (action.key) {
					case "refresh":
						handleRefresh()
						return
					case "download":
						onDownload?.()
						return
					case "copy":
						void handleCopy(fileVersion)
						return
					case "share":
						void handleShare()
						return
					case "openUrl":
						onOpenUrl?.()
						return
					case "fullscreen":
						onFullscreen?.()
						return
					default:
						return
				}
			}

			const titleMap = {
				refresh: t("fileViewer.refresh"),
				download: t("fileViewer.download"),
				copy: t("fileViewer.copy"),
				share: t("fileViewer.share"),
				openUrl: t("fileViewer.openUrl"),
				fullscreen: isFullscreen
					? t("fileViewer.exitFullscreen")
					: t("fileViewer.fullscreen"),
				more: t("fileViewer.more"),
				versionMenu: t("common.historyVersion"),
				viewMode: t("fileViewer.codeMode"),
			}

			if (action.key === "viewMode") {
				return (
					<ViewModeSwitcher
						data-testid="detail-header-view-mode-switcher"
						viewMode={viewMode}
						onViewModeChange={(mode) => onViewModeChange?.(mode)}
						isMobile={isMobile}
					/>
				)
			}

			if (action.key === "more") {
				if (!moreOperationsDropdownItems || moreOperationsDropdownItems.length === 0) {
					return null
				}

				return (
					<MagicDropdown
						menu={{ items: moreOperationsDropdownItems }}
						trigger={["click"]}
						placement="bottomRight"
						getPopupContainer={
							actionContext.getPopupContainer
								? () => actionContext.getPopupContainer?.() ?? document.body
								: undefined
						}
					>
						<div data-testid="detail-header-action-more">
							<ActionButton
								data-testid="detail-header-action-more-button"
								icon={
									<MoreHorizontal
										size={16}
										strokeWidth={1.5}
										style={action.iconStyle}
									/>
								}
								text={action.text || t("fileViewer.more")}
								title={action.tooltip || titleMap.more}
								showText={action.showText ?? shouldShowActionText}
								getPopupContainer={actionContext.getPopupContainer}
							/>
						</div>
					</MagicDropdown>
				)
			}

			const isAIImage =
				currentFile?.source === AttachmentSource.AI &&
				type === DetailType.Image &&
				action.key === "download"

			if (isAIImage) {
				return (
					<MagicDropdown
						key={`download-dropdown-${isFreeTrialVersion}`}
						menu={{ items: downloadImageDropdownItems, onClick: downloadMenuClick }}
						trigger={["click"]}
						placement="bottomRight"
						getPopupContainer={
							actionContext.getPopupContainer
								? () => actionContext.getPopupContainer?.() ?? document.body
								: undefined
						}
					>
						<div data-testid="detail-header-action-download-dropdown">
							<ActionButton
								data-testid="detail-header-action-download-button"
								icon={
									<Download
										size={16}
										strokeWidth={1.5}
										style={action.iconStyle}
									/>
								}
								rightIcon={
									<ChevronDown
										size={14}
										strokeWidth={1.5}
										style={action.iconStyle}
									/>
								}
								text={action.text || t("fileViewer.download")}
								title={action.tooltip || titleMap.download}
								showText={action.showText ?? shouldShowActionText}
								disabled={action.disabled}
								getPopupContainer={actionContext.getPopupContainer}
							/>
						</div>
					</MagicDropdown>
				)
			}

			const iconMap = {
				refresh: <RefreshCcw size={16} strokeWidth={1.5} style={action.iconStyle} />,
				download: <Download size={16} strokeWidth={1.5} style={action.iconStyle} />,
				copy: <Copy size={16} strokeWidth={1.5} style={action.iconStyle} />,
				share: <IconShare3 size={16} strokeWidth={1.5} style={action.iconStyle} />,
				openUrl: <ExternalLink size={16} strokeWidth={1.5} style={action.iconStyle} />,
				fullscreen: isFullscreen ? (
					<Fullscreen size={16} strokeWidth={1.5} style={action.iconStyle} />
				) : (
					<Fullscreen size={16} strokeWidth={1.5} style={action.iconStyle} />
				),
				versionMenu: <History size={16} strokeWidth={1.5} style={action.iconStyle} />,
				more: <MoreHorizontal size={16} strokeWidth={1.5} style={action.iconStyle} />,
				viewMode: <View size={16} strokeWidth={1.5} style={action.iconStyle} />,
			}

			return (
				<ActionButton
					data-testid={`detail-header-action-${action.key}`}
					icon={iconMap[action.key]}
					title={action.tooltip || titleMap[action.key]}
					text={action.text || titleMap[action.key]}
					showText={action.showText ?? shouldShowActionText}
					disabled={action.disabled}
					onClick={runAction}
					loading={action.key === "share" && isCheckingShare}
					getPopupContainer={actionContext.getPopupContainer}
				/>
			)
		},
		[
			actionContext,
			currentFile?.source,
			downloadImageDropdownItems,
			downloadMenuClick,
			fileVersion,
			handleCopy,
			handleRefresh,
			handleShare,
			isCheckingShare,
			isFullscreen,
			isFreeTrialVersion,
			isMobile,
			moreOperationsDropdownItems,
			onDownload,
			onFullscreen,
			onOpenUrl,
			onViewModeChange,
			showButtonText,
			t,
			type,
			viewMode,
		],
	)

	const actionsNode = (
		<HeadlessHorizontalScroll
			className="w-full min-w-0"
			scrollContainerClassName="no-scrollbar w-full min-w-0 overflow-x-auto overflow-y-hidden"
		>
			<ActionRenderer
				actions={actions}
				context={actionContext}
				renderBuiltinAction={renderBuiltinAction}
				rightContainerRef={rightActionsContainerRef}
				gap={actionConfig?.gap}
			/>
		</HeadlessHorizontalScroll>
	)

	if (renderMode === "actions") {
		return (
			<>
				<div ref={headerContainerRef} className="w-full" data-testid="detail-header">
					{actionsNode}
				</div>
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

	return (
		<>
			<div
				ref={headerContainerRef}
				className="relative flex h-11 w-full items-center justify-end gap-2 border-b border-border bg-background px-2.5 text-sm text-muted-foreground"
				data-testid="detail-header"
				data-file-id={currentFile?.id}
			>
				{actionsNode}
			</div>

			{!isNewestFileVersion && !isMobile ? (
				<HistoryVersionBanner
					data-testid="detail-header-history-version-banner"
					fileVersionsList={fileVersionsList}
					fileVersion={fileVersion}
					onReturnLatest={() =>
						handleChangeFileVersion(fileVersionsList?.[0]?.version || 0, true)
					}
					onRollback={handleVersionRollback}
					allowEdit={allowEdit}
				/>
			) : null}

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
})
