import { useCallback, useRef } from "react"
import type { Canvas } from "../../canvas/Canvas"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import type { UploadFileResponse } from "../../types.magic"
import type { MatchableMentionItem } from "./tiptap/contentUtils"

interface UseMentionSyncOptions {
	canvas: Canvas | null
	/** 中性命名：目标元素 id（图片/视频通用） */
	elementId: string
	matchableItems: MatchableMentionItem[]
	maxReferenceFiles?: number
	isReferenceFileLimitReached?: boolean
	syncFromElement: () => void
	/**
	 * 为 true 时只把编辑器里的 @ 路径追加到元素参考列表，不因「未出现在 @ 里」而删除。
	 * 视频编辑器参考图由顶部槽位管理，与提示词解耦，需开启；图片编辑器默认双向同步。
	 */
	mentionSyncAddOnly?: boolean
}

/**
 * 将编辑器中的 mention 路径同步到元素的参考文件列表的 hook
 *
 * 设计原则：
 * - 编辑器内容为权威来源，同步逻辑同步执行，无 rAF/setTimeout
 * - 版本号保护，防止异步竞态下过期更新覆盖最新结果
 */
export function useMentionSync(options: UseMentionSyncOptions) {
	const {
		canvas,
		elementId,
		matchableItems,
		maxReferenceFiles,
		isReferenceFileLimitReached = false,
		syncFromElement,
		mentionSyncAddOnly = false,
	} = options

	const syncVersionRef = useRef(0)

	const syncMentionPaths = useCallback(
		(paths: string[], currentPrompt: string) => {
			if (!canvas) return

			// 保护：paths 为空但 currentPrompt 中仍有 @ 时，可能是 @ 尚未解析为 mention 节点，不执行
			if (paths.length === 0 && /@/.test(currentPrompt)) {
				return
			}

			const elementInstance = canvas.elementManager.getElementInstance(elementId)
			if (
				!(
					elementInstance instanceof ImageElementClass ||
					elementInstance instanceof VideoElementClass
				)
			) {
				return
			}

			const currentInfos = elementInstance.getReferenceImageInfos()
			const currentPaths = new Set(currentInfos.map((info) => info.path))
			const pathsSet = new Set(paths)

			let pathsToAdd = paths.filter((path) => path && !currentPaths.has(path))
			const pathsToRemove = mentionSyncAddOnly
				? []
				: Array.from(currentPaths).filter((path) => !pathsSet.has(path))

			// 限制场景下过滤 pathsToAdd
			if (isReferenceFileLimitReached && maxReferenceFiles !== undefined) {
				const currentPathsArray = Array.from(currentPaths)
				pathsToAdd = pathsToAdd.filter((path) => {
					if (currentPathsArray.includes(path)) return true
					const matchableItem = matchableItems.find((item) => item.path === path)
					if (matchableItem?.disabled) return false
					const currentCount = currentPathsArray.length - pathsToRemove.length
					if (currentCount >= maxReferenceFiles) return false
					return true
				})
			}

			if (pathsToAdd.length === 0 && pathsToRemove.length === 0) return

			// 版本号保护：标记本次同步
			const version = ++syncVersionRef.current

			// 同步更新 Element（无异步边界）
			pathsToRemove.forEach((path) => {
				elementInstance.removeReferenceImageInfo(path)
			})

			pathsToAdd.forEach((path) => {
				const matchableItem = matchableItems.find((item) => item.path === path)
				if (matchableItem && !matchableItem.disabled) {
					const newInfo: UploadFileResponse = {
						path: matchableItem.path || path,
						fileName: matchableItem.name,
						src: matchableItem.path || path,
					}
					elementInstance.saveReferenceImageInfo(newInfo)
				} else {
					const fileName = path.split("/").pop() || path
					elementInstance.saveReferenceImageInfo({
						path,
						fileName,
						src: path,
					})
				}
			})

			// 同步从 Element 拉取到 React state
			syncFromElement()

			// 版本校验：若后续有更新，忽略本次异步收尾
			queueMicrotask(() => {
				if (version !== syncVersionRef.current) return
				// 可在此做额外收尾，当前无需求
			})
		},
		[
			canvas,
			elementId,
			matchableItems,
			maxReferenceFiles,
			isReferenceFileLimitReached,
			syncFromElement,
			mentionSyncAddOnly,
		],
	)

	return { syncMentionPaths }
}
