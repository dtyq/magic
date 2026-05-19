import { useState, useCallback, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useUpload } from "@/hooks/useUploadFiles"
import { genFileData } from "@/pages/vectorKnowledge/utils"

/** 文件上传状态 */
export type FileUploadStatus = "uploading" | "done" | "error"

/** 上传文件项 */
export interface UploadFileItem {
	uid: string
	name: string
	file: File
	status: FileUploadStatus
	progress?: number
	size?: number
	key?: string // 上传成功后的文件key
	path?: string // 上传成功后的文件路径
}

interface UseKnowledgeFileUploadOptions {
	/** 存储类型 */
	storageType?: "private" | "public"
	/** 上传成功回调 */
	onSuccess?: (file: UploadFileItem) => void
	/** 上传失败回调 */
	onError?: (file: UploadFileItem, error: unknown) => void
	/** 上传进度回调 */
	onProgress?: (uid: string, progress: number) => void
}

/**
 * 知识库文件上传 Hook
 * 复用现有 useUpload 的上传逻辑（与 LocalFile.tsx 保持一致）
 * 提供文件上传、状态管理、重试、删除等功能
 */
export function useKnowledgeFileUpload(options: UseKnowledgeFileUploadOptions = {}) {
	const { storageType = "private", onSuccess, onError, onProgress } = options

	const [fileList, setFileList] = useState<UploadFileItem[]>([])
	// 使用 ref 存储 file 到 uid 的映射，避免闭包问题
	const fileToUidMap = useRef<Map<File, string>>(new Map())

	const { uploadAndGetFileUrl } = useUpload({
		storageType,
		onProgress: (fileData, percent) => {
			// 从 map 中查找对应的 uid
			if (!fileData.file) return
			const uid = fileToUidMap.current.get(fileData.file)
			if (uid && onProgress) {
				onProgress(uid, percent)
			}
		},
	})

	/**
	 * 上传单个文件
	 */
	const uploadFile = useMemoizedFn(async (file: File, uid?: string) => {
		const newUid = uid || `${file.name}-${Date.now()}`

		// 记录 file 到 uid 的映射
		fileToUidMap.current.set(file, newUid)

		// 更新文件状态为上传中
		if (uid) {
			setFileList((prev) =>
				prev.map((item) =>
					item.uid === uid
						? { ...item, status: "uploading" as const, progress: 0 }
						: item,
				),
			)
		} else {
			setFileList((prev) => [
				...prev,
				{
					uid: newUid,
					name: file.name,
					file,
					status: "uploading" as const,
					progress: 0,
					size: file.size,
				},
			])
		}

		try {
			// 上传文件（与 LocalFile.tsx 保持一致）
			const newFile = genFileData(file)
			// 已通过 beforeFileUpload 预校验，故传入 () => true 跳过方法校验
			const { fullfilled } = await uploadAndGetFileUrl([newFile], () => true)

			if (fullfilled && fullfilled.length > 0) {
				const uploadResult = fullfilled[0]
				if (!uploadResult?.value?.path) {
					throw new Error("Upload failed: no path returned")
				}

				const { path } = uploadResult.value
				const key = path // key 和 path 使用相同的值

				// 更新为上传成功
				setFileList((prev) =>
					prev.map((item) => {
						if (item.uid === newUid) {
							const updatedItem = {
								...item,
								status: "done" as const,
								path,
								key,
								progress: 100,
							}
							onSuccess?.(updatedItem)
							return updatedItem
						}
						return item
					}),
				)

				// 清理映射
				fileToUidMap.current.delete(file)

				return { success: true, uid: newUid, path, key }
			} else {
				throw new Error("Upload failed: no result returned")
			}
		} catch (error) {
			console.error("File upload failed:", error)

			// 更新为上传失败
			setFileList((prev) =>
				prev.map((item) => {
					if (item.uid === newUid) {
						const errorItem = { ...item, status: "error" as const }
						onError?.(errorItem, error)
						return errorItem
					}
					return item
				}),
			)

			// 清理映射
			fileToUidMap.current.delete(file)

			return { success: false, uid: newUid, error }
		}
	})

	/**
	 * 批量上传文件
	 */
	const uploadFiles = useMemoizedFn(async (files: File[]) => {
		const results = await Promise.allSettled(files.map((file) => uploadFile(file)))
		return results
	})

	/**
	 * 重试上传
	 */
	const retryUpload = useMemoizedFn((uid: string) => {
		const fileItem = fileList.find((item) => item.uid === uid)
		if (fileItem && fileItem.status === "error") {
			void uploadFile(fileItem.file, uid)
		}
	})

	/**
	 * 删除文件
	 */
	const removeFile = useMemoizedFn((uid: string) => {
		setFileList((prev) => prev.filter((item) => item.uid !== uid))
	})

	/**
	 * 清空文件列表
	 */
	const clearFiles = useMemoizedFn(() => {
		setFileList([])
	})

	/**
	 * 获取上传成功的文件列表
	 */
	const getSuccessFiles = useCallback(() => {
		return fileList.filter((file) => file.status === "done")
	}, [fileList])

	/**
	 * 获取上传失败的文件列表
	 */
	const getErrorFiles = useCallback(() => {
		return fileList.filter((file) => file.status === "error")
	}, [fileList])

	/**
	 * 是否有文件正在上传
	 */
	const isUploading = useCallback(() => {
		return fileList.some((file) => file.status === "uploading")
	}, [fileList])

	/**
	 * 是否所有文件都上传成功
	 */
	const isAllSuccess = useCallback(() => {
		return fileList.length > 0 && fileList.every((file) => file.status === "done")
	}, [fileList])

	return {
		fileList,
		setFileList,
		uploadFile,
		uploadFiles,
		retryUpload,
		removeFile,
		clearFiles,
		getSuccessFiles,
		getErrorFiles,
		isUploading: isUploading(),
		isAllSuccess: isAllSuccess(),
	}
}
