import { memo, useCallback, useEffect, useState } from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { Flex } from "antd"
import PPTRender from "../PPTRender"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useFileData } from "@/opensource/pages/superMagic/hooks/useFileData"
import { processHtmlContent } from "../../contents/HTML/htmlProcessor"
import { type FileItem } from "../../contents/HTML/utils/fetchInterceptor"
import { createParentMessageHandler } from "../../contents/HTML/utils/fetchInterceptor"
import type { PPTRootRenderProps } from "./types"
import { flattenAttachments } from "../../contents/HTML/utils"
import { cn } from "@/opensource/lib/utils"

/**
 * PPTRootRender Component
 * Handles PPT (slide) rendering by extracting slide paths from HTML content
 * and rendering them using the PPTRender component
 */
export default memo(function PPTRootRender(props: PPTRootRenderProps) {
	const {
		data: displayData,
		attachments,
		type,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		setUserSelectDetail,
		isFromNode,
		onClose,
		hasUserSelectDetail,
		isFullscreen,
		attachmentList,
		allowEdit,
		saveEditContent,
		className,
		metadata,
		openFileTab,
		selectedProject,
		activeFileId,
		isPlaybackMode,
		exportFile,
		exportPdf,
		exportPpt,
	} = props

	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [originalSlidesPaths, setOriginalSlidesPaths] = useState<string[]>([])
	const [renderKey] = useState(0)
	const [entryFileData, setEntryFileData] = useState<any>({})
	const [currentAttachmentList, setCurrentAttachmentList] = useState<any>([])
	// 标记是否至少完成过一次内容解析，避免路径计算中误展示空态
	const [hasProcessedContent, setHasProcessedContent] = useState(false)

	const { fileData: htmlFileData, loading } = useFileData({
		file_id: displayData?.file_id || "",
		isEditing: false,
		activeFileId,
		isFromNode,
		content: displayData?.content || "",
		disabledUrlCache: isPlaybackMode,
	})

	/** Update HTML file data content */
	const updateDataContent = useMemoizedFn((fileData: any) => {
		const newEntryFileData = {
			...displayData,
			content: fileData || displayData?.content,
		}
		if (entryFileData.content !== newEntryFileData.content) {
			setEntryFileData(newEntryFileData)
		}
	})

	useDeepCompareEffect(() => {
		updateDataContent(htmlFileData)
	}, [htmlFileData])

	// Create message handler and register/remove listener
	useEffect(() => {
		let htmlRelativeFolderPath = "/"
		const currentFileId = displayData?.file_id
		if (currentFileId && attachmentList && attachmentList.length > 0) {
			const currentFile = attachmentList.find((item) => item.file_id === currentFileId)
			if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
				htmlRelativeFolderPath = currentFile.relative_file_path.replace(
					currentFile.file_name,
					"",
				)
			}
		}
		const allFiles = attachmentList ? (flattenAttachments(attachmentList) as FileItem[]) : []
		const messageHandler = createParentMessageHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
		)
		window.addEventListener("message", messageHandler)
		return () => {
			window.removeEventListener("message", messageHandler)
		}
	}, [attachmentList, displayData?.file_id])

	const processContent = useMemoizedFn(async () => {
		try {
			const content = entryFileData?.content
			const result = await processHtmlContent({
				content,
				attachments,
				fileId: displayData?.file_id,
				fileName: entryFileData?.file_name,
				attachmentList,
				metadata: metadata,
			})

			console.log("PPTRootRender processContent result", result)

			setFilePathMapping(result.filePathMapping)
			setOriginalSlidesPaths(result.originalSlidesPaths)
		} catch (error) {
			console.error("Error processing HTML content for PPT:", error)
			setOriginalSlidesPaths([])
		} finally {
			setHasProcessedContent(true)
		}
	})

	useDeepCompareEffect(() => {
		// attachmentList 先到时不立即解析，等待 entryFileData.content 就绪
		if (
			entryFileData?.content &&
			currentAttachmentList.length === 0 &&
			attachmentList &&
			attachmentList.length > 0
		) {
			setCurrentAttachmentList(attachmentList)
			processContent()
		}
	}, [attachmentList, currentAttachmentList, entryFileData?.content])

	useDeepCompareEffect(() => {
		if (!entryFileData?.content) return
		// 首次由 attachmentList 分支接管，避免首轮重复解析
		if (currentAttachmentList.length === 0 && attachmentList?.length) return
		processContent()
	}, [entryFileData, metadata, currentAttachmentList.length, attachmentList?.length])

	// Handle sort panel save
	const handleSortSave = useCallback((newSlidesPaths: string[]) => {
		setOriginalSlidesPaths(newSlidesPaths)
	}, [])

	const handleDownload = useMemoizedFn(
		({
			fileId,
			fileVersion,
			type,
		}: {
			fileId: string
			fileVersion?: number
			type?: "file" | "pdf" | "ppt"
		}) => {
			if (type === "file") {
				exportFile?.(fileId, fileVersion)
			} else if (type === "pdf") {
				exportPdf?.(fileId)
			} else if (type === "ppt") {
				exportPpt?.(fileId)
			}
		},
	)

	const openNewTab = useCallback(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		(fileId: string, _path: string) => {
			if (!fileId) {
				console.warn("openNewTab: fileId is empty, cannot open new tab")
				return
			}

			const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)
			if (!fileItem) {
				console.warn("openNewTab: fileItem not found", { fileId })
				return
			}

			openFileTab?.(fileItem)
		},
		[attachmentList, openFileTab],
	)

	// 仅在“文件加载完成 + 内容解析完成（或确实无内容可解析）”后渲染 PPTRender
	const isReadyToRender =
		!loading && (hasProcessedContent || (!attachmentList?.length && !entryFileData?.content))

	return (
		<div className={cn("h-full w-full", className)}>
			{!isReadyToRender ? (
				<Flex justify="center" align="center" className="h-full w-full bg-background">
					<MagicSpin spinning />
				</Flex>
			) : (
				<PPTRender
					key={`ppt-${renderKey}`}
					slidePaths={originalSlidesPaths}
					attachments={attachments}
					attachmentList={attachmentList}
					mainFileId={displayData?.file_id}
					mainFileName={displayData?.file_name}
					filePathMapping={filePathMapping}
					selectedProject={selectedProject}
					metadata={metadata}
					isPlaybackMode={isPlaybackMode}
					allowEdit={allowEdit}
					saveEditContent={saveEditContent}
					onSortSave={handleSortSave}
					openNewTab={openNewTab}
					onDownload={handleDownload}
					onFullscreen={onFullscreen}
					onActiveIndexChange={(_index, fileId) => {
						props.onActiveFileChange?.(fileId)
					}}
					isTabActive={props.isTabActive}
				/>
			)}
		</div>
	)
})
