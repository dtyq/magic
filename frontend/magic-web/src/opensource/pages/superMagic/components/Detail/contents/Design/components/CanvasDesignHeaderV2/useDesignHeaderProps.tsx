import React, { useCallback, useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Fullscreen } from "lucide-react"
import type {
	CommonHeaderV2Props,
	ActionContext,
} from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2/types"
import type { FileItem } from "@/opensource/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import { DetailType } from "@/opensource/pages/superMagic/components/Detail/types"
import { AttachmentSource } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	getDesignDirectoryInfo,
	collectFilesInDirectory,
	packAndDownloadFiles,
	getZipFileNameFromFiles,
} from "../../utils/utils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import ActionButton from "@/opensource/pages/superMagic/components/Detail/components/CommonHeader/components/ActionButton"
import { IconShare3 } from "@tabler/icons-react"

interface UseDesignHeaderPropsOptions {
	currentFile?: {
		id: string
		name: string
		type?: string
		url?: string
	}
	attachments?: FileItem[]
	fileVersion?: number
	isNewestVersion?: boolean
	fileVersionsList?: FileHistoryVersion[]
	allowEdit?: boolean
	allowDownload?: boolean
	containerRef: React.RefObject<HTMLDivElement>
	handleReinitialize: () => Promise<void>
	handleChangeFileVersion: (version: number, isNewestVersion: boolean) => Promise<void>
	handleReturnLatest: () => void
	handleVersionRollback: (version?: number) => Promise<void>
}

export function useDesignHeaderProps(options: UseDesignHeaderPropsOptions): CommonHeaderV2Props {
	const {
		currentFile,
		attachments,
		fileVersion,
		isNewestVersion,
		fileVersionsList,
		allowEdit,
		allowDownload,
		containerRef,
		handleReinitialize,
		handleChangeFileVersion,
		handleReturnLatest,
		handleVersionRollback,
	} = options

	const { t } = useTranslation("super")

	// 全屏状态
	const [isFullscreen, setIsFullscreen] = useState(false)

	// 刷新状态
	const [isRefreshing, setIsRefreshing] = useState(false)

	// 全屏处理函数
	const handleFullscreen = useCallback(async () => {
		if (!containerRef?.current) return

		try {
			if (!document.fullscreenElement) {
				// 进入全屏
				await containerRef.current.requestFullscreen()
				setIsFullscreen(true)
			} else {
				// 退出全屏
				await document.exitFullscreen()
				setIsFullscreen(false)
			}
		} catch (error) {
			//
		}
	}, [containerRef])

	// 监听全屏状态变化
	useEffect(() => {
		function handleFullscreenChange() {
			const isContainerFullscreen = document.fullscreenElement === containerRef?.current
			setIsFullscreen(isContainerFullscreen)
		}

		document.addEventListener("fullscreenchange", handleFullscreenChange)
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange)
		}
	}, [containerRef])

	// Design 特定的下载逻辑：打包目录下所有图片
	const handleDesignDownload = useCallback(async () => {
		if (!attachments || attachments.length === 0) {
			magicToast.warning(t("design.errors.noFileList"))
			return
		}

		// 获取 design 文件的目录路径和目录名称
		const directoryInfo = getDesignDirectoryInfo(currentFile, attachments)
		if (!directoryInfo.path) {
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
			const { successCount } = await packAndDownloadFiles(imageFiles, undefined, zipFileName)

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
	}, [attachments, currentFile, t])

	// 适配 CommonHeaderV2 的 changeFileVersion 接口
	const handleChangeFileVersionForHeader = useCallback(
		(version: number | undefined) => {
			if (version === undefined) {
				// 返回最新版本
				const latestVersion = fileVersionsList?.[0]?.version
				if (latestVersion !== undefined) {
					void handleChangeFileVersion(latestVersion, true)
				} else {
					handleReturnLatest()
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

	// 普通模式下挂到 body，避免被消息列表等相邻区域的层叠上下文遮挡；
	// 仅在全屏时挂到全屏容器内，确保弹层仍显示在全屏内容之上。
	const getPopupContainer = useCallback(() => {
		if (typeof document === "undefined") return null

		const container = containerRef?.current
		if (document.fullscreenElement === container && container) return container

		return document.body
	}, [containerRef])

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

	return {
		type: DetailType.Design,
		currentFile: currentFileForHeader,
		attachments: attachmentsForHeader,
		fileVersion,
		isNewestFileVersion: isNewestVersion,
		fileVersionsList,
		changeFileVersion: handleChangeFileVersionForHeader,
		handleVersionRollback,
		allowEdit,
		showDownload: allowDownload,
		showRefreshButton: true,
		isFullscreen,
		detailMode: "files", // 设置为 "files" 以显示刷新和更多按钮
		onDownload: handleDesignDownload,
		onFullscreen: handleFullscreen,
		getPopupContainer,
		actionConfig: {
			order: ["refresh", "share", "download", "fullscreen", "more"], // 按钮顺序：刷新、分享、下载、全屏、更多
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
				{
					key: "share",
					zone: "secondary",
					render: renderCustomShare,
				},
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
