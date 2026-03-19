import { useCallback, useEffect, useRef } from "react"
import type { GetFileInfoResponse } from "@/components/CanvasDesign/types.magic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
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
}

interface UseFileInfoProviderReturn {
	getFileInfo: (path: string) => Promise<GetFileInfoResponse>
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	setFileInfoCache: (path: string, fileInfo: GetFileInfoResponse) => void
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
	const { flatAttachments } = options
	const { t } = useTranslation("super")

	// 存储每个 path 的防抖项
	const debounceMapRef = useRef<Map<string, DebounceItem>>(new Map())

	// 当文件列表变化时，清理已删除文件的缓存
	useEffect(() => {
		cleanupFileInfoCache(flatAttachments)
	}, [flatAttachments])

	// 组件卸载时清理所有防抖定时器
	useEffect(() => {
		const debounceMap = debounceMapRef.current
		return () => {
			for (const item of debounceMap.values()) {
				clearTimeout(item.timer)
			}
			debounceMap.clear()
		}
	}, [])

	/**
	 * 获取文件信息（带防抖）
	 * 通过 designFileInfoCache 的 getFileInfoByPath 获取文件信息
	 * 该方法已包含缓存机制和批量请求合并功能
	 * 防抖机制：相同 path 的多次调用会在防抖窗口内合并，共享同一个 Promise
	 */
	const getFileInfo = useCallback(
		(path: string): Promise<GetFileInfoResponse> => {
			const debounceMap = debounceMapRef.current

			// 如果该 path 已有防抖项，清除之前的定时器并复用 Promise
			const existingItem = debounceMap.get(path)
			if (existingItem) {
				clearTimeout(existingItem.timer)
				// 重新设置定时器
				const timer = setTimeout(async () => {
					// 从防抖 Map 中移除
					debounceMap.delete(path)

					try {
						const result = await getFileInfoByPath(path, flatAttachments)

						if (!result) {
							const error = new Error(t("design.errors.fileNotFoundByPath", { path }))
							existingItem.reject(error)
							return
						}

						existingItem.resolve(result)
					} catch (error) {
						existingItem.reject(error as Error)
					}
				}, DEBOUNCE_DELAY_MS)

				// 更新定时器
				existingItem.timer = timer
				return existingItem.promise
			}

			// 创建新的 Promise
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

			// 设置防抖定时器
			const timer = setTimeout(async () => {
				// 从防抖 Map 中移除
				debounceMap.delete(path)

				try {
					const result = await getFileInfoByPath(path, flatAttachments)

					if (!result) {
						const error = new Error(t("design.errors.fileNotFoundByPath", { path }))
						promiseCallbacks.reject(error)
						return
					}

					promiseCallbacks.resolve(result)
				} catch (error) {
					promiseCallbacks.reject(error as Error)
				}
			}, DEBOUNCE_DELAY_MS)

			// 存储防抖项
			debounceMap.set(path, {
				timer,
				promise,
				resolve: promiseCallbacks.resolve,
				reject: promiseCallbacks.reject,
			})

			return promise
		},
		[t, flatAttachments],
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
				const result = await getSharedFileInfoById(fileId, fileName, fileSize)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : t("design.errors.getFileInfoFailed")
				throw new Error(errorMessage)
			}
		},
		[t],
	)

	/**
	 * 设置文件信息缓存
	 * 用于外部直接设置缓存，避免重复调用 API
	 */
	const setFileInfoCache = useCallback(
		(path: string, fileInfo: GetFileInfoResponse) => {
			setSharedFileInfoCache(path, fileInfo, flatAttachments)
		},
		[flatAttachments],
	)

	return {
		getFileInfo,
		getFileInfoById,
		setFileInfoCache,
	}
}
