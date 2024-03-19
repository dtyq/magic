import { createStyles, cx } from "antd-style"
import canvasIcon from "@/opensource/components/base/MagicFileIcon/assets/design.svg"
import { DesignData } from "../types"
import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { useLocation } from "react-router"
import ActionButton from "@/opensource/pages/superMagic/components/ActionButton"
import { Ellipsis } from "lucide-react"
import type { FileItem } from "@/opensource/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { DesignNameEditor } from "./DesignNameEditor"
import { SaveStatusIndicator } from "./SaveStatusIndicator"
import { HistoryVersionBanner } from "@/opensource/pages/superMagic/components/Detail/components/CommonHeader/components"
import { VersionMenu } from "./VersionMenu"
import { DesignHeaderActions } from "./DesignHeaderActions"
import { useTranslation } from "react-i18next"
import {
	getDesignDirectoryInfo,
	collectFilesInDirectory,
	packAndDownloadFiles,
	getZipFileNameFromFiles,
} from "../utils/utils"
import ShareModal from "@/opensource/pages/superMagic/components/Share/Modal"
import { ShareMode, ShareType } from "@/opensource/pages/superMagic/components/Share/types"
import { SuperMagicApi } from "@/opensource/apis"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const useStyles = createStyles(({ token }) => ({
	canvasDesignHeaderContainer: {
		flex: "none",
		height: "44px",
		width: "100%",
		padding: "0 10px",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: token.colorBgBase,
	},
	fullscreen: {
		backgroundColor: `${token.colorBgBase} !important`,
	},
	left: {
		flex: "none",
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	right: {
		flex: "none",
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	canvasIcon: {
		width: "20px",
		height: "20px",
	},
	actionButton: {
		width: "24px",
		height: "24px",
	},
}))

interface CanvasDesignHeaderProps {
	designData: DesignData
	name?: string
	onNameChange?: (name: string) => void
	isSaving?: boolean
	attachments?: FileItem[]
	currentFile?: {
		id: string
		name: string
	}
	containerRef?: React.RefObject<HTMLDivElement>
	onReinitialize?: () => Promise<void>
	fileVersionsList?: FileHistoryVersion[]
	fileVersion?: number
	isNewestVersion?: boolean
	onChangeFileVersion?: (version: number, isNewestVersion: boolean) => Promise<void>
	onReturnLatest?: () => void
	onVersionRollback?: (version?: number) => Promise<void>
	isReadOnly?: boolean
	isMobile?: boolean
	allowEdit?: boolean
	/** 文件列表更新 */
	updateAttachments: () => void
	allowDownload?: boolean
}

export default function CanvasDesignHeader(props: CanvasDesignHeaderProps) {
	const {
		designData,
		name,
		onNameChange,
		isSaving = false,
		attachments,
		currentFile,
		containerRef,
		onReinitialize,
		// 版本控制相关（从父组件传入）
		fileVersionsList,
		fileVersion,
		isNewestVersion,
		onChangeFileVersion,
		onReturnLatest,
		onVersionRollback,
		isReadOnly = false,
		isMobile = false,
		allowEdit = true,
		updateAttachments,
		allowDownload = true,
	} = props
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	// 使用传入的 name 参数，如果没有则使用 designData.name
	const displayName = name || designData.name

	const { pathname } = useLocation()
	const isShareRoute = useMemo(() => {
		return pathname.includes("/share/")
	}, [pathname])

	// 刷新状态
	const [isRefreshing, setIsRefreshing] = useState(false)
	// 使用 ref 来避免竞态条件
	const isRefreshingRef = useRef(false)

	// 分享弹窗状态
	const [shareModalVisible, setShareModalVisible] = useState(false)

	// 全屏状态
	const [isFullscreen, setIsFullscreen] = useState(false)

	// 下载状态
	const [isDownloading, setIsDownloading] = useState(false)

	// 获取目录信息
	const directoryInfo = useMemo(() => {
		return getDesignDirectoryInfo(currentFile, attachments)
	}, [currentFile, attachments])

	// 处理名称变更
	const handleNameChange = useCallback(
		async (newName: string) => {
			const currentDirectoryName = directoryInfo.name || designData.name
			if (newName && newName !== currentDirectoryName) {
				// 调用外部传入的 onNameChange
				if (onNameChange) {
					onNameChange(newName)
				}
				// 更新目录名称
				try {
					if (!attachments || !currentFile?.id) {
						return
					}
					// 使用目录 ID 查找目录文件（用于重命名）
					let directoryFile: FileItem | undefined
					if (directoryInfo.id && attachments) {
						// 扁平化附件列表以便查找
						const flattenAttachments = (items: FileItem[]): FileItem[] => {
							const result: FileItem[] = []
							for (const item of items) {
								result.push(item)
								if (item.is_directory && item.children) {
									result.push(...flattenAttachments(item.children))
								}
							}
							return result
						}
						const flatAttachments = flattenAttachments(attachments)
						directoryFile = flatAttachments.find(
							(item) => item.file_id === directoryInfo.id && item.is_directory,
						)
					}
					// 如果找到目录文件，重命名目录
					if (directoryFile?.file_id) {
						await SuperMagicApi.renameFile({
							file_id: directoryFile.file_id,
							target_name: newName,
						})
						// 触发文件列表更新
						updateAttachments()
					}
				} catch (error) {
					magicToast.error(t("design.errors.saveNameFailed"))
				}
			}
		},
		[
			directoryInfo.name,
			directoryInfo.id,
			designData.name,
			onNameChange,
			attachments,
			currentFile?.id,
			updateAttachments,
			t,
		],
	)

	// 分享函数
	const handleShare = useCallback(() => {
		setShareModalVisible(true)
	}, [])

	// 全屏函数
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

	// 注入全屏时的样式，确保 header 背景色正确
	useEffect(() => {
		const styleId = "design-fullscreen-header-style"
		let styleElement = document.getElementById(styleId)

		if (!styleElement) {
			styleElement = document.createElement("style")
			styleElement.id = styleId
			document.head.appendChild(styleElement)
		}

		// 设置全屏时 header 的背景色（使用通用选择器）
		styleElement.textContent = `
			:fullscreen [class*="canvasDesignHeaderContainer"] {
				background-color: var(--ant-color-bg-base, #ffffff) !important;
			}
			:-webkit-full-screen [class*="canvasDesignHeaderContainer"] {
				background-color: var(--ant-color-bg-base, #ffffff) !important;
			}
			:-moz-full-screen [class*="canvasDesignHeaderContainer"] {
				background-color: var(--ant-color-bg-base, #ffffff) !important;
			}
			:-ms-fullscreen [class*="canvasDesignHeaderContainer"] {
				background-color: var(--ant-color-bg-base, #ffffff) !important;
			}
		`

		return () => {
			// 组件卸载时清理样式
			const existingStyle = document.getElementById(styleId)
			if (existingStyle) {
				existingStyle.remove()
			}
		}
	}, [])

	// 下载所有图片并打包
	const handleDownload = useCallback(async () => {
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

		setIsDownloading(true)
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
		} finally {
			setIsDownloading(false)
		}
	}, [attachments, currentFile, t])

	// 刷新函数：重新初始化页面（调用父组件的重新初始化逻辑）
	const handleRefresh = useCallback(async () => {
		if (!currentFile?.id || !currentFile?.name || !attachments) {
			magicToast.warning(t("design.errors.cannotRefreshMissingInfo"))
			return
		}

		// 使用 ref 进行原子性检查，避免竞态条件
		if (isRefreshingRef.current) {
			return
		}

		const key = `refresh-${currentFile.id}`
		magicToast.loading({
			content: t("common.refreshing"),
			key,
		})

		try {
			// 同时更新 state 和 ref
			isRefreshingRef.current = true
			setIsRefreshing(true)

			// 调用父组件的重新初始化函数
			if (onReinitialize) {
				await onReinitialize()
				magicToast.success({
					content: t("common.refreshSuccess"),
					key,
				})
			} else {
				throw new Error("没有传入 onReinitialize")
			}
		} catch (error) {
			magicToast.error({
				content: t("design.errors.refreshFailed"),
				key,
			})
		} finally {
			// 同时更新 state 和 ref
			isRefreshingRef.current = false
			setIsRefreshing(false)
		}
	}, [currentFile?.id, currentFile?.name, attachments, t, onReinitialize])

	// 版本切换处理（使用父组件传入的方法）
	const handleChangeFileVersion = useCallback(
		async (version: number, isNewest: boolean) => {
			if (onChangeFileVersion) {
				await onChangeFileVersion(version, isNewest)
			}
		},
		[onChangeFileVersion],
	)

	const handleReturnLatest = useCallback(() => {
		if (onReturnLatest) {
			onReturnLatest()
		}
	}, [onReturnLatest])

	const handleVersionRollback = useCallback(
		async (version?: number) => {
			if (onVersionRollback) {
				await onVersionRollback(version)
			}
		},
		[onVersionRollback],
	)

	return (
		<>
			<div
				className={cx(
					styles.canvasDesignHeaderContainer,
					isFullscreen && styles.fullscreen,
				)}
			>
				<div className={styles.left}>
					{!isMobile && (
						<>
							<img className={styles.canvasIcon} src={canvasIcon} alt="canvas icon" />
							<DesignNameEditor
								name={displayName}
								onNameChange={handleNameChange}
								isReadOnly={isReadOnly}
							/>
						</>
					)}
					<SaveStatusIndicator isSaving={isSaving} />
				</div>
				<div className={styles.right}>
					<DesignHeaderActions
						allowDownload={allowDownload}
						isRefreshing={isRefreshing}
						isDownloading={isDownloading}
						isShareRoute={isShareRoute}
						isFullscreen={isFullscreen}
						onRefresh={handleRefresh}
						onDownload={handleDownload}
						onShare={handleShare}
						onFullscreen={handleFullscreen}
						versionMenuTrigger={
							fileVersionsList && (
								<VersionMenu
									isShareRoute={isShareRoute}
									fileVersionsList={fileVersionsList}
									fileVersion={fileVersion}
									onChangeVersion={handleChangeFileVersion}
								>
									<ActionButton className={styles.actionButton}>
										<Ellipsis size={16} />
									</ActionButton>
								</VersionMenu>
							)
						}
					/>
				</div>
			</div>
			{!isNewestVersion && fileVersionsList && (
				<HistoryVersionBanner
					fileVersionsList={fileVersionsList}
					fileVersion={fileVersion}
					onReturnLatest={handleReturnLatest}
					onRollback={handleVersionRollback}
					allowEdit={allowEdit}
				/>
			)}
			{/* 分享弹窗 */}
			<ShareModal
				open={shareModalVisible}
				onCancel={() => setShareModalVisible(false)}
				shareMode={ShareMode.File}
				types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
				attachments={attachments}
				defaultSelectedFileIds={currentFile?.id ? [currentFile.id] : undefined}
				defaultOpenFileId={currentFile?.id}
			/>
		</>
	)
}
