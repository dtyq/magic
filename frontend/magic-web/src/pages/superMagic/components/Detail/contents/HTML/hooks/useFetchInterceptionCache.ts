import { useRef, useState, useCallback } from "react"
import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import type { OnFetchIntercepted } from "../utils/fetchInterceptor"
import type { DependencyEntry } from "../components/DevConsole/types"
import { logger as Logger } from "@/utils/log"

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
	isEditMode?: boolean
	iframeRef: React.RefObject<HTMLIFrameElement>
	content: string
	refreshIframeContent: () => void
	setContentInjected: (injected: boolean) => void
}) {
	const {
		attachmentList,
		sandboxType,
		isEditMode,
		iframeRef,
		content,
		refreshIframeContent,
		setContentInjected,
	} = options

	// 拦截缓存：相对路径 -> { file_id, updated_at, expires_at }
	const interceptedFetchCacheRef = useRef<Map<string, InterceptedCacheItem>>(new Map())

	// Dynamic dependency entries collected from fetch interception
	const [dynamicDependencyEntries, setDynamicDependencyEntries] = useState<DependencyEntry[]>([])
	const dynamicDepsSeenRef = useRef<Set<string>>(new Set())

	// 拦截记录回调函数
	const handleFetchIntercepted = useMemoizedFn<OnFetchIntercepted>(
		(relativePath, fileId, updatedAt, expiresAt, resolvedUrl) => {
			interceptedFetchCacheRef.current.set(relativePath, {
				file_id: fileId,
				updated_at: updatedAt,
				expires_at: expiresAt,
			})

			// Collect dynamic dependency entry (deduplicate by relativePath)
			if (resolvedUrl && !dynamicDepsSeenRef.current.has(relativePath)) {
				dynamicDepsSeenRef.current.add(relativePath)
				const entry: DependencyEntry = {
					id: `dynamic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					type: guessDependencyType(relativePath),
					originalUrl: relativePath,
					resolvedUrl,
					tagName: guessTagName(relativePath),
					attrName: guessAttrName(relativePath),
					source: "dynamic",
					timestamp: Date.now(),
				}
				setDynamicDependencyEntries((prev) => [...prev, entry])
			}
		},
	)

	const clearDynamicDependencies = useCallback(() => {
		setDynamicDependencyEntries([])
		dynamicDepsSeenRef.current.clear()
	}, [])

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
			if (isEditMode) {
				logger.report("编辑模式下检测到拦截文件更新，跳过 iframe 自动刷新", {
					hasUpdatedFile,
				})
				return
			}

			try {
				refreshIframeContent()
				setContentInjected(true)
			} catch (error) {
				console.error("刷新 iframe 内容时出错:", error)
				setContentInjected(false)
			}
		}
	}, [attachmentList, sandboxType, isEditMode, content, refreshIframeContent, setContentInjected])

	return {
		handleFetchIntercepted,
		dynamicDependencyEntries,
		clearDynamicDependencies,
	}
}

// ─── Helpers for guessing resource metadata from path ─────────────────────

function guessDependencyType(path: string): DependencyEntry["type"] {
	const ext = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() || ""
	if (["js", "mjs", "cjs", "ts"].includes(ext)) return "script"
	if (["css", "less", "scss", "sass"].includes(ext)) return "stylesheet"
	if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif", "bmp"].includes(ext))
		return "image"
	if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext)) return "font"
	if (["mp4", "webm", "ogg", "mp3", "wav", "flac", "aac"].includes(ext)) return "media"
	if (["html", "htm"].includes(ext)) return "iframe"
	return "other"
}

function guessTagName(path: string): string {
	const t = guessDependencyType(path)
	switch (t) {
		case "script":
			return "SCRIPT"
		case "stylesheet":
			return "LINK"
		case "image":
			return "IMG"
		case "font":
			return "LINK"
		case "media":
			return "VIDEO"
		case "iframe":
			return "IFRAME"
		default:
			return "LINK"
	}
}

function guessAttrName(path: string): string {
	const t = guessDependencyType(path)
	switch (t) {
		case "script":
			return "src"
		case "stylesheet":
			return "href"
		case "image":
			return "src"
		case "font":
			return "href"
		case "media":
			return "src"
		case "iframe":
			return "src"
		default:
			return "href"
	}
}
