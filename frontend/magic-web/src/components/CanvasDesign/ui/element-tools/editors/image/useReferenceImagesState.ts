import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import type { UploadFileResponse } from "../../../../public/magic-types"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { MatchableMentionItem } from "../../../editors/message/tiptap/contentUtils"
import { ImageElement as ImageElementClass } from "../../../../runtime/elements/image/ImageElement"
import { VideoElement as VideoElementClass } from "../../../../runtime/elements/video/VideoElement"
import type { ReferenceResourceFileInfo } from "../../../editors/message/reference-assets/reference-resource.types"
import {
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../../runtime/shared/path/canvasResourcePath"

interface UseReferenceImagesStateOptions {
	/** 只读查看已提交参数时，仅更新当前面板，不回写元素的参考图列表。 */
	readOnlyPaths?: readonly string[]
	/** Canvas 实例，用于请求 Resource */
	canvas: Canvas | null
	/** ImageElement ID，用于同步 Element 存储 */
	imageElementId: string
	/** 最大参考文件数量限制 */
	maxReferenceFiles?: number
}

type ResourceIdentityResolver = (path?: string) => string

function isSamePaths(
	prev: string[],
	next: string[],
	getResourceIdentity: ResourceIdentityResolver,
): boolean {
	if (prev === next) return true
	if (prev.length !== next.length) return false
	for (let i = 0; i < prev.length; i += 1) {
		if (getResourceIdentity(prev[i]) !== getResourceIdentity(next[i])) return false
	}
	return true
}

function dedupePathsByIdentity(
	paths: string[],
	getResourceIdentity: ResourceIdentityResolver,
): string[] {
	const result: string[] = []
	const identities = new Set<string>()
	for (const path of paths) {
		const identity = getResourceIdentity(path)
		if (!identity || identities.has(identity)) continue
		identities.add(identity)
		result.push(path)
	}
	return result
}

function isSameReferenceInfos(
	prev: ReferenceResourceFileInfo[],
	next: ReferenceResourceFileInfo[],
	getResourceIdentity: ResourceIdentityResolver,
): boolean {
	if (prev === next) return true
	if (prev.length !== next.length) return false
	for (let i = 0; i < prev.length; i += 1) {
		if (getResourceIdentity(prev[i]?.path) !== getResourceIdentity(next[i]?.path)) {
			return false
		}
		if ((prev[i]?.src || "") !== (next[i]?.src || "")) return false
		if ((prev[i]?.fileName || "") !== (next[i]?.fileName || "")) return false
	}
	return true
}

/**
 * 管理参考文件状态的 hook
 *
 * 数据流向：
 * 1. ImageElement.referenceImageInfos (持久化存储)
 * 2. → referenceFilePaths (paths, 单一数据源)
 * 3. → referenceFileInfos (派生，包含 Resource 信息)
 * 4. → matchableItems (派生，供 TipTap 渲染)
 */
export function useReferenceImagesState(options: UseReferenceImagesStateOptions) {
	const { canvas, imageElementId, maxReferenceFiles, readOnlyPaths } = options
	const resolveResourceReference =
		canvas?.magicConfigManager.config?.methods?.resolveResourceReference
	const getResourceIdentity = useCallback(
		(path?: string) => getCanvasResourceReferenceIdentity(path, resolveResourceReference),
		[resolveResourceReference],
	)

	// 核心状态：参考文件路径列表（单一数据源）
	const [referenceFilePaths, setReferenceFilePaths] = useState<string[]>([])

	// 派生状态：参考文件详细信息（从 Element 存储 + ResourceManager 派生）
	const [referenceFileInfos, setReferenceFileInfos] = useState<ReferenceResourceFileInfo[]>([])

	// 检查是否已达到参考文件数量限制
	const isReferenceFileLimitReached = useMemo(() => {
		if (maxReferenceFiles === undefined) {
			return false
		}
		return referenceFilePaths.length >= maxReferenceFiles
	}, [referenceFilePaths.length, maxReferenceFiles])

	// 从 paths 派生 matchableItems（供 TipTap 渲染使用）
	const matchableItems = useMemo<MatchableMentionItem[]>(() => {
		const items = referenceFileInfos.map((info) => ({
			name: info.fileName,
			path: info.path,
			source: "element-reference" as const,
		}))
		return items
	}, [referenceFileInfos])

	// 标记：是否正在从 Element 同步（避免循环更新）
	const isSyncingFromElementRef = useRef(false)

	// 根据 paths 请求 Resource 并更新 infos
	// 这是核心的 Resource 请求入口：只为参考文件 paths 请求 Resource
	const syncResourceInfos = useCallback(
		async (fileInfos: Array<Pick<UploadFileResponse, "path">>) => {
			if (!canvas) return

			const infos: ReferenceResourceFileInfo[] = []

			// 并行换取所有 OSS URL（只需要链接，不触发图片解码）
			const resourcePromises = fileInfos.map((info) =>
				canvas.imageResourceManager.ensureFreshOssInfo(info.path).then((ossInfo) => ({
					info,
					ossInfo,
				})),
			)

			const results = await Promise.all(resourcePromises)

			for (const { info, ossInfo } of results) {
				const ossSrc = ossInfo?.ossSrc ?? info.path
				const fileName = getCanvasResourceFileName(info.path) || info.path

				infos.push({
					path: info.path,
					src: ossSrc,
					fileName,
				})
			}

			setReferenceFileInfos((prev) => {
				if (isSameReferenceInfos(prev, infos, getResourceIdentity)) {
					return prev
				}
				return infos
			})
		},
		[canvas, getResourceIdentity],
	)

	// 从 Element 同步参考图信息到本地状态
	const syncFromElement = useCallback(() => {
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElementId)
		if (!(
			elementInstance instanceof ImageElementClass ||
			elementInstance instanceof VideoElementClass
		)) {
			return
		}

		const infos: ReferenceResourceFileInfo[] = readOnlyPaths
			? readOnlyPaths.map((path) => ({
					path,
					src: path,
					fileName: getCanvasResourceFileName(path) || path,
				}))
			: (elementInstance.getReferenceImageInfos() as ReferenceResourceFileInfo[])
		const paths = infos.map((info) => info.path)

		// 标记正在同步，避免触发 useEffect 回写到 Element
		isSyncingFromElementRef.current = true
		setReferenceFilePaths((prev) => {
			if (isSamePaths(prev, paths, getResourceIdentity)) {
				return prev
			}
			return paths
		})
		// 先设置 infos（即使没有 Resource 信息），确保 matchableItems 立即更新
		setReferenceFileInfos((prev) => {
			if (isSameReferenceInfos(prev, infos, getResourceIdentity)) {
				return prev
			}
			return infos
		})

		// 异步同步 Resource 信息（更新 src 等）
		syncResourceInfos(infos).finally(() => {
			// 重置标记
			queueMicrotask(() => {
				isSyncingFromElementRef.current = false
			})
		})
	}, [canvas, getResourceIdentity, imageElementId, syncResourceInfos, readOnlyPaths])

	// 初始化：从 Element 同步
	useEffect(() => {
		syncFromElement()
	}, [syncFromElement])

	// 当 referenceFilePaths 变化时，同步到 Element 并更新 Resource 信息
	useEffect(() => {
		if (readOnlyPaths !== undefined) return
		// 如果正在从 Element 同步，跳过（避免循环）
		if (isSyncingFromElementRef.current) return
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElementId)
		if (!(
			elementInstance instanceof ImageElementClass ||
			elementInstance instanceof VideoElementClass
		)) {
			return
		}

		// 获取当前 Element 中的 infos
		const currentInfos = elementInstance.getReferenceImageInfos()
		const currentPaths = currentInfos.map((info) => info.path)

		// 如果 paths 完全一致，只需要同步 Resource 信息（不修改 Element）
		const pathsEqual = isSamePaths(referenceFilePaths, currentPaths, getResourceIdentity)

		if (pathsEqual) {
			// 只同步 Resource 信息
			syncResourceInfos(currentInfos)
			return
		}

		// paths 不一致，需要更新 Element
		// 1. 移除不在新列表中的项
		const pathIdentities = new Set(referenceFilePaths.map(getResourceIdentity))
		const pathsToRemove = currentPaths.filter(
			(path) => !pathIdentities.has(getResourceIdentity(path)),
		)
		pathsToRemove.forEach((path) => {
			elementInstance.removeReferenceImageInfo(path)
		})

		// 2. 添加新项并重新排序
		// 构建 path -> info 映射
		const pathToInfo = new Map(
			currentInfos.map((info) => [getResourceIdentity(info.path), info]),
		)

		// 按照 referenceFilePaths 的顺序构建新的 infos 列表
		const reorderedInfos: UploadFileResponse[] = []
		for (const path of referenceFilePaths) {
			const existingInfo = pathToInfo.get(getResourceIdentity(path))
			if (existingInfo) {
				// 已存在的项，保留原信息
				reorderedInfos.push(existingInfo)
			} else {
				// 新增的项，创建基本信息
				const fileName = getCanvasResourceFileName(path) || path
				reorderedInfos.push({
					path,
					src: path, // 先用 path，Resource 加载后会更新
					fileName,
				})
			}
		}

		// 完全替换 Element 中存储的参考文件 infos
		elementInstance.setReferenceImageInfos(reorderedInfos)

		// 4. 同步 Resource 信息
		syncResourceInfos(reorderedInfos)
	}, [
		canvas,
		getResourceIdentity,
		imageElementId,
		referenceFilePaths,
		syncResourceInfos,
		readOnlyPaths,
	])

	// 添加参考文件
	const addReferenceFile = useCallback(
		(path: string) => {
			setReferenceFilePaths((prev) => {
				// 去重
				const identity = getResourceIdentity(path)
				if (!identity || prev.some((item) => getResourceIdentity(item) === identity)) {
					return prev
				}
				// 检查数量限制
				if (maxReferenceFiles !== undefined && prev.length >= maxReferenceFiles) {
					return prev
				}
				return [...prev, path]
			})
		},
		[getResourceIdentity, maxReferenceFiles],
	)

	// 批量添加参考文件
	const addReferenceFiles = useCallback(
		(infos: UploadFileResponse[]) => {
			setReferenceFilePaths((prev) => {
				const existingPathIdentities = new Set(prev.map(getResourceIdentity))
				const newPaths = infos
					.map((info) => info.path)
					.filter((path) => {
						const identity = getResourceIdentity(path)
						if (!identity || existingPathIdentities.has(identity)) return false
						existingPathIdentities.add(identity)
						return true
					})

				// 检查数量限制
				if (maxReferenceFiles !== undefined) {
					const availableSlots = maxReferenceFiles - prev.length
					if (availableSlots <= 0) return prev
					return [...prev, ...newPaths.slice(0, availableSlots)]
				}

				return [...prev, ...newPaths]
			})
		},
		[getResourceIdentity, maxReferenceFiles],
	)

	// 移除参考文件
	const removeReferenceFile = useCallback(
		(path: string) => {
			const identity = getResourceIdentity(path)
			setReferenceFilePaths((prev) =>
				prev.filter((item) => getResourceIdentity(item) !== identity),
			)
		},
		[getResourceIdentity],
	)

	// 清空所有参考文件
	const clearReferenceFiles = useCallback(() => {
		setReferenceFilePaths([])
	}, [])

	// 设置参考文件列表（完全替换）
	const setReferenceFilePathsList = useCallback(
		(paths: string[]) => {
			setReferenceFilePaths(dedupePathsByIdentity(paths, getResourceIdentity))
		},
		[getResourceIdentity],
	)

	// 确保指定路径在第一个位置
	const ensureFirstPosition = useCallback(
		(path: string) => {
			setReferenceFilePaths((prev) => {
				const identity = getResourceIdentity(path)
				if (!identity) return prev
				// 如果已经在第一个位置，不变
				if (getResourceIdentity(prev[0]) === identity) return prev

				// 移除旧位置，添加到第一个
				const filtered = prev.filter((item) => getResourceIdentity(item) !== identity)
				return [path, ...filtered]
			})
		},
		[getResourceIdentity],
	)

	return {
		// 核心数据（单一数据源）
		referenceFilePaths,

		// 派生数据
		referenceFileInfos,
		matchableItems,
		isReferenceFileLimitReached,

		// 操作方法
		addReferenceFile,
		addReferenceFiles,
		removeReferenceFile,
		clearReferenceFiles,
		setReferenceFilePathsList,
		ensureFirstPosition,
		syncFromElement,
	}
}
