import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useOptionalCanvas } from "../../providers/CanvasProvider"
import { useCanvasEventWithInstance } from "../canvas"
import { areCanvasHostResourceReferencesSame } from "../../../runtime/shared/path/canvasResourcePath"
import type { ImageInfo } from "../../../runtime/resources/image/ImageResourceManager"
import { TOOLTIP_PREVIEW_MIN_SIZE } from "../../../runtime/resources/image/imagePreviewUtils"

/** 参考图 URL 信息 */
export interface ReferenceImageUrlInfo {
	/** low 档位展示 URL */
	lowUrl: string | undefined
	/** tooltip/popover 预览图 */
	fullUrl: string | undefined
	/** 图片信息 */
	imageInfo: ImageInfo | undefined
	/** 按需加载 tooltip 预览图的方法 */
	loadTooltip: () => Promise<void>
	/** 展示失败后强制换取原图地址，不清理图片内容缓存 */
	refreshFullUrl: () => Promise<string | undefined>
	/** 是否正在加载 low 档位 */
	isLoading: boolean
	/** 是否已确认加载失败 */
	hasError: boolean
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

// 计算预设尺寸，保持宽高比，最大不超过 tooltip 预览尺寸
function calculatePreviewSize(
	imageInfo: { naturalWidth: number; naturalHeight: number } | undefined,
): { width?: number; height?: number } {
	if (!imageInfo) {
		return {}
	}

	const maxSize = TOOLTIP_PREVIEW_MIN_SIZE
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

export interface UseReferenceImageUrlsOptions {
	/** 挂载后即拉取原图 URL（ossSrc），用于槽位内直接展示原图 */
	eagerFullUrl?: boolean
	/** 是否启用图片资源加载；非图片参考资源应关闭，避免误触发图片链路 */
	enabled?: boolean
}

/**
 * 从 ImageResourceManager 获取参考图 URL
 * @param path 图片路径
 */
export function useReferenceImageUrls(
	path: string,
	options?: UseReferenceImageUrlsOptions,
): ReferenceImageUrlInfo {
	const eagerFullUrl = options?.eagerFullUrl ?? false
	const enabled = options?.enabled ?? true
	const canvas = useOptionalCanvas()
	const [open, setOpen] = useState(false)
	const lowImageReleaseRef = useRef<(() => void) | null>(null)
	const lowImageRequestIdRef = useRef(0)
	const fullImageRequestIdRef = useRef(0)
	const fullImageRefreshRequestIdRef = useRef<number | null>(null)
	const [urlInfo, setUrlInfo] = useState<{
		lowUrl: string | undefined
		fullUrl: string | undefined
		imageInfo: ImageInfo | undefined
		hasError: boolean
		loadTooltip: () => Promise<void>
	}>({
		lowUrl: undefined,
		fullUrl: undefined,
		imageInfo: undefined,
		hasError: false,
		loadTooltip: () => Promise.resolve(),
	})

	const releaseLowImageUrl = useCallback(() => {
		lowImageReleaseRef.current?.()
		lowImageReleaseRef.current = null
	}, [])

	// 计算预览尺寸
	const previewSize = useMemo(() => calculatePreviewSize(urlInfo.imageInfo), [urlInfo.imageInfo])

	// 是否正在加载：eager 时 low 档位或原图任一可用即可结束 loading
	const isLoading =
		enabled &&
		(eagerFullUrl
			? !urlInfo.hasError && !urlInfo.lowUrl && !urlInfo.fullUrl
			: !urlInfo.hasError && !urlInfo.lowUrl)

	// 是否正在加载大图（当弹窗打开且 fullUrl 未加载时）
	const isFullUrlLoading = enabled && open && !urlInfo.hasError && !urlInfo.fullUrl

	// 按需加载 tooltip 预览图（直接使用 ossSrc）
	const loadFullUrl = useCallback(
		async (forceRefresh = false): Promise<string | undefined> => {
			if (!canvas || !enabled) return undefined
			// low 加载事件不能用普通换链覆盖正在恢复的原图请求。
			if (!forceRefresh && fullImageRefreshRequestIdRef.current !== null) return undefined

			const requestId = ++fullImageRequestIdRef.current
			if (forceRefresh) fullImageRefreshRequestIdRef.current = requestId
			const ossInfo = await canvas.imageResourceManager
				.ensureFreshOssInfo(path, { forceRefresh })
				.finally(() => {
					if (fullImageRefreshRequestIdRef.current === requestId) {
						fullImageRefreshRequestIdRef.current = null
					}
				})
			if (fullImageRequestIdRef.current !== requestId) return undefined
			const failureReason = canvas.imageResourceManager.getFailureReason(path)
			if (failureReason === "not-found") {
				lowImageRequestIdRef.current += 1
				releaseLowImageUrl()
				setUrlInfo((prev) => ({
					...prev,
					lowUrl: undefined,
					fullUrl: undefined,
					imageInfo: undefined,
					hasError: true,
				}))
				return undefined
			}

			setUrlInfo((prev) => {
				if (prev.fullUrl && !forceRefresh) {
					return prev
				}

				return {
					...prev,
					fullUrl: ossInfo?.ossSrc || undefined,
					hasError: !ossInfo?.ossSrc && !!failureReason,
				}
			})
			return ossInfo?.ossSrc || undefined
		},
		[canvas, enabled, path, releaseLowImageUrl],
	)

	const loadTooltip = useCallback(async () => {
		await loadFullUrl()
	}, [loadFullUrl])
	const refreshFullUrl = useCallback(() => loadFullUrl(true), [loadFullUrl])

	// 切换文件或画布、关闭消费者时，让之前的换链和 low 请求失效；共享缓存仍保留。
	useEffect(() => {
		return () => {
			fullImageRequestIdRef.current += 1
			fullImageRefreshRequestIdRef.current = null
			lowImageRequestIdRef.current += 1
		}
	}, [canvas, enabled, path])

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

	// 更新路径的展示 URL（明确请求 low 档位）
	const updatePathUrl = useCallback(async () => {
		if (!canvas || !enabled) return

		const requestId = lowImageRequestIdRef.current + 1
		lowImageRequestIdRef.current = requestId
		const lowImage = await canvas.imageResourceManager.getLowImageUrl(path)
		if (lowImageRequestIdRef.current !== requestId) {
			lowImage?.release()
			return
		}

		releaseLowImageUrl()
		lowImageReleaseRef.current = lowImage?.release ?? null

		const lowUrl = lowImage?.url
		const imageInfo = lowImage?.imageInfo
		const failureReason = canvas.imageResourceManager.getFailureReason(path)
		const isDeleted = failureReason === "not-found"

		setUrlInfo((prev) => {
			const newInfo = {
				lowUrl: lowUrl || undefined,
				fullUrl: isDeleted ? undefined : prev.fullUrl,
				imageInfo: isDeleted ? undefined : imageInfo || prev.imageInfo,
				hasError: !lowUrl && !!failureReason,
				loadTooltip,
			}

			// 只有当 URL 或 imageInfo 实际变化时才更新
			if (
				prev.lowUrl === newInfo.lowUrl &&
				prev.imageInfo === newInfo.imageInfo &&
				prev.hasError === newInfo.hasError
			) {
				return prev
			}

			return newInfo
		})
	}, [canvas, enabled, path, loadTooltip, releaseLowImageUrl])

	// 初始化 low 档位 URL
	useEffect(() => {
		if (!canvas || !enabled) {
			lowImageRequestIdRef.current += 1
			releaseLowImageUrl()
			setUrlInfo({
				lowUrl: undefined,
				fullUrl: undefined,
				imageInfo: undefined,
				hasError: false,
				loadTooltip: () => Promise.resolve(),
			})
			return
		}

		// 立即尝试更新一次 URL 映射（如果资源已缓存，可以立即显示）
		setUrlInfo({
			lowUrl: undefined,
			fullUrl: undefined,
			imageInfo: undefined,
			hasError: false,
			loadTooltip,
		})
		updatePathUrl()
	}, [canvas, enabled, path, loadTooltip, releaseLowImageUrl, updatePathUrl])

	useEffect(() => releaseLowImageUrl, [releaseLowImageUrl])

	// 槽位内直接展示原图：与 low 档位并行拉取 ossSrc
	useEffect(() => {
		if (!eagerFullUrl || !canvas || !enabled) return
		void loadTooltip()
	}, [canvas, enabled, path, eagerFullUrl, loadTooltip])

	// 监听图片资源加载完成事件，确保 ossSrc 可用后更新 tooltip URL
	useCanvasEventWithInstance(
		canvas,
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				if (!areCanvasHostResourceReferencesSame(canvas, path, data.path)) {
					return
				}
				// 如果弹窗已打开但 fullUrl 还未设置，尝试加载
				if ((open || eagerFullUrl) && !urlInfo.fullUrl) {
					loadTooltip()
				}
			},
			[canvas, enabled, path, loadTooltip, open, urlInfo.fullUrl, eagerFullUrl],
		),
	)

	useCanvasEventWithInstance(
		canvas,
		"resource:image:load-failed",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				if (!areCanvasHostResourceReferencesSame(canvas, path, data.path)) {
					return
				}

				if (data.reason === "not-found") {
					// A confirmed deletion invalidates every previously visible representation, including
					// object URLs created by an older persistent-cache restore.
					lowImageRequestIdRef.current += 1
					releaseLowImageUrl()
					setUrlInfo({
						lowUrl: undefined,
						fullUrl: undefined,
						imageInfo: undefined,
						hasError: true,
						loadTooltip,
					})
					return
				}

				setUrlInfo((prev) => {
					if (prev.lowUrl || prev.fullUrl) {
						return prev
					}

					return {
						...prev,
						hasError: true,
					}
				})
			},
			[canvas, enabled, path, loadTooltip, releaseLowImageUrl],
		),
	)

	// 监听资源加载完成事件，刷新 low 档位 URL
	useCanvasEventWithInstance(
		canvas,
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				if (!areCanvasHostResourceReferencesSame(canvas, path, data.path)) {
					return
				}
				updatePathUrl()
			},
			[canvas, enabled, path, updatePathUrl],
		),
	)

	// Cross-canvas copy / upload can mark a path pending until the attachment
	// snapshot catches up. Retry low-url fetch when that window closes.
	useCanvasEventWithInstance(
		canvas,
		"upload:resource-pending-change",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled || !path) return
				const matches = data.paths.some(
					(candidate) =>
						candidate === path ||
						areCanvasHostResourceReferencesSame(canvas, path, candidate),
				)
				if (!matches) return
				// Only refresh once the path leaves the pending window; add events are noisy.
				if (canvas.canvasFileUploadManager.isPendingResourcePath(path)) return
				setUrlInfo((prev) => ({
					...prev,
					hasError: false,
				}))
				void updatePathUrl()
			},
			[canvas, enabled, path, updatePathUrl],
		),
		[canvas, enabled, path, updatePathUrl],
	)

	useCanvasEventWithInstance(
		canvas,
		"resource:remote-load-deferral-released",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				const pathKey =
					canvas.canvasFileUploadManager.getRemoteResourceLoadDeferralKey(path)
				if (!pathKey || pathKey !== data.key) {
					return
				}

				setUrlInfo((prev) => ({
					...prev,
					hasError: false,
				}))
				void updatePathUrl()
				if (open || eagerFullUrl) {
					void loadTooltip()
				}
			},
			[canvas, enabled, path, updatePathUrl, open, eagerFullUrl, loadTooltip],
		),
		[canvas, enabled, path, updatePathUrl, open, eagerFullUrl, loadTooltip],
	)

	return {
		...urlInfo,
		loadTooltip,
		refreshFullUrl,
		isLoading,
		hasError: urlInfo.hasError,
		previewSize,
		isFullUrlLoading,
		open,
		setOpen,
		handleOpenChange,
	}
}
