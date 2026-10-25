import { useRef, useCallback, useEffect, useState } from "react"
import type { CanvasDesignMethods, UploadFileResponse } from "../../../public/magic-types"
import type { Canvas } from "../../../runtime/core/Canvas"
import { ImageElement as ImageElementClass } from "../../../runtime/elements/image/ImageElement"
import { VideoElement as VideoElementClass } from "../../../runtime/elements/video/VideoElement"
import { isAudioFile, isImageFile, isVideoFile } from "../../../runtime/shared/ids"
import {
	CanvasUploadMentionController,
	type CanvasUploadMentionHandle,
} from "./CanvasUploadMentionController"

function primeUploadedResource(
	canvas: Canvas,
	file: File | undefined,
	result: UploadFileResponse,
): void {
	if (!file || !result.src) return

	if (isImageFile(file)) {
		canvas.imageResourceManager.primeCache(result.path, result)
	} else if (isVideoFile(file)) {
		canvas.videoResourceManager.primeCache(result.path, result)
	} else if (isAudioFile(file)) {
		canvas.audioResourceManager.primeCache(result.path, result)
	}
}

interface UseFileInputOptions {
	methods?: CanvasDesignMethods
	/** 上传完成回调，传入完整结果（含 path、fileName）便于追加 @ 提及；后两项为本轮选择中的序号与总数（多选上传） */
	onFileUploaded: (
		result: UploadFileResponse,
		fileIndexInBatch?: number,
		batchTotal?: number,
	) => void
	currentReferenceFiles?: string[]
	canvas?: Canvas
	/** 中性命名：目标元素 id（图片/视频通用） */
	elementId?: string
	maxReferenceFiles?: number
	accept?: string
	/** 本次文件选择最多处理多少个文件；替换场景传 1。 */
	maxSelectedFiles?: number
	/** 可选的逐项过滤器；用于混合媒体批量选择时跳过不支持/超限文件。 */
	filterFiles?: (files: File[]) => File[]
	/** 默认上传后写入元素参考资源；视频编辑器可关闭，自行按槽位分发 */
	shouldSaveToElement?: boolean
	/** 一次文件选择流程结束（含未选文件、校验失败、上传结束），用于清理临时上下文 */
	onUploadSessionEnd?: () => void
	/** 可选：将上传文件映射为编辑器内 pending mention，并按 pendingId 原位 resolve。 */
	pendingUploadMentionController?: CanvasUploadMentionController
	/** 允许调用方按槽位语义过滤是否进入 prompt pending mention。 */
	shouldInsertPendingMention?: (file: File, index: number) => boolean
}

interface UploadFilesOverrides {
	currentReferenceFiles?: string[]
	maxReferenceFiles?: number
	maxSelectedFiles?: number
	ignoreReferenceFileCapacity?: boolean
	/**
	 * Pre-allocated pending mention handles aligned with the files array passed to
	 * uploadFiles (before filtering/slicing). When set, beginBatch insert is skipped.
	 */
	pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
}

interface TriggerFileSelectOptions {
	maxSelectedFiles?: number
	ignoreReferenceFileCapacity?: boolean
}

export function useFileInput(options: UseFileInputOptions) {
	const {
		methods,
		onFileUploaded,
		currentReferenceFiles,
		canvas,
		elementId,
		maxReferenceFiles,
		accept,
		maxSelectedFiles,
		filterFiles,
		shouldSaveToElement = true,
		onUploadSessionEnd,
		pendingUploadMentionController,
		shouldInsertPendingMention,
	} = options

	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const nextFileSelectMaxSelectedFilesRef = useRef<number | undefined>(undefined)
	const nextFileSelectIgnoreCapacityRef = useRef<boolean | undefined>(undefined)
	const [isUploading, setIsUploading] = useState(false)

	useEffect(() => {
		return () => pendingUploadMentionController?.invalidateSession()
	}, [pendingUploadMentionController])

	const finishUploadSession = useCallback(() => {
		nextFileSelectMaxSelectedFilesRef.current = undefined
		nextFileSelectIgnoreCapacityRef.current = undefined
		onUploadSessionEnd?.()
	}, [onUploadSessionEnd])

	// 触发文件选择对话框
	const triggerFileSelect = useCallback(
		(options?: TriggerFileSelectOptions) => {
			nextFileSelectMaxSelectedFilesRef.current = options?.maxSelectedFiles
			nextFileSelectIgnoreCapacityRef.current = options?.ignoreReferenceFileCapacity
			if (fileInputRef.current && accept) {
				fileInputRef.current.accept = accept
			}
			if (fileInputRef.current) {
				fileInputRef.current.multiple = options?.maxSelectedFiles === 1 ? false : true
			}
			fileInputRef.current?.click()
		},
		[accept],
	)

	const uploadFiles = useCallback(
		async (selectedFiles: File[], overrides?: UploadFilesOverrides) => {
			const uploadedResults: UploadFileResponse[] = []
			const filteredSelectedFiles = filterFiles ? filterFiles(selectedFiles) : selectedFiles
			const nextCurrentReferenceFiles =
				overrides?.currentReferenceFiles ?? currentReferenceFiles ?? []
			const nextMaxReferenceFiles = overrides?.maxReferenceFiles ?? maxReferenceFiles
			const nextMaxSelectedFiles =
				overrides?.maxSelectedFiles ??
				nextFileSelectMaxSelectedFilesRef.current ??
				maxSelectedFiles
			const ignoreReferenceFileCapacity =
				overrides?.ignoreReferenceFileCapacity ??
				nextFileSelectIgnoreCapacityRef.current ??
				false
			const currentCount = nextCurrentReferenceFiles.length

			let allowedCount: number | undefined
			if (!ignoreReferenceFileCapacity && nextMaxReferenceFiles !== undefined) {
				allowedCount = Math.max(0, nextMaxReferenceFiles - currentCount)
			}

			const selectedFilesWithinSelectionLimit =
				nextMaxSelectedFiles !== undefined
					? filteredSelectedFiles.slice(0, Math.max(0, Math.floor(nextMaxSelectedFiles)))
					: filteredSelectedFiles

			if (selectedFilesWithinSelectionLimit.length === 0 || !methods?.uploadFiles) {
				finishUploadSession()
				return uploadedResults
			}

			if (allowedCount === 0) {
				finishUploadSession()
				return uploadedResults
			}

			const filesToUpload =
				allowedCount !== undefined
					? selectedFilesWithinSelectionLimit.slice(0, allowedCount)
					: selectedFilesWithinSelectionLimit

			if (filesToUpload.length === 0) {
				finishUploadSession()
				return uploadedResults
			}

			if (!canvas) {
				finishUploadSession()
				return uploadedResults
			}

			const batchTotal = filesToUpload.length
			const pendingHandleByIndex = new Map<number, CanvasUploadMentionHandle>()
			const preallocatedHandles = overrides?.pendingMentionHandles
			if (preallocatedHandles) {
				filesToUpload.forEach((file, uploadIndex) => {
					const sourceIndex = selectedFiles.indexOf(file)
					const handle = sourceIndex >= 0 ? preallocatedHandles[sourceIndex] : undefined
					if (handle) pendingHandleByIndex.set(uploadIndex, handle)
				})
			} else {
				const pendingHandles =
					pendingUploadMentionController?.beginBatch(filesToUpload, {
						includeMention: shouldInsertPendingMention,
					}) ?? []
				pendingHandles.forEach((handle) => {
					pendingHandleByIndex.set(handle.index, handle)
				})
			}
			setIsUploading(true)
			try {
				await canvas.canvasFileUploadManager.uploadDirect(
					filesToUpload,
					nextCurrentReferenceFiles,
					{
						onUploadProgress: (progress, index) => {
							pendingUploadMentionController?.updateProgress(
								pendingHandleByIndex.get(index),
								progress,
							)
						},
						onUploadComplete: (result, index) => {
							if (result && result.path) {
								uploadedResults[index] = result
								const pendingHandle = pendingHandleByIndex.get(index)
								if (
									pendingHandle &&
									pendingUploadMentionController?.resolve(
										pendingHandle,
										result,
									) !== true
								) {
									return
								}
								// 先登记上传结果，再更新编辑器状态，避免 SourceList 在附件快照刷新前按 path 解析失败。
								primeUploadedResource(canvas, filesToUpload[index], result)

								if (shouldSaveToElement && elementId) {
									const elementInstance =
										canvas.elementManager.getElementInstance(elementId)
									if (
										elementInstance &&
										(elementInstance instanceof ImageElementClass ||
											elementInstance instanceof VideoElementClass)
									) {
										elementInstance.saveReferenceImageInfos([result])
									}
								}

								onFileUploaded(result, index, batchTotal)
							}
						},
						onUploadFailed: (error, index) => {
							pendingUploadMentionController?.fail(
								pendingHandleByIndex.get(index),
								error,
							)
							console.error(`File ${index} upload failed:`, error)
						},
					},
				)
			} catch (error) {
				pendingHandleByIndex.forEach((handle) =>
					pendingUploadMentionController?.fail(
						handle,
						error instanceof Error ? error : String(error),
					),
				)
			} finally {
				setIsUploading(false)
				finishUploadSession()
			}
			return uploadedResults.filter((result): result is UploadFileResponse => Boolean(result))
		},
		[
			methods,
			currentReferenceFiles,
			maxReferenceFiles,
			maxSelectedFiles,
			canvas,
			shouldSaveToElement,
			elementId,
			onFileUploaded,
			finishUploadSession,
			filterFiles,
			pendingUploadMentionController,
			shouldInsertPendingMention,
		],
	)

	// 处理文件选择变化
	const handleFileChange = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			try {
				await uploadFiles(Array.from(event.target.files || []))
			} finally {
				event.target.value = ""
			}
		},
		[uploadFiles],
	)

	return {
		fileInputRef,
		triggerFileSelect,
		uploadFiles,
		handleFileChange,
		isUploading,
	}
}
