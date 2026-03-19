import { useRef, useCallback, useState } from "react"
import type { CanvasDesignMethods, UploadImageResponse } from "../../types.magic"
import type { Canvas } from "../../canvas/Canvas"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"

interface UseFileInputOptions {
	methods?: CanvasDesignMethods
	/** 上传完成回调，传入完整结果（含 path、fileName）便于追加 @ 提及 */
	onFileUploaded: (result: UploadImageResponse) => void
	currentReferenceImages?: string[]
	canvas?: Canvas
	imageElementId?: string
	maxReferenceImages?: number
}

export function useFileInput(options: UseFileInputOptions) {
	const {
		methods,
		onFileUploaded,
		currentReferenceImages,
		canvas,
		imageElementId,
		maxReferenceImages,
	} = options

	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const [isUploading, setIsUploading] = useState(false)

	// 触发文件选择对话框
	const triggerFileSelect = useCallback(() => {
		fileInputRef.current?.click()
	}, [])

	// 处理文件选择变化
	const handleFileChange = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const files = event.target.files
			if (!files || files.length === 0 || !methods?.uploadImages) {
				return
			}

			// 计算当前已有参考图数量
			const currentCount = currentReferenceImages?.length || 0

			// 计算还能上传多少个文件
			let allowedCount: number | undefined
			if (maxReferenceImages !== undefined) {
				allowedCount = Math.max(0, maxReferenceImages - currentCount)
				if (allowedCount === 0) {
					// 已达到最大数量限制，重置 input
					event.target.value = ""
					return
				}
			}

			// 根据限制选择文件
			const filesToUpload: File[] = []
			if (allowedCount !== undefined) {
				// 只选择允许数量的文件
				for (let i = 0; i < Math.min(files.length, allowedCount); i++) {
					filesToUpload.push(files[i])
				}
			} else {
				// 没有限制，选择所有文件
				for (let i = 0; i < files.length; i++) {
					filesToUpload.push(files[i])
				}
			}

			if (filesToUpload.length === 0) {
				event.target.value = ""
				return
			}

			if (!canvas) {
				return
			}

			setIsUploading(true)
			try {
				// 使用全局上传管理器直接上传（参考图上传支持回调）
				await canvas.imageUploadManager.uploadDirect(
					filesToUpload,
					currentReferenceImages,
					{
						onUploadComplete: (result, _index) => {
							// 每个文件上传完成后立即处理
							if (result && result.path) {
								// 保存参考图信息到图片实例
								if (imageElementId) {
									const elementInstance =
										canvas.elementManager.getElementInstance(imageElementId)
									if (
										elementInstance &&
										elementInstance instanceof ImageElementClass
									) {
										elementInstance.saveReferenceImageInfos([result])
									}
								}

								// 通知父组件（含 path、fileName，便于追加 @ 提及）
								onFileUploaded(result)
							}
						},
						onUploadFailed: (error, index) => {
							// 处理单个文件上传失败
							console.error(`File ${index} upload failed:`, error)
						},
					},
				)
			} catch (error) {
				//
			} finally {
				setIsUploading(false)
				// 重置 input，以便可以再次选择同一个文件
				event.target.value = ""
			}
		},
		[
			methods,
			currentReferenceImages,
			onFileUploaded,
			canvas,
			imageElementId,
			maxReferenceImages,
		],
	)

	return {
		fileInputRef,
		triggerFileSelect,
		handleFileChange,
		isUploading,
	}
}
