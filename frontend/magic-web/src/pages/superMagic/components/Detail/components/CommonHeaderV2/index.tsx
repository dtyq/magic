import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { memo, useCallback, useMemo, useRef } from "react"
import type { MenuProps } from "antd"
import {
	Check,
	ChevronDown,
	Copy,
	Download,
	ExternalLink,
	Fullscreen,
	History,
	MoreHorizontal,
	RefreshCcw,
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
import useFullscreenMode from "@/hooks/useFullscreenMode"
import { guardMenuClick, guardMenuItems, runGuardedAction } from "../../utils/actionGuard"
import { cn } from "@/utils/cn"

export default memo(function CommonHeaderV2(props: CommonHeaderV2Props) {
	const {
		beforeAction,
		testIdsEnabled = true,
		renderMode = "full",
		showBottomBorder = true,
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
		onLocateFile,
		extraMoreMenuItems,
		onCompareVersion,
		onMoreMenuOpenChange,
		moreButtonId,
	} = props
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const {
		permissions: access,
		options: { fullscreen, versionHistory, shareInReadOnly },
	} = useFileAccess()
	const effectiveShowDownload = access.download && showDownload

	const headerContainerRef = useRef<HTMLDivElement>(null)
	const rightActionsContainerRef = useRef<HTMLDivElement>(null)
	const showButtonText = useContainerShowButtonText(rightActionsContainerRef)

	const { isShareRoute } = useShareRoute()
	const isFullscreenMode = useFullscreenMode()

	const handleRefresh = useCallback(() => {
		pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
	}, [])

	const handleLocateFile = useCallback(() => {
		if (onLocateFile) {
			onLocateFile()
			return
		}
		if (currentFile?.id) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, currentFile.id)
		}
	}, [currentFile?.id, onLocateFile])

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
	const guardedDownloadMenuClick = useMemo(
		() => guardMenuClick(beforeAction, downloadMenuClick),
		[beforeAction, downloadMenuClick],
	)

	const mergedActionConfig = useMemo(() => {
		const hideDefaults = new Set(actionConfig?.hideDefaults || [])

		if (!access.share) hideDefaults.add("share")
		if (!access.download) hideDefaults.add("download")
		if (!access.view || !access.preview) {
			hideDefaults.add("viewMode")
			hideDefaults.add("openUrl")
		}
		if (!fullscreen) hideDefaults.add("fullscreen")
		if (!versionHistory) hideDefaults.add("versionMenu")

		if (hideDefaults.size === 0 && access.export) return actionConfig

		return {
			...actionConfig,
			hideDefaults: Array.from(hideDefaults),
			// Custom renderers may replace these same operation slots.
			customActions: actionConfig?.customActions?.filter(
				(item) =>
					!(item.key === "share" && !access.share) &&
					!(item.key === "download" && !access.download) &&
					!(item.key === "export" && !access.export),
			),
		}
	}, [actionConfig, fullscreen, versionHistory, access])

	const actionContext = useMemo(
		() => ({
			beforeAction,
			type,
			viewMode,
			isMobile,
			showButtonText,
			isShareRoute,
			isFromNode,
			isFullscreen,
			isFullscreenMode,
			isEditMode,
			detailMode,
			showDownload: effectiveShowDownload,
			showRefreshButton,
			isNewestFileVersion,
			allowEdit,
			shareInReadOnly,
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
			beforeAction,
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
			isFullscreenMode,
			isMobile,
			isNewestFileVersion,
			isShareRoute,
			onCopy,
			onDownload,
			onFullscreen,
			onOpenUrl,
			onViewModeChange,
			showButtonText,
			effectiveShowDownload,
			showRefreshButton,
			shareInReadOnly,
			type,
			viewMode,
			getPopupContainer,
		],
	)

	const actions = useMemo(
		() => composeHeaderActions(actionContext, mergedActionConfig),
		[actionContext, mergedActionConfig],
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
				onClick: () => {
					if (index === 0) {
						// 最新版本：直接切换
						handleChangeFileVersion(item.version, true)
					} else if (onCompareVersion) {
						// 历史版本且提供了对比回调：触发对比弹窗
						onCompareVersion(item.version)
					} else {
						// 历史版本但无对比回调：直接切换
						handleChangeFileVersion(item.version, false)
					}
				},
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

		return guardMenuItems(
			[
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
				...(isShareRoute || !versionHistory ? [] : [historyItem]),
				...(extraMoreMenuItems ?? []),
			],
			beforeAction,
		)
	}, [
		fileVersionsList,
		fileVersion,
		handleChangeFileVersion,
		handleLocateFile,
		versionHistory,
		isShareRoute,
		onCompareVersion,
		t,
		extraMoreMenuItems,
		beforeAction,
	])

	const renderBuiltinAction = useCallback(
		(action: BuiltinComposedAction) => {
			const shouldShowActionText = showButtonText
			const runAction = () => {
				if (action.disabled) return
				void runGuardedAction(beforeAction, async () => {
					if (action.onClick) {
						await action.onClick(actionContext)
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
							await handleCopy(fileVersion)
							return
						case "share":
							await handleShare()
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
				})
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
						data-testid={
							testIdsEnabled ? "detail-header-view-mode-switcher" : undefined
						}
						testIdsEnabled={testIdsEnabled}
						viewMode={viewMode}
						onViewModeChange={(mode) => {
							void runGuardedAction(beforeAction, () => onViewModeChange?.(mode))
						}}
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
						onOpenChange={onMoreMenuOpenChange}
						getPopupContainer={
							actionContext.getPopupContainer
								? () => actionContext.getPopupContainer?.() ?? document.body
								: undefined
						}
						overlayStyle={{ zIndex: 1050 }}
					>
						<div data-testid="detail-header-action-more">
							<ActionButton
								data-testid="detail-header-action-more-button"
								id={moreButtonId}
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
						menu={{
							items: downloadImageDropdownItems,
							onClick: guardedDownloadMenuClick,
						}}
						trigger={["click"]}
						placement="bottomRight"
						getPopupContainer={
							actionContext.getPopupContainer
								? () => actionContext.getPopupContainer?.() ?? document.body
								: undefined
						}
						overlayStyle={{ zIndex: 1050 }}
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
			guardedDownloadMenuClick,
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
			onMoreMenuOpenChange,
			moreButtonId,
			onOpenUrl,
			onViewModeChange,
			beforeAction,
			showButtonText,
			t,
			testIdsEnabled,
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
				{/* Neutral wrapper: bar chrome belongs at call sites (e.g. mobile preview sheet), not here — Design floating pill nests this inline. */}
				<div ref={headerContainerRef} className="w-full" data-testid="detail-header">
					{actionsNode}
				</div>
				<FileShareModals
					shareModalVisible={shareModalVisible && access.share}
					onCloseShareModal={() => {
						setShareModalVisible(false)
						setExistingShareInfo(null)
					}}
					showSuccessModal={showSuccessModal && access.share}
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
					showSimilarSharesDialog={showSimilarSharesDialog && access.share}
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
				className={cn(
					"relative flex h-11 w-full shrink-0 items-center justify-end gap-2 bg-background px-2.5 text-sm text-muted-foreground",
					showBottomBorder && "border-b border-border",
				)}
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
					beforeAction={beforeAction}
				/>
			) : null}

			<FileShareModals
				shareModalVisible={shareModalVisible && access.share}
				onCloseShareModal={() => {
					setShareModalVisible(false)
					setExistingShareInfo(null)
				}}
				showSuccessModal={showSuccessModal && access.share}
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
				showSimilarSharesDialog={showSimilarSharesDialog && access.share}
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
