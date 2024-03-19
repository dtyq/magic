import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import type { UploadImageResponse } from "../../types.magic"
import type { Canvas } from "../../canvas/Canvas"
import type { MatchableMentionItem } from "./tiptap/contentUtils"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"

interface UseReferenceImagesStateOptions {
	/** Canvas 实例，用于请求 Resource */
	canvas: Canvas | null
	/** ImageElement ID，用于同步 Element 存储 */
	imageElementId: string
	/** 最大参考图数量限制 */
	maxReferenceImages?: number
	/** 受保护的参考图索引（不能删除） */
	protectedReferenceImageIndex?: number
}

/**
 * 管理参考图状态的 hook
 *
 * 数据流向：
 * 1. ImageElement.referenceImageInfos (持久化存储)
 * 2. → referenceImages (paths, 单一数据源)
 * 3. → referenceImageInfos (派生，包含 Resource 信息)
 * 4. → matchableItems (派生，供 TipTap 渲染)
 */
export function useReferenceImagesState(options: UseReferenceImagesStateOptions) {
	const { canvas, imageElementId, maxReferenceImages, protectedReferenceImageIndex } = options

	// 核心状态：参考图路径列表（单一数据源）
	const [referenceImages, setReferenceImages] = useState<string[]>([])

	// 派生状态：参考图详细信息（从 Element 存储 + ResourceManager 派生）
	const [referenceImageInfos, setReferenceImageInfos] = useState<UploadImageResponse[]>([])

	// 检查是否已达到参考图数量限制
	const isReferenceImageLimitReached = useMemo(() => {
		if (maxReferenceImages === undefined) {
			return false
		}
		return referenceImages.length >= maxReferenceImages
	}, [referenceImages.length, maxReferenceImages])

	// 从 paths 派生 matchableItems（供 TipTap 渲染使用）
	const matchableItems = useMemo<MatchableMentionItem[]>(() => {
		const items = referenceImageInfos.map((info) => ({
			name: info.fileName,
			path: info.path,
		}))
		return items
	}, [referenceImageInfos])

	// 标记：是否正在从 Element 同步（避免循环更新）
	const isSyncingFromElementRef = useRef(false)

	// 根据 paths 请求 Resource 并更新 infos
	// 这是核心的 Resource 请求入口：只为 referenceImages 中的 paths 请求 Resource
	const syncResourceInfos = useCallback(
		async (paths: string[]) => {
			if (!canvas) return

			const infos: UploadImageResponse[] = []

			// 并行请求所有 Resource（提升性能）
			const resourcePromises = paths.map((path) =>
				canvas.imageResourceManager.getResource(path).then((resource) => ({
					path,
					resource,
				})),
			)

			const results = await Promise.all(resourcePromises)

			for (const { path, resource } of results) {
				const ossSrc = resource?.ossSrc ?? path
				const fileName = path.split("/").pop() || path

				infos.push({
					path,
					src: ossSrc,
					fileName,
				})
			}

			setReferenceImageInfos(infos)
		},
		[canvas],
	)

	// 从 Element 同步参考图信息到本地状态
	const syncFromElement = useCallback(() => {
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElementId)
		if (!(elementInstance instanceof ImageElementClass)) return

		const infos = elementInstance.getReferenceImageInfos()
		const paths = infos.map((info) => info.path)

		// 标记正在同步，避免触发 useEffect 回写到 Element
		isSyncingFromElementRef.current = true
		setReferenceImages(paths)
		// 先设置 infos（即使没有 Resource 信息），确保 matchableItems 立即更新
		setReferenceImageInfos(infos)

		// 异步同步 Resource 信息（更新 src 等）
		syncResourceInfos(paths).finally(() => {
			// 重置标记
			queueMicrotask(() => {
				isSyncingFromElementRef.current = false
			})
		})
	}, [canvas, imageElementId, syncResourceInfos])

	// 初始化：从 Element 同步
	useEffect(() => {
		syncFromElement()
	}, [syncFromElement])

	// 当 referenceImages 变化时，同步到 Element 并更新 Resource 信息
	useEffect(() => {
		// 如果正在从 Element 同步，跳过（避免循环）
		if (isSyncingFromElementRef.current) return
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElementId)
		if (!(elementInstance instanceof ImageElementClass)) return

		// 获取当前 Element 中的 infos
		const currentInfos = elementInstance.getReferenceImageInfos()
		const currentPaths = currentInfos.map((info) => info.path)

		// 如果 paths 完全一致，只需要同步 Resource 信息（不修改 Element）
		const pathsEqual =
			referenceImages.length === currentPaths.length &&
			referenceImages.every((path, index) => path === currentPaths[index])

		if (pathsEqual) {
			// 只同步 Resource 信息
			syncResourceInfos(referenceImages)
			return
		}

		// paths 不一致，需要更新 Element
		// 1. 移除不在新列表中的项
		const pathsSet = new Set(referenceImages)
		const pathsToRemove = currentPaths.filter((path) => !pathsSet.has(path))
		pathsToRemove.forEach((path) => {
			elementInstance.removeReferenceImageInfo(path)
		})

		// 2. 添加新项并重新排序
		// 构建 path -> info 映射
		const pathToInfo = new Map(currentInfos.map((info) => [info.path, info]))

		// 按照 referenceImages 的顺序构建新的 infos 列表
		const reorderedInfos: UploadImageResponse[] = []
		for (const path of referenceImages) {
			const existingInfo = pathToInfo.get(path)
			if (existingInfo) {
				// 已存在的项，保留原信息
				reorderedInfos.push(existingInfo)
			} else {
				// 新增的项，创建基本信息
				const fileName = path.split("/").pop() || path
				reorderedInfos.push({
					path,
					src: path, // 先用 path，Resource 加载后会更新
					fileName,
				})
			}
		}

		// 完全替换 Element 中的 referenceImageInfos
		elementInstance.setReferenceImageInfos(reorderedInfos)

		// 4. 同步 Resource 信息
		syncResourceInfos(referenceImages)
	}, [canvas, imageElementId, referenceImages, syncResourceInfos])

	// 添加参考图
	const addReferenceImage = useCallback(
		(path: string) => {
			setReferenceImages((prev) => {
				// 去重
				if (prev.includes(path)) return prev
				// 检查数量限制
				if (maxReferenceImages !== undefined && prev.length >= maxReferenceImages) {
					return prev
				}
				return [...prev, path]
			})
		},
		[maxReferenceImages],
	)

	// 批量添加参考图
	const addReferenceImages = useCallback(
		(infos: UploadImageResponse[]) => {
			setReferenceImages((prev) => {
				const existingPaths = new Set(prev)
				const newPaths = infos
					.map((info) => info.path)
					.filter((path) => !existingPaths.has(path))

				// 检查数量限制
				if (maxReferenceImages !== undefined) {
					const availableSlots = maxReferenceImages - prev.length
					if (availableSlots <= 0) return prev
					return [...prev, ...newPaths.slice(0, availableSlots)]
				}

				return [...prev, ...newPaths]
			})
		},
		[maxReferenceImages],
	)

	// 移除参考图
	const removeReferenceImage = useCallback(
		(path: string) => {
			// 检查是否是受保护的参考图
			if (protectedReferenceImageIndex !== undefined) {
				const index = referenceImages.indexOf(path)
				if (index === protectedReferenceImageIndex) {
					return // 不能删除受保护的参考图
				}
			}

			setReferenceImages((prev) => prev.filter((p) => p !== path))
		},
		[protectedReferenceImageIndex, referenceImages],
	)

	// 清空所有参考图
	const clearReferenceImages = useCallback(() => {
		setReferenceImages([])
	}, [])

	// 设置参考图列表（完全替换）
	const setReferenceImagesList = useCallback((paths: string[]) => {
		setReferenceImages(paths)
	}, [])

	// 确保指定路径在第一个位置
	const ensureFirstPosition = useCallback((path: string) => {
		setReferenceImages((prev) => {
			// 如果已经在第一个位置，不变
			if (prev[0] === path) return prev

			// 移除旧位置，添加到第一个
			const filtered = prev.filter((p) => p !== path)
			return [path, ...filtered]
		})
	}, [])

	return {
		// 核心数据（单一数据源）
		referenceImages,

		// 派生数据
		referenceImageInfos,
		matchableItems,
		isReferenceImageLimitReached,

		// 操作方法
		addReferenceImage,
		addReferenceImages,
		removeReferenceImage,
		clearReferenceImages,
		setReferenceImagesList,
		ensureFirstPosition,
		syncFromElement,
	}
}
