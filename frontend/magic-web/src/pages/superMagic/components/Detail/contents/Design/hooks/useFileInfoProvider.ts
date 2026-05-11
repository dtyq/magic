import { useCallback, useEffect, useRef } from "react"
import type { GetFileInfoResponse } from "@/components/CanvasDesign/types.magic"
import { GET_FILE_INFO_NOT_FOUND_ERROR_CODE } from "@/components/CanvasDesign/canvas/utils/resourceLoadFailure"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { useTranslation } from "react-i18next"
import {
	getFileInfoByPath,
	getFileInfoById as getSharedFileInfoById,
	setFileInfoCache as setSharedFileInfoCache,
	cleanupFileInfoCache,
} from "../utils/designFileInfoCache"
import type { GetFileInfoResponseWithFileId } from "../utils/uploadCallbacks"

/**
 * 防抖延迟时间（毫秒）
 * 相同 path 的多次调用会在此时间窗口内合并
 */
const DEBOUNCE_DELAY_MS = 80

/**
 * 防抖项接口
 */
interface DebounceItem {
	timer: NodeJS.Timeout
	promise: Promise<GetFileInfoResponse>
	resolve: (value: GetFileInfoResponse) => void
	reject: (error: Error) => void
}

interface UseFileInfoProviderOptions {
	/** 已扁平化的附件列表（从入口传入） */
	flatAttachments?: FileItem[]
	/** 设计目录 ID，用于为 file info cache 建立命名空间 */
	designProjectId?: string
	/** 画布目录在项目中的路径段（与 magic.project.js 同级），用于解析 DSL 相对路径（如 `images/...` 或 `./images/...`） */
	designProjectBasePath?: string
	attachmentIndex?: DesignAttachmentIndex | null
}

interface UseFileInfoProviderReturn {
	getFileInfo: (
		path: string,
		options?: { useImageProcess?: boolean; forceRefresh?: boolean },
	) => Promise<GetFileInfoResponse>
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	setFileInfoCache: (path: string, fileInfo: GetFileInfoResponse) => void
}

function createFileNotFoundByPathError(path: string, message: string): Error {
	const error = new Error(message) as Error & { code?: string; path?: string }
	error.code = GET_FILE_INFO_NOT_FOUND_ERROR_CODE
	error.path = path
	return error
}

/**
 * 文件信息提供功能 Hook
 * 职责：根据文件路径获取文件信息
 * - 通过 designFileInfoCache 获取文件信息（包含缓存和批量请求合并）
 * - 当文件列表变化时，清理已删除文件的缓存
 */
export function useFileInfoProvider(
	options: UseFileInfoProviderOptions,
): UseFileInfoProviderReturn {
	const { flatAttachments, designProjectBasePath, designProjectId, attachmentIndex } = options
	const { t } = useTranslation("super")

	// 存储每个 path 的防抖项
	const debounceMapRef = useRef<Map<string, DebounceItem>>(new Map())

	// 当文件列表变化时，清理已删除文件的缓存
	useEffect(() => {
		cleanupFileInfoCache(flatAttachments, designProjectId)
	}, [flatAttachments, designProjectId])

	// 组件卸载时清理所有防抖定时器
	useEffect(() => {
		const debounceMap = debounceMapRef.current
		return () => {
			debounceMap.forEach((item) => {
				clearTimeout(item.timer)
			})
			debounceMap.clear()
		}
	}, [])

	/**
	 * 获取文件信息（带防抖）
	 * 通过 designFileInfoCache 的 getFileInfoByPath 获取文件信息
	 * 防抖按 path+options 分组，不同 options 不合并（返回的 URL 不同）
	 */
	const getFileInfo = useCallback(
		(
			path: string,
			opts?: { useImageProcess?: boolean; forceRefresh?: boolean },
		): Promise<GetFileInfoResponse> => {
			const debounceMap = debounceMapRef.current
			const base = designProjectBasePath
			const attachmentsSnapshotKey = attachmentIndex?.attachmentsSnapshotKey ?? ""
			const debounceKey = `${path}\0${opts?.useImageProcess === true ? "1" : "0"}\0${opts?.forceRefresh === true ? "1" : "0"}\0${base ?? ""}\0${attachmentsSnapshotKey}`

			const existingItem = debounceMap.get(debounceKey)
			if (existingItem) {
				clearTimeout(existingItem.timer)
				const timer = setTimeout(async () => {
					debounceMap.delete(debounceKey)
					try {
						const result = await getFileInfoByPath(path, flatAttachments, {
							...opts,
							designProjectBasePath: base,
							designProjectId,
							attachmentIndex,
							attachmentsSnapshotKeyOverride: attachmentIndex?.attachmentsSnapshotKey,
						})
						if (!result) {
							existingItem.reject(
								createFileNotFoundByPathError(
									path,
									t("design.errors.fileNotFoundByPath", { path }),
								),
							)
							return
						}
						existingItem.resolve(result)
					} catch (error) {
						existingItem.reject(error as Error)
					}
				}, DEBOUNCE_DELAY_MS)
				existingItem.timer = timer
				return existingItem.promise
			}

			const promiseCallbacks: {
				resolve: (value: GetFileInfoResponse) => void
				reject: (error: Error) => void
			} = {} as {
				resolve: (value: GetFileInfoResponse) => void
				reject: (error: Error) => void
			}
			const promise = new Promise<GetFileInfoResponse>((res, rej) => {
				promiseCallbacks.resolve = res
				promiseCallbacks.reject = rej
			})

			const timer = setTimeout(async () => {
				debounceMap.delete(debounceKey)
				try {
					const result = await getFileInfoByPath(path, flatAttachments, {
						...opts,
						designProjectBasePath: base,
						designProjectId,
						attachmentIndex,
						attachmentsSnapshotKeyOverride: attachmentIndex?.attachmentsSnapshotKey,
					})
					if (!result) {
						promiseCallbacks.reject(
							createFileNotFoundByPathError(
								path,
								t("design.errors.fileNotFoundByPath", { path }),
							),
						)
						return
					}
					promiseCallbacks.resolve(result)
				} catch (error) {
					promiseCallbacks.reject(error as Error)
				}
			}, DEBOUNCE_DELAY_MS)

			debounceMap.set(debounceKey, {
				timer,
				promise,
				resolve: promiseCallbacks.resolve,
				reject: promiseCallbacks.reject,
			})
			return promise
		},
		[t, flatAttachments, designProjectBasePath, designProjectId, attachmentIndex],
	)

	/**
	 * 通过 file_id 获取文件信息
	 * 优势：不依赖 path 和 attachments，直接使用 file_id 获取下载 URL
	 * 适用场景：上传完成后，API 已返回 file_id，但 attachments 可能还未更新
	 */
	const getFileInfoById = useCallback(
		async (
			fileId: string,
			fileName?: string,
			fileSize?: number,
		): Promise<GetFileInfoResponseWithFileId> => {
			try {
				const result = await getSharedFileInfoById(fileId, fileName, fileSize, {
					filesList: flatAttachments,
				})
				return result
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : t("design.errors.getFileInfoFailed")
				throw new Error(errorMessage)
			}
		},
		[t, flatAttachments],
	)

	/**
	 * 设置文件信息缓存
	 * 用于外部直接设置缓存，避免重复调用 API
	 */
	const setFileInfoCache = useCallback(
		(path: string, fileInfo: GetFileInfoResponse) => {
			setSharedFileInfoCache(
				path,
				fileInfo,
				flatAttachments,
				designProjectBasePath,
				designProjectId,
				attachmentIndex,
			)
		},
		[flatAttachments, designProjectBasePath, designProjectId, attachmentIndex],
	)

	return {
		getFileInfo,
		getFileInfoById,
		setFileInfoCache,
	}
}
