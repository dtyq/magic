import { useRef } from "react"
import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import type { OnFetchIntercepted } from "../utils/fetchInterceptor"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("useFetchInterceptionCache")

/**
 * 拦截缓存项接口
 */
interface InterceptedCacheItem {
	file_id: string
	updated_at: string | undefined
	expires_at: string | undefined
}

/**
 * useFetchInterceptionCache Hook
 * 用于管理 fetch 拦截缓存，监听 attachmentList 变化并触发刷新
 */
export function useFetchInterceptionCache(options: {
	attachmentList?: any[]
	sandboxType?: "iframe" | "shadow-dom"
	iframeRef: React.RefObject<HTMLIFrameElement>
	content: string
	refreshIframeContent: () => void
	setContentInjected: (injected: boolean) => void
}) {
	const {
		attachmentList,
		sandboxType,
		iframeRef,
		content,
		refreshIframeContent,
		setContentInjected,
	} = options

	// 拦截缓存：相对路径 -> { file_id, updated_at, expires_at }
	const interceptedFetchCacheRef = useRef<Map<string, InterceptedCacheItem>>(new Map())

	// 拦截记录回调函数
	const handleFetchIntercepted = useMemoizedFn<OnFetchIntercepted>(
		(relativePath, fileId, updatedAt, expiresAt) => {
			interceptedFetchCacheRef.current.set(relativePath, {
				file_id: fileId,
				updated_at: updatedAt,
				expires_at: expiresAt,
			})
		},
	)

	// 监听 attachmentList 变化，检查拦截的文件是否有更新
	useDeepCompareEffect(() => {
		if (!attachmentList || attachmentList.length === 0) return
		if (sandboxType !== "iframe" || !iframeRef.current || !content) return

		// 构建文件 ID 到 updated_at 的映射
		const fileUpdatedAtMap = new Map<string, string>()
		const flattenAttachments = (items: any[]): void => {
			for (const item of items) {
				if (item.file_id && item.updated_at) {
					fileUpdatedAtMap.set(item.file_id, item.updated_at)
				}
				if (item.children && item.children.length > 0) {
					flattenAttachments(item.children)
				}
			}
		}
		flattenAttachments(attachmentList)

		// 检查拦截缓存中的文件是否有更新
		let hasUpdatedFile = false
		for (const [relativePath, cacheItem] of interceptedFetchCacheRef.current.entries()) {
			const currentUpdatedAt = fileUpdatedAtMap.get(cacheItem.file_id)
			// 如果文件的 updated_at 已更新，需要刷新 iframe 内容
			if (
				currentUpdatedAt &&
				cacheItem.updated_at &&
				currentUpdatedAt !== cacheItem.updated_at
			) {
				hasUpdatedFile = true
				const oldUpdatedAt = cacheItem.updated_at
				// 更新缓存中的 updated_at
				cacheItem.updated_at = currentUpdatedAt
				logger.report("检测到拦截文件已更新，触发 iframe 内容刷新", {
					relativePath,
					fileId: cacheItem.file_id,
					oldUpdatedAt,
					newUpdatedAt: currentUpdatedAt,
				})
			} else if (currentUpdatedAt && !cacheItem.updated_at && currentUpdatedAt) {
				// 如果缓存中没有 updated_at，但当前有，也更新缓存
				cacheItem.updated_at = currentUpdatedAt
			}
		}

		// 如果有文件更新，触发 iframe 内容刷新
		if (hasUpdatedFile) {
			try {
				refreshIframeContent()
				setContentInjected(true)
			} catch (error) {
				console.error("刷新 iframe 内容时出错:", error)
				setContentInjected(false)
			}
		}
	}, [attachmentList, sandboxType, content, refreshIframeContent, setContentInjected])

	return {
		handleFetchIntercepted,
	}
}
