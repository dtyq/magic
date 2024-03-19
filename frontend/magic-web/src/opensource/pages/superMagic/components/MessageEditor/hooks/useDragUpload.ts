import { useState, useCallback } from "react"
import {
	AttachmentDragData,
	MultipleFilesDragData,
	TabDragData,
	PPTSlideDragData,
} from "../utils/drag"

interface UseDragUploadProps {
	enableFileDrop?: boolean
	onFilesDropped?: (files: FileList, dataTransfer: DataTransfer) => void | Promise<void>
	onDataDropped?: (
		data: TabDragData | AttachmentDragData | MultipleFilesDragData | PPTSlideDragData,
	) => void // 新增：处理自定义数据拖拽
}

interface UseDragUploadReturn {
	isDragOver: boolean
	dragEvents: {
		onDragEnter: (e: React.DragEvent) => void
		onDragLeave: (e: React.DragEvent) => void
		onDragOver: (e: React.DragEvent) => void
		onDrop: (e: React.DragEvent) => void
	}
}

/**
 * useDragUpload - Handle file drag and drop upload functionality
 *
 * @param props - Hook configuration
 * @returns Drag state and event handlers
 */
export function useDragUpload({
	enableFileDrop = true,
	onFilesDropped,
	onDataDropped,
}: UseDragUploadProps): UseDragUploadReturn {
	const [isDragOver, setIsDragOver] = useState(false)

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (!enableFileDrop && e.dataTransfer.types.includes("Files")) {
				return
			}

			setIsDragOver(true)
		},
		[enableFileDrop],
	)

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragOver(false)
		}
	}, [])

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (!enableFileDrop && e.dataTransfer.types.includes("Files")) {
				return
			}

			if (!isDragOver) {
				setIsDragOver(true)
			}
		},
		[enableFileDrop, isDragOver],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)

			// 1. 检查是否有自定义数据
			const customData = e.dataTransfer.getData("text/plain")
			if (customData && onDataDropped) {
				try {
					const parsedData = JSON.parse(customData)
					onDataDropped(parsedData)
					return
				} catch (error) {
					console.error("Error parsing drag data:", error)
					return
				}
			}

			// 2. 如果没有自定义数据，检查是否有文件
			if (e.dataTransfer.files.length > 0) {
				onFilesDropped?.(e.dataTransfer.files, e.dataTransfer)
			}
		},
		[onFilesDropped, onDataDropped],
	)

	return {
		isDragOver,
		dragEvents: {
			onDragEnter: handleDragEnter,
			onDragLeave: handleDragLeave,
			onDragOver: handleDragOver,
			onDrop: handleDrop,
		},
	}
}
