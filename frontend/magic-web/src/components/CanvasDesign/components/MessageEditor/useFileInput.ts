import { useRef, useCallback, useState } from "react"
import type { CanvasDesignMethods, UploadFileResponse } from "../../types.magic"
import type { Canvas } from "../../canvas/Canvas"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"

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
	/** 默认上传后写入元素参考资源；视频编辑器可关闭，自行按槽位分发 */
	shouldSaveToElement?: boolean
	/** 一次文件选择流程结束（含未选文件、校验失败、上传结束），用于清理临时上下文 */
	onUploadSessionEnd?: () => void
}

interface UploadFilesOverrides {
	currentReferenceFiles?: string[]
	maxReferenceFiles?: number
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
		shouldSaveToElement = true,
		onUploadSessionEnd,
	} = options

	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const [isUploading, setIsUploading] = useState(false)

	// 触发文件选择对话框
	const triggerFileSelect = useCallback(() => {
		if (fileInputRef.current && accept) {
			fileInputRef.current.accept = accept
		}
		fileInputRef.current?.click()
	}, [accept])

	const uploadFiles = useCallback(
		async (selectedFiles: File[], overrides?: UploadFilesOverrides) => {
			const nextCurrentReferenceFiles =
				overrides?.currentReferenceFiles ?? currentReferenceFiles ?? []
			const nextMaxReferenceFiles = overrides?.maxReferenceFiles ?? maxReferenceFiles
			const currentCount = nextCurrentReferenceFiles.length

			let allowedCount: number | undefined
			if (nextMaxReferenceFiles !== undefined) {
				allowedCount = Math.max(0, nextMaxReferenceFiles - currentCount)
			}

			if (selectedFiles.length === 0 || !methods?.uploadFiles) {
				onUploadSessionEnd?.()
				return
			}

			if (allowedCount === 0) {
				onUploadSessionEnd?.()
				return
			}

			const filesToUpload =
				allowedCount !== undefined ? selectedFiles.slice(0, allowedCount) : selectedFiles

			if (filesToUpload.length === 0) {
				onUploadSessionEnd?.()
				return
			}

			if (!canvas) {
				onUploadSessionEnd?.()
				return
			}

			const batchTotal = filesToUpload.length
			setIsUploading(true)
			try {
				await canvas.canvasFileUploadManager.uploadDirect(
					filesToUpload,
					nextCurrentReferenceFiles,
					{
						onUploadComplete: (result, index) => {
							if (result && result.path) {
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
							console.error(`File ${index} upload failed:`, error)
						},
					},
				)
			} catch (error) {
				//
			} finally {
				setIsUploading(false)
				onUploadSessionEnd?.()
			}
		},
		[
			methods,
			currentReferenceFiles,
			maxReferenceFiles,
			canvas,
			shouldSaveToElement,
			elementId,
			onFileUploaded,
			onUploadSessionEnd,
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
