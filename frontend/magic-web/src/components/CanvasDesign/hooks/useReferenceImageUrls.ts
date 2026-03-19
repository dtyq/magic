import { useState, useEffect, useCallback, useMemo } from "react"
import { useCanvas } from "../context/CanvasContext"
import { useCanvasEvent } from "./useCanvasEvent"
import { normalizePath } from "../canvas/utils/utils"
import type { ImageInfo } from "../canvas/utils/ImageResourceManager"
import { TOOLTIP_THUMBNAIL_MIN_SIZE } from "../canvas/utils/imageThumbnailUtils"

/** 参考图 URL 信息 */
export interface ReferenceImageUrlInfo {
	/** 缩略图 */
	thumbnailUrl: string | undefined
	/** tooltip/popover 预览图 */
	fullUrl: string | undefined
	/** 图片信息 */
	imageInfo: ImageInfo | undefined
	/** 按需加载 tooltip 缩略图的方法 */
	loadTooltip: () => Promise<void>
	/** 是否正在加载缩略图 */
	isLoading: boolean
	/** 预览尺寸（基于 imageInfo 计算） */
	previewSize: { width?: number; height?: number }
	/** 是否正在加载大图（当弹窗打开且 fullUrl 未加载时） */
	isFullUrlLoading: boolean
	/** 弹窗打开状态 */
	open: boolean
	/** 设置弹窗打开状态 */
	setOpen: (open: boolean) => void
	/** 处理弹窗打开/关闭事件 */
	handleOpenChange: (open: boolean) => void
}

// 计算预设尺寸，保持宽高比，最大不超过 tooltip 缩略图尺寸
function calculatePreviewSize(
	imageInfo: { naturalWidth: number; naturalHeight: number } | undefined,
): { width?: number; height?: number } {
	if (!imageInfo) {
		return {}
	}

	const maxSize = TOOLTIP_THUMBNAIL_MIN_SIZE
	const { naturalWidth, naturalHeight } = imageInfo

	if (naturalWidth <= maxSize && naturalHeight <= maxSize) {
		return { width: naturalWidth, height: naturalHeight }
	}

	const ratio = naturalWidth / naturalHeight
	if (naturalWidth > naturalHeight) {
		return { width: maxSize, height: Math.round(maxSize / ratio) }
	} else {
		return { width: Math.round(maxSize * ratio), height: maxSize }
	}
}

/**
 * 从 ImageResourceManager 获取参考图 URL
 * @param path 图片路径
 */
export function useReferenceImageUrls(path: string): ReferenceImageUrlInfo {
	const { canvas } = useCanvas()
	const [open, setOpen] = useState(false)
	const [urlInfo, setUrlInfo] = useState<{
		thumbnailUrl: string | undefined
		fullUrl: string | undefined
		imageInfo: ImageInfo | undefined
		loadTooltip: () => Promise<void>
	}>({
		thumbnailUrl: undefined,
		fullUrl: undefined,
		imageInfo: undefined,
		loadTooltip: () => Promise.resolve(),
	})

	// 计算预览尺寸
	const previewSize = useMemo(() => calculatePreviewSize(urlInfo.imageInfo), [urlInfo.imageInfo])

	// 是否正在加载缩略图
	const isLoading = !urlInfo.thumbnailUrl

	// 是否正在加载大图（当弹窗打开且 fullUrl 未加载时）
	const isFullUrlLoading = open && !urlInfo.fullUrl

	// 按需加载 tooltip 缩略图（直接使用 ossSrc）
	const loadTooltip = useCallback(async () => {
		if (!canvas) return

		const resource = await canvas.imageResourceManager.getResource(path)

		setUrlInfo((prev) => {
			if (prev.fullUrl) {
				return prev
			}

			return {
				...prev,
				fullUrl: resource?.ossSrc || undefined,
			}
		})
	}, [canvas, path])

	// 处理弹窗打开/关闭事件
	const handleOpenChange = useCallback(
		(newOpen: boolean) => {
			setOpen(newOpen)
			if (newOpen) {
				setUrlInfo((prev) => {
					if (!prev.fullUrl) {
						loadTooltip()
					}
					return prev
				})
			}
		},
		[loadTooltip],
	)

	// 更新路径的 URL（只加载 small）
	const updatePathUrl = useCallback(async () => {
		if (!canvas) return

		const resource = await canvas.imageResourceManager.getResource(path)
		const smallUrl = resource?.thumbnail?.small
		const imageInfo = resource?.imageInfo

		setUrlInfo((prev) => {
			const newInfo = {
				thumbnailUrl: smallUrl || undefined,
				fullUrl: prev.fullUrl, // 保持已有的 tooltip URL
				imageInfo: imageInfo || prev.imageInfo,
				loadTooltip,
			}

			// 只有当 URL 或 imageInfo 实际变化时才更新
			if (
				prev.thumbnailUrl === newInfo.thumbnailUrl &&
				prev.imageInfo === newInfo.imageInfo
			) {
				return prev
			}

			return newInfo
		})
	}, [canvas, path, loadTooltip])

	// 初始化 URL（只加载 small）
	useEffect(() => {
		if (!canvas) {
			setUrlInfo({
				thumbnailUrl: undefined,
				fullUrl: undefined,
				imageInfo: undefined,
				loadTooltip: () => Promise.resolve(),
			})
			return
		}

		// 立即尝试更新一次 URL 映射（如果资源已缓存，可以立即显示）
		updatePathUrl()
	}, [canvas, path, updatePathUrl])

	// 监听图片资源加载完成事件，确保 ossSrc 可用后更新 tooltip URL
	useCanvasEvent(
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				const normalizedEventPath = data.path
				if (normalizePath(path) === normalizedEventPath) {
					// 如果弹窗已打开但 fullUrl 还未设置，尝试加载
					if (open && !urlInfo.fullUrl) {
						loadTooltip()
					}
				}
			},
			[path, loadTooltip, open, urlInfo.fullUrl],
		),
	)

	// 监听资源加载完成事件（当图片资源加载完成时，触发缩略图生成）
	useCanvasEvent(
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				// 只有当加载的路径匹配时才更新（使用规范化路径比较）
				const normalizedEventPath = data.path
				if (normalizePath(path) === normalizedEventPath) {
					updatePathUrl()
				}
			},
			[path, updatePathUrl],
		),
	)

	return {
		...urlInfo,
		isLoading,
		previewSize,
		isFullUrlLoading,
		open,
		setOpen,
		handleOpenChange,
	}
}
