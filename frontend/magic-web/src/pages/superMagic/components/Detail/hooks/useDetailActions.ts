import { useState, useEffect, useMemo, useCallback } from "react"
import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/pages/superMagic/utils/api"
import { downloadFileWithAnchor, getFileType } from "@/pages/superMagic/utils/handleFIle"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { FilesViewerRef } from "../components/FilesViewer"
import { useLocation } from "react-router"
import useShareRoute from "../../../hooks/useShareRoute"
import { DetailType } from "../types"
import { DownloadImageMode } from "../../../pages/Workspace/types"
// 定义图片文件扩展名的数组
export const IMAGE_EXTENSIONS = [
	"jpg",
	"jpeg",
	"png",
	"gif",
	"bmp",
	"svg",
	"webp",
	"ico",
	"tiff",
	"tif",
	"sh",
	// "xlsx",
]

export function useDetailActions({
	disPlayDetail,
	setUserSelectDetail,
	attachments,
	mode,
	filesViewerRef,
}: {
	disPlayDetail: any
	setUserSelectDetail?: (detail: any) => void
	attachments?: any[]
	mode?: "single" | "files"
	filesViewerRef?: React.RefObject<FilesViewerRef>
}) {
	const [isFullscreen, setIsFullscreen] = useState(false)
	// 判断是否来自Node点击
	const isFromNode = disPlayDetail?.isFromNode || false
	const [currentIndex, setCurrentIndex] = useState<number>(-1)
	// 添加文件视图模式状态管理
	const [fileViewModes, setFileViewModes] = useState<Map<string, "code" | "desktop" | "phone">>(
		new Map(),
	)
	const [isFileShare, setIsFileShare] = useState(false)
	const { pathname } = useLocation()
	const { isShareRoute } = useShareRoute()

	const [attachmentsVersionMap, setAttachmentsVersionMap] = useState<Map<string, number>>(
		new Map(),
	)

	// 判断是否使用消息的附件列表（而不是话题的整体附件列表）
	const shouldUseMessageAttachments = useMemo(() => {
		return !!disPlayDetail?.attachments && Array.isArray(disPlayDetail.attachments)
	}, [disPlayDetail?.attachments])

	// 确定要使用的附件列表
	const effectiveAttachments = useMemo(() => {
		return shouldUseMessageAttachments ? disPlayDetail.attachments : attachments
	}, [attachments, disPlayDetail?.attachments, shouldUseMessageAttachments])

	// 收集所有文件（非目录）并扁平化，同时过滤掉图片文件
	const collectFiles = (items: any[]): any[] => {
		let files: any[] = []
		if (!items || !Array.isArray(items)) return files

		items.forEach((item) => {
			if (item.is_directory && Array.isArray(item.children)) {
				files = [...files, ...collectFiles(item.children)]
			} else if (!item.is_directory) {
				// 获取文件扩展名并转为小写
				const extension = (item.file_extension || "").toLowerCase()

				// 如果不是图片文件，则添加到结果中
				if (!IMAGE_EXTENSIONS.includes(extension)) {
					files.push(item)
				}
			}
		})
		return files
	}

	// 所有文件的扁平化列表
	const allFiles = useMemo(() => collectFiles(effectiveAttachments || []), [effectiveAttachments])

	// 当附件列表和currentFileId存在时，找到当前文件在附件列表中的索引
	useEffect(() => {
		if (allFiles.length > 0 && disPlayDetail?.currentFileId) {
			const fileIndex = allFiles.findIndex(
				(file) => file.file_id === disPlayDetail?.currentFileId,
			)
			if (fileIndex !== -1) {
				setCurrentIndex(fileIndex)
			}
		}
	}, [allFiles, disPlayDetail, setCurrentIndex])

	// 处理视图模式变更
	const handleViewModeChange = (fileId: string, mode: "code" | "desktop" | "phone") => {
		setFileViewModes((prev) => {
			const newMap = new Map(prev)
			newMap.set(fileId, mode)
			return newMap
		})
	}

	useEffect(() => {
		const isReadFileAction =
			disPlayDetail?.name === "read_file" || disPlayDetail?.name === "read_files"
		if (isReadFileAction && disPlayDetail?.id) {
			handleViewModeChange(disPlayDetail.id, "code")
		}
	}, [disPlayDetail])

	// 获取指定文件的视图模式（默认为"desktop"）
	const getFileViewMode = (fileId: string): "code" | "desktop" | "phone" => {
		const mode = fileViewModes.get(fileId) || "desktop"
		// 向后兼容：将旧的 "preview" 映射为 "desktop"
		return mode === ("preview" as any) ? "desktop" : mode
	}

	// 处理打开文件
	const handleOpenFile = (item: any) => {
		if (!item || !item.file_id) return
		const fileVersion = attachmentsVersionMap.get(item.file_id)
		getTemporaryDownloadUrl({
			file_ids: [item.file_id],
			file_versions: fileVersion ? { [item.file_id]: fileVersion } : undefined,
		}).then((res: any) => {
			downloadFileContent(res[0]?.url).then((data: any) => {
				const fileName = item.display_filename || item.file_name || item.filename
				const type = getFileType(item.file_extension)
				if (type) {
					setUserSelectDetail?.({
						type,
						data: {
							content: data,
							file_name: fileName,
							file_url: res[0]?.url,
							file_extension: item.file_extension,
							file_id: item.file_id,
							file_size: item.file_size,
							metadata: item?.metadata,
						},
						currentFileId: item.file_id,
						// 保持与当前上下文相同的附件列表
						attachments:
							disPlayDetail?.attachments && Array.isArray(disPlayDetail.attachments)
								? disPlayDetail.attachments
								: attachments,
					})
				} else {
					setUserSelectDetail?.({
						type: DetailType.NotSupport,
						data: {
							text: "暂不支持预览该文件,请下载该文件",
						},
					})
				}
			})
		})
	}

	// 处理切换到上一个文件
	const handlePrevious = () => {
		if (allFiles.length > 0 && currentIndex > 0) {
			pubsub.publish(PubSubEvents.Change_Preview_File)
			handleOpenFile(allFiles[currentIndex - 1])
		}
	}

	// 处理切换到下一个文件
	const handleNext = () => {
		if (allFiles.length > 0 && currentIndex < allFiles.length - 1) {
			pubsub.publish(PubSubEvents.Change_Preview_File)
			handleOpenFile(allFiles[currentIndex + 1])
		}
	}

	// 处理全屏显示
	const handleFullscreen = () => {
		setIsFullscreen(!isFullscreen)
	}

	// 处理下载文件
	const handleDownload = (fileId?: string, fileVersion?: number, mode?: DownloadImageMode) => {
		if (fileId) {
			getTemporaryDownloadUrl({
				file_ids: [fileId],
				file_versions: fileVersion ? { [fileId]: fileVersion } : undefined,
				download_mode: mode,
				is_download: true,
			}).then((res: any) => {
				downloadFileWithAnchor(res[0]?.url)
			})
		} else {
			if (disPlayDetail?.data?.file_name && disPlayDetail?.currentFileId) {
				getTemporaryDownloadUrl({
					file_ids: [disPlayDetail?.currentFileId],
					download_mode: mode,
					is_download: true,
				}).then((res: any) => {
					downloadFileWithAnchor(res[0]?.url)
				})
			}
		}
	}

	useEffect(() => {
		const handleMaximizeFile = () => {
			setIsFullscreen(true)
		}
		const handleExitFullscreen = () => {
			setIsFullscreen(false)
		}
		pubsub.subscribe("super_magic_maximize_file", handleMaximizeFile)
		pubsub.subscribe("exit_fullscreen", handleExitFullscreen)
		pubsub.subscribe(PubSubEvents.Change_Preview_File_Version, (file_id, file_version) => {
			const targetFile = allFiles.find((file) => file.file_id === file_id)
			handleOpenFile(targetFile)
			setAttachmentsVersionMap((prev) => {
				const newMap = new Map(prev)
				newMap.set(file_id, file_version)
				return newMap
			})
		})
		return () => {
			pubsub.unsubscribe("super_magic_maximize_file", handleMaximizeFile)
			pubsub.unsubscribe("exit_fullscreen", handleExitFullscreen)
			pubsub.unsubscribe(PubSubEvents.Change_Preview_File_Version)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		// Parse URL path to extract share ID and file ID if present
		// Support both /share/{topicId} and /share/{topicId}/file/{fileId}
		const topicMatch = pathname.match(/\/share\/([^/]+)/)
		const fileMatch = pathname.match(/\/share\/([^/]+)\/file\/([^/]+)/)
		if (fileMatch && fileMatch[1] && fileMatch[2]) {
			setIsFileShare(true)
		} else if (topicMatch && topicMatch[1]) {
			setIsFileShare(false)
		}
	}, [pathname])

	// 处理键盘事件，按Esc键退出全屏
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "Escape" &&
				!isFullscreen &&
				!filesViewerRef?.current?.isFullscreen &&
				!isFileShare
			) {
				if (mode === "files" && isShareRoute) {
					pubsub.publish("super_magic_switch_detail_mode", "single")
					// 回到最新
					setUserSelectDetail?.(null)
				} else {
					// 如果全屏退出全屏
					pubsub.publish("super_magic_switch_detail_mode", "files")
				}
			}
			if (event.key === "Escape" && isFullscreen) {
				setIsFullscreen(false)
			}
		}

		document.addEventListener("keydown", handleKeyDown)

		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [filesViewerRef, isFileShare, isFullscreen, isShareRoute, mode, setUserSelectDetail])

	return {
		isFullscreen,
		isFromNode,
		handlePrevious,
		handleNext,
		handleFullscreen,
		handleDownload,
		handleOpenFile,
		allFiles,
		currentIndex,
		effectiveAttachments,
		// 新增 viewMode 相关的返回值
		handleViewModeChange,
		getFileViewMode,
		setIsFullscreen,
	}
}
