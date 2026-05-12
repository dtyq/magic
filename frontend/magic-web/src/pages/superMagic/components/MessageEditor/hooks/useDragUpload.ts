import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import {
	AttachmentDragData,
	MultipleFilesDragData,
	TabDragData,
	PPTSlideDragData,
	SelfMediaCardDragData,
} from "../utils/drag"
import { dragLogger } from "../utils/dragLogger"

interface UseDragUploadProps {
	enableFileDrop?: boolean
	onFilesDropped?: (files: FileList, dataTransfer: DataTransfer) => void | Promise<void>
	onDataDropped?: (
		data:
			| TabDragData
			| AttachmentDragData
			| MultipleFilesDragData
			| PPTSlideDragData
			| SelfMediaCardDragData,
	) => void // Handle custom data drops
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
 * useDragUpload - Handle file drag and drop upload.
 *
 * Uses a drag counter to avoid flaky `relatedTarget` / `contains`
 * checks when the pointer moves across nested children (editor DOM,
 * portals, popovers, etc.). The counter increments on every enter
 * and decrements on every leave; the overlay is shown only while
 * the counter is > 0.
 */
export function useDragUpload({
	enableFileDrop = true,
	onFilesDropped,
	onDataDropped,
}: UseDragUploadProps): UseDragUploadReturn {
	const [isDragOver, setIsDragOver] = useState(false)
	const dragCounterRef = useRef(0)

	const resetDragState = useCallback(() => {
		dragCounterRef.current = 0
		setIsDragOver(false)
	}, [])

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()

			// 📋 日志记录：拖拽进入
			dragLogger.logDragEnter({
				targetElement: (e.currentTarget as HTMLElement)?.dataset?.testid || "unknown",
				dataTransferTypes: Array.from(e.dataTransfer.types),
				enableFileDrop,
				dragCounter: dragCounterRef.current + 1,
			})

			if (!enableFileDrop && e.dataTransfer.types.includes("Files")) {
				dragLogger.logError("dragEnter", new Error("File drop disabled"), {
					enableFileDrop,
					hasFiles: e.dataTransfer.types.includes("Files"),
				})
				return
			}

			dragCounterRef.current += 1
			if (dragCounterRef.current === 1) {
				setIsDragOver(true)
			}
		},
		[enableFileDrop],
	)

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()

		// 📋 日志记录：拖拽离开
		dragLogger.logDragLeave({
			targetElement: (e.currentTarget as HTMLElement)?.dataset?.testid || "unknown",
			dragCounter: dragCounterRef.current - 1,
			isDragOver: dragCounterRef.current - 1 === 0 ? false : undefined,
		})

		if (dragCounterRef.current <= 0) {
			return
		}

		dragCounterRef.current -= 1
		if (dragCounterRef.current === 0) {
			setIsDragOver(false)
		}
	}, [])

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()

			// 📋 日志记录：拖拽悬停（仅在计数器为0时记录，避免日志过多）
			if (dragCounterRef.current === 0) {
				dragLogger.logDragOver({
					targetElement: (e.currentTarget as HTMLElement)?.dataset?.testid || "unknown",
					dataTransferTypes: Array.from(e.dataTransfer.types),
					dragCounter: dragCounterRef.current,
					isDragOver: false,
				})
			}

			if (!enableFileDrop && e.dataTransfer.types.includes("Files")) {
				return
			}

			// Recover when the initial `dragenter` was missed
			// (e.g. dragging in from outside the browser window).
			if (dragCounterRef.current === 0) {
				dragCounterRef.current = 1
				setIsDragOver(true)
			}
		},
		[enableFileDrop],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			resetDragState()

			const customData = e.dataTransfer.getData("text/plain")
			const hasFiles = e.dataTransfer.files.length > 0

			// 📋 日志记录：拖拽放下
			dragLogger.logDrop({
				targetElement: (e.currentTarget as HTMLElement)?.dataset?.testid || "unknown",
				dataTransferTypes: Array.from(e.dataTransfer.types),
				hasFiles,
				filesCount: e.dataTransfer.files.length,
				hasCustomData: !!customData,
				customDataPreview: customData?.substring(0, 100),
				uploadEnabled: !!onFilesDropped,
			})

			if (customData && onDataDropped) {
				try {
					const parsedData = JSON.parse(customData)

					// 📋 日志记录：数据解析成功
					dragLogger.logDataParsing({
						success: true,
						rawData: customData.substring(0, 200),
						parsedData,
						dragType: parsedData.type,
					})

					onDataDropped(parsedData)
					return
				} catch (error) {
					// 📋 日志记录：数据解析失败
					dragLogger.logDataParsing({
						success: false,
						rawData: customData.substring(0, 200),
						error,
					})

					console.error("Error parsing drag data:", error)
					return
				}
			}

			if (hasFiles) {
				onFilesDropped?.(e.dataTransfer.files, e.dataTransfer)
			}
		},
		[onFilesDropped, onDataDropped, resetDragState],
	)

	// Fallback: cover ESC cancel and drag-out-of-window cases
	// so a stale `isDragOver=true` never lingers.
	useEffect(() => {
		const handleWindowDragEnd = () => {
			if (dragCounterRef.current !== 0 || isDragOver) {
				resetDragState()
			}
		}

		window.addEventListener("dragend", handleWindowDragEnd)
		window.addEventListener("drop", handleWindowDragEnd)
		return () => {
			window.removeEventListener("dragend", handleWindowDragEnd)
			window.removeEventListener("drop", handleWindowDragEnd)
		}
	}, [isDragOver, resetDragState])

	const dragEvents = useMemo(
		() => ({
			onDragEnter: handleDragEnter,
			onDragLeave: handleDragLeave,
			onDragOver: handleDragOver,
			onDrop: handleDrop,
		}),
		[handleDragEnter, handleDragLeave, handleDragOver, handleDrop],
	)

	return {
		isDragOver,
		dragEvents,
	}
}
