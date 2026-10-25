import { packAndDownloadFiles } from "@/pages/superMagic/services/fileBundleDownload"
import { useCallback, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { BadgeCent, RefreshCw, Fullscreen } from "lucide-react"
import type {
	CommonHeaderV2Props,
	ActionContext,
} from "@/pages/superMagic/components/Detail/components/CommonHeaderV2/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	type FileHistoryVersion,
	DownloadImageMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { DetailType } from "@/pages/superMagic/components/Detail/types"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	getDesignDirectoryInfo,
	collectFilesInDirectory,
	getZipFileNameFromFiles,
} from "../../utils/utils"
import magicToast from "@/components/base/MagicToaster/utils"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import ActionButton from "@/pages/superMagic/components/Detail/components/CommonHeader/components/ActionButton"
import { IconShare3 } from "@tabler/icons-react"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useAiWatermarkPreference } from "@/hooks/useAiWatermarkPreference"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	getShouldSkipVideoPointsConfirm,
	setShouldSkipVideoPointsConfirm,
} from "@/components/CanvasDesign/ui/element-tools/editors/video/points/video-points-confirm.storage"

interface UseDesignHeaderPropsOptions {
	/** 定位到文件时使用的文件 ID，Design 场景下传 magic.project.js 的 fileId */
	locateFileId?: string
	currentFile?: {
		id: string
		name: string
		type?: string
		url?: string
		projectId?: string
		projectName?: string
	}
	projectId?: string
	selectedProject?: ProjectListItem | null
	attachments?: FileItem[]
	fileVersion?: number
	isNewestVersion?: boolean
	fileVersionsList?: FileHistoryVersion[]
	allowEdit?: boolean
	allowDownload?: boolean
	isFullscreen?: boolean
	onFullscreen?: () => void
	handleReinitialize: () => Promise<void>
	handleChangeFileVersion: (version: number, isNewestVersion: boolean) => Promise<void>
	handleReturnLatest: () => Promise<void>
	handleVersionRollback: (version?: number) => Promise<void>
}

export function useDesignHeaderProps(options: UseDesignHeaderPropsOptions): CommonHeaderV2Props {
	const {
		locateFileId,
		currentFile,
		projectId,
		selectedProject,
		attachments,
		fileVersion,
		isNewestVersion,
		fileVersionsList,
		allowEdit,
		allowDownload,
		isFullscreen = false,
		onFullscreen,
		handleReinitialize,
		handleChangeFileVersion,
		handleReturnLatest,
		handleVersionRollback,
	} = options

	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()
	const { hasGlobalAgreement } = useAiWatermarkPreference()
	// Canvas header ZIP download must carry the ambient share identity too.
	const fileApi = useFileApi()

	// 刷新状态
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isVideoPointsPromptEnabled, setIsVideoPointsPromptEnabled] = useState(
		() => !getShouldSkipVideoPointsConfirm(),
	)

	const designDownloadDirectoryInfo = useMemo(() => {
		if (!currentFile?.id || !attachments?.length) {
			return null
		}

		return getDesignDirectoryInfo(currentFile, attachments)
	}, [attachments, currentFile])

	const canShowDesignDownload = useMemo(() => {
		if (allowDownload === false) {
			return false
		}

		const isAllowedByAttachmentActions = allowEdit === true || allowDownload === true
		if (!isAllowedByAttachmentActions) {
			return false
		}

		return Boolean(designDownloadDirectoryInfo?.path && designDownloadDirectoryInfo.id)
	}, [allowDownload, allowEdit, designDownloadDirectoryInfo])

	const handleFullscreen = useCallback(() => {
		onFullscreen?.()
	}, [onFullscreen])

	const handleMoreMenuOpenChange = useCallback((open: boolean) => {
		if (open) {
			setIsVideoPointsPromptEnabled(!getShouldSkipVideoPointsConfirm())
		}
	}, [])

	// Design 特定的下载逻辑：打包目录下所有图片
	const handleDesignDownload = useCallback(async () => {
		if (!canShowDesignDownload) {
			return
		}

		if (!attachments || attachments.length === 0) {
			magicToast.warning(t("design.errors.noFileList"))
			return
		}

		// 获取 design 文件的目录路径和目录名称
		const directoryInfo = designDownloadDirectoryInfo
		if (!directoryInfo?.path || !directoryInfo.id) {
			magicToast.warning(t("design.errors.cannotDetermineDirectory"))
			return
		}

		// 收集目录下的所有图片文件（传入目录 ID 以便使用 parent_id 关系查找）
		const imageFiles = collectFilesInDirectory(
			attachments,
			directoryInfo.path,
			directoryInfo.id || undefined,
		)
		if (imageFiles.length === 0) {
			magicToast.warning(t("design.errors.noImageFiles"))
			return
		}

		const loadingKey = `download-${Date.now()}`
		magicToast.loading({
			content: t("design.messages.packingDownloading", { count: imageFiles.length }),
			key: loadingKey,
			duration: 0,
		})

		try {
			// 使用共用函数获取 zip 文件名（与 useConversationAndDownload 保持一致）
			const zipFileName = getZipFileNameFromFiles(imageFiles, attachments, currentFile)
			const downloadMode = hasGlobalAgreement ? DownloadImageMode.HighQuality : undefined
			const { successCount } = await packAndDownloadFiles(
				imageFiles,
				downloadMode,
				zipFileName,
				undefined,
				fileApi,
			)

			magicToast.success({
				content: t("design.messages.downloadSuccess", { count: successCount }),
				key: loadingKey,
			})
		} catch (error) {
			magicToast.error({
				content: t("design.errors.packDownloadFailed"),
				key: loadingKey,
			})
		}
	}, [
		attachments,
		canShowDesignDownload,
		currentFile,
		designDownloadDirectoryInfo,
		fileApi,
		hasGlobalAgreement,
		t,
	])

	// 适配 CommonHeaderV2 的 changeFileVersion 接口
	const handleChangeFileVersionForHeader = useCallback(
		(version: number | undefined) => {
			if (version === undefined) {
				// 返回最新版本
				const latestVersion = fileVersionsList?.[0]?.version
				if (latestVersion !== undefined) {
					void handleChangeFileVersion(latestVersion, true)
				} else {
					void handleReturnLatest()
				}
			} else {
				// 切换到指定版本
				const isNewest = fileVersionsList?.[0]?.version === version
				void handleChangeFileVersion(version, isNewest)
			}
		},
		[fileVersionsList, handleChangeFileVersion, handleReturnLatest],
	)

	// 转换 currentFile 类型以匹配 CommonHeaderV2 的要求
	const currentFileForHeader = currentFile
		? {
				id: currentFile.id,
				name: currentFile.name,
				type: currentFile.type || "design",
				url: currentFile.url,
				projectId: currentFile.projectId || selectedProject?.id || projectId,
				projectName: currentFile.projectName || selectedProject?.project_name,
			}
		: undefined

	// 转换 attachments 类型（FileItem -> AttachmentItem）
	const attachmentsForHeader = useMemo<AttachmentItem[] | undefined>(() => {
		if (!attachments) return undefined
		return attachments.map((item) => ({
			file_id: item.file_id,
			file_name: item.file_name,
			filename: item.filename || item.file_name,
			file_extension: item.file_extension,
			is_directory: item.is_directory,
			name: item.file_name,
			path: item.relative_file_path,
			parent_id: item.parent_id ? String(item.parent_id) : null,
			project_id: item.project_id,
			children: item.children
				? item.children.map((child) => ({
						file_id: child.file_id,
						file_name: child.file_name,
						filename: child.filename || child.file_name,
						file_extension: child.file_extension,
						is_directory: child.is_directory,
						name: child.file_name,
						path: child.relative_file_path,
						parent_id: child.parent_id ? String(child.parent_id) : null,
						project_id: child.project_id,
						source: child.source || AttachmentSource.DEFAULT,
					}))
				: undefined,
			display_filename: item.display_filename || item.file_name,
			source: item.source || AttachmentSource.DEFAULT,
		}))
	}, [attachments])

	// 统一的图标颜色样式
	const iconStyle = useMemo(
		() => ({
			color: "var(--base-foreground, #0A0A0A)",
		}),
		[],
	)

	const getPopupContainer = useCallback(() => {
		if (typeof document === "undefined") return null
		return document.body
	}, [])

	// 自定义按钮渲染函数（只保留需要特殊处理的）
	const renderCustomRefresh = useCallback(
		(context: ActionContext) => {
			const handleRefresh = async () => {
				if (isRefreshing) return

				try {
					setIsRefreshing(true)
					await handleReinitialize()
				} catch (error) {
					// 静默处理错误
				} finally {
					setIsRefreshing(false)
				}
			}

			return (
				<ActionButton
					data-testid="detail-header-action-refresh"
					icon={<RefreshCw size={16} style={iconStyle} />}
					title={t("fileViewer.refresh")}
					showText={false}
					onClick={handleRefresh}
					disabled={isRefreshing}
					style={{
						cursor: isRefreshing ? "not-allowed" : "pointer",
						opacity: isRefreshing ? 0.5 : 1,
					}}
					getPopupContainer={context.getPopupContainer}
				/>
			)
		},
		[handleReinitialize, iconStyle, isRefreshing, t],
	)

	const renderCustomShare = useCallback(
		(context: ActionContext) => {
			return (
				<ActionButton
					data-testid="detail-header-action-share"
					icon={<IconShare3 size={16} style={iconStyle} />}
					title={t("fileViewer.share")}
					showText={false}
					onClick={() => {
						context.onShare?.()
					}}
					getPopupContainer={context.getPopupContainer}
				/>
			)
		},
		[iconStyle, t],
	)

	const renderCustomFullscreen = useCallback(
		(context: ActionContext) => {
			return (
				<ActionButton
					data-testid="detail-header-action-fullscreen"
					icon={
						context.isFullscreen ? (
							<Fullscreen size={16} style={iconStyle} />
						) : (
							<Fullscreen size={16} style={iconStyle} />
						)
					}
					title={
						context.isFullscreen
							? t("fileViewer.exitFullscreen")
							: t("fileViewer.fullscreen")
					}
					showText={false}
					onClick={() => {
						context.onFullscreen?.()
					}}
					getPopupContainer={context.getPopupContainer}
				/>
			)
		},
		[iconStyle, t],
	)

	const onLocateFile = useCallback(() => {
		if (locateFileId) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, locateFileId)
		}
	}, [locateFileId])

	const handleToggleVideoPointsPrompt = useCallback(() => {
		const nextEnabled = !isVideoPointsPromptEnabled
		setIsVideoPointsPromptEnabled(nextEnabled)
		setShouldSkipVideoPointsConfirm(!nextEnabled)
	}, [isVideoPointsPromptEnabled])

	const extraMoreMenuItems = useMemo<CommonHeaderV2Props["extraMoreMenuItems"]>(() => {
		if (isShareRoute) return []

		const videoPointsPromptItem = {
			key: "video-points-prompt-toggle",
			keepOpenOnClick: true,
			label: (
				<div className="flex min-w-[160px] items-center justify-between gap-4 text-sm">
					<span className="flex min-w-0 items-center gap-1.5">
						<BadgeCent size={16} />
						<span>{t("design.actions.videoPointsPrompt")}</span>
					</span>
					<Checkbox
						checked={isVideoPointsPromptEnabled}
						aria-hidden
						className="pointer-events-none"
					/>
				</div>
			),
			onClick: handleToggleVideoPointsPrompt,
		} as NonNullable<CommonHeaderV2Props["extraMoreMenuItems"]>[number] & {
			keepOpenOnClick: true
		}

		return [videoPointsPromptItem]
	}, [handleToggleVideoPointsPrompt, isShareRoute, isVideoPointsPromptEnabled, t])

	return {
		type: DetailType.Design,
		currentFile: currentFileForHeader,
		attachments: attachmentsForHeader,
		fileVersion,
		isNewestFileVersion: isNewestVersion,
		fileVersionsList,
		changeFileVersion: handleChangeFileVersionForHeader,
		handleVersionRollback,
		onLocateFile: locateFileId ? onLocateFile : undefined,
		allowEdit,
		extraMoreMenuItems,
		onMoreMenuOpenChange: handleMoreMenuOpenChange,
		showDownload: canShowDesignDownload,
		showRefreshButton: true,
		isFullscreen,
		detailMode: "files", // 设置为 "files" 以显示刷新和更多按钮
		onDownload: handleDesignDownload,
		onFullscreen: handleFullscreen,
		getPopupContainer,
		actionConfig: {
			order: isShareRoute
				? ["refresh", "download", "fullscreen", "more"]
				: ["refresh", "share", "download", "fullscreen", "more"], // 按钮顺序：刷新、分享、下载、全屏、更多
			hideDefaults: ["copy", "openUrl", "refresh", "share", "fullscreen"], // 隐藏默认按钮，使用自定义按钮（download、more 使用默认但统一颜色）
			gap: "var(--spacing-1, 4px)", // 按钮之间的间距
			overrides: {
				download: {
					iconStyle,
					showText: false, // 只显示图标，不显示文字
				},
				more: {
					iconStyle,
					showText: false, // 只显示图标，不显示文字
				},
			},
			customActions: [
				{
					key: "refresh",
					zone: "secondary",
					render: renderCustomRefresh,
				},
				...(!isShareRoute
					? [
							{
								key: "share" as const,
								zone: "secondary" as const,
								render: renderCustomShare,
							},
						]
					: []),
				{
					key: "fullscreen",
					zone: "trailing",
					before: "more", // 确保全屏按钮在 more 按钮之前
					render: renderCustomFullscreen,
				},
			],
		},
	}
}
