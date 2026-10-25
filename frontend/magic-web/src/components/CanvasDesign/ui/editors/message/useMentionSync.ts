import { useCallback, useRef } from "react"
import type { Canvas } from "../../../runtime/core/Canvas"
import { ImageElement as ImageElementClass } from "../../../runtime/elements/image/ImageElement"
import { VideoElement as VideoElementClass } from "../../../runtime/elements/video/VideoElement"
import type { UploadFileResponse } from "../../../public/magic-types"
import type { MatchableMentionItem } from "./tiptap/contentUtils"
import {
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../runtime/shared/path/canvasResourcePath"
import type { MessageEditorMentionChangeContext } from "./MessageEditor"
import { reconcileMentionPathsWithPersistedReferences } from "./mentionPathReconciliation"
import { reconcileProtectedReferencePaths } from "./reference-assets/referenceBinding"

interface UseMentionSyncOptions {
	canvas: Canvas | null
	/** 中性命名：目标元素 id（图片/视频通用） */
	elementId: string
	matchableItems: MatchableMentionItem[]
	maxReferenceFiles?: number
	isReferenceFileLimitReached?: boolean
	syncFromElement: () => void
	/**
	 * 旧 DSL 里没有 prompt 占位符的 reference_images 会被标记为“保护引用”。
	 * 这些引用在当前编辑会话中不能因普通 prompt 编辑被隐式移除，
	 * 只有显式删除，或被用户重新写成 mention 后，才会转入 prompt 绑定生命周期。
	 */
	protectedReferencePaths?: string[]
	/**
	 * 为 true 时只把编辑器里的 @ 路径追加到元素参考列表，不因「未出现在 @ 里」而删除。
	 * 视频编辑器参考图由顶部槽位管理，与提示词解耦，需开启；图片编辑器默认双向同步。
	 */
	mentionSyncAddOnly?: boolean
}

/** Keep distinct resolver identities; never merge slots by file name. */
export function collectMentionPathsToAdd(
	reconciledPaths: string[],
	currentPathByIdentity: Map<string, string>,
	getResourceIdentity: (path?: string) => string,
): string[] {
	const pathsToAddIdentities = new Set<string>()
	return reconciledPaths.filter((path) => {
		const identity = getResourceIdentity(path)
		if (
			!identity ||
			currentPathByIdentity.has(identity) ||
			pathsToAddIdentities.has(identity)
		) {
			return false
		}
		pathsToAddIdentities.add(identity)
		return true
	})
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
		protectedReferencePaths = [],
		mentionSyncAddOnly = false,
	} = options

	const syncVersionRef = useRef(0)
	const previousPromptRef = useRef<{ elementId: string; prompt: string } | null>(null)

	const syncMentionPaths = useCallback(
		(paths: string[], currentPrompt: string, context: MessageEditorMentionChangeContext) => {
			const previousPrompt =
				previousPromptRef.current?.elementId === elementId
					? previousPromptRef.current.prompt
					: undefined
			previousPromptRef.current = { elementId, prompt: currentPrompt }
			if (!canvas) return
			const resolveResourceReference =
				canvas.magicConfigManager.config?.methods?.resolveResourceReference
			const getResourceIdentity = (path?: string) =>
				getCanvasResourceReferenceIdentity(path, resolveResourceReference)

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
			const effectiveProtectedReferencePaths = reconcileProtectedReferencePaths({
				referenceFileInfos: currentInfos,
				protectedReferencePaths,
				currentPrompt,
				previousPrompt,
				source: context.source,
				resolveResourceReference,
			})
			const reconciledPaths = reconcileMentionPathsWithPersistedReferences({
				incomingPaths: paths,
				persistedPaths: currentInfos.map((info) => info.path),
				source: context.source,
				resolveResourceReference,
			})
			const currentPathByIdentity = new Map(
				currentInfos.map((info) => [getResourceIdentity(info.path), info.path]),
			)
			const mentionedPathIdentities = new Set(reconciledPaths.map(getResourceIdentity))
			const protectedPathIdentities = new Set(
				effectiveProtectedReferencePaths.map(getResourceIdentity),
			)
			const findMatchableItem = (path: string) => {
				const identity = getResourceIdentity(path)
				return matchableItems.find((item) => getResourceIdentity(item.path) === identity)
			}

			let pathsToAdd = collectMentionPathsToAdd(
				reconciledPaths,
				currentPathByIdentity,
				getResourceIdentity,
			)
			const pathsToRemove = mentionSyncAddOnly
				? []
				: currentInfos
						.map((info) => info.path)
						.filter(
							(path) =>
								!mentionedPathIdentities.has(getResourceIdentity(path)) &&
								!protectedPathIdentities.has(getResourceIdentity(path)),
						)
			// 限制场景下过滤 pathsToAdd
			if (isReferenceFileLimitReached && maxReferenceFiles !== undefined) {
				const currentPathsArray = currentInfos.map((info) => info.path)
				pathsToAdd = pathsToAdd.filter((path) => {
					if (currentPathByIdentity.has(getResourceIdentity(path))) return true
					const matchableItem = findMatchableItem(path)
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
				const matchableItem = findMatchableItem(path)
				if (matchableItem && !matchableItem.disabled) {
					const newInfo: UploadFileResponse = {
						path: matchableItem.path || path,
						fileName: matchableItem.name,
						src: matchableItem.path || path,
					}
					elementInstance.saveReferenceImageInfo(newInfo)
				} else {
					const fileName = getCanvasResourceFileName(path) || path
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
			protectedReferencePaths,
			mentionSyncAddOnly,
		],
	)

	return { syncMentionPaths }
}
