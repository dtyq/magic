import { useEffect, useMemo, useRef } from "react"
import type { Extension } from "@tiptap/core"
import { useMagic } from "../../context/MagicContext"
import type { MatchableMentionItem } from "./tiptap/contentUtils"

interface UseMessageEditorMentionOptions {
	/** 可匹配的项列表（从 referenceImagesState 派生） */
	matchableItems?: MatchableMentionItem[]
	/** 最大参考图数量限制 */
	maxReferenceImages?: number
	/** 当前已选中的参考图路径列表 */
	currentReferenceImages?: string[]
	/** 是否已达到参考图数量限制 */
	isReferenceImageLimitReached?: boolean
}

/**
 * 复用 MessageEditor @ 面板所需数据：matchableItems、mentionDataService
 * 供 ImageMessageEditorRender、SecondEdit 等共用
 *
 * mentionDataService 仅依赖 imageFilesForMention 保持实例稳定，
 * limitInfo 通过 ref 存储，getter 调用时读取最新值，避免多实例竞态。
 */
export function useMessageEditorMention(options?: UseMessageEditorMentionOptions) {
	const {
		imageFilesForMention = [],
		mentionDataServiceCtor,
		mentionExtension: MentionExtensionClass,
		isLoadingImageModelList = false,
		imageModelList = [],
	} = useMagic()
	const {
		matchableItems: externalMatchableItems = [],
		maxReferenceImages,
		currentReferenceImages = [],
		isReferenceImageLimitReached = false,
	} = options || {}

	// 使用 ref 存储最新的限制信息，limitInfoGetter 调用时读取，确保始终获取最新值
	const limitInfoRef = useRef({
		maxReferenceImages,
		currentReferenceImages,
		isReferenceImageLimitReached,
		externalMatchableItems,
	})

	// 同步更新 ref（在 useMemo 之前执行）
	limitInfoRef.current = {
		maxReferenceImages,
		currentReferenceImages,
		isReferenceImageLimitReached,
		externalMatchableItems,
	}

	// 使用外部传入的构造函数创建实例，未传入时无 @ 功能
	const mentionDataService = useMemo(() => {
		if (!mentionDataServiceCtor) return undefined
		const service = new mentionDataServiceCtor(imageFilesForMention)
		if (service.setLimitInfoGetter) {
			service.setLimitInfoGetter(() => {
				const current = limitInfoRef.current
				return {
					maxReferenceImages: current.maxReferenceImages,
					currentReferenceImages: current.currentReferenceImages,
					isReferenceImageLimitReached: current.isReferenceImageLimitReached,
					referenceImageInfos: current.externalMatchableItems.map((item) => ({
						src: item.path || "",
						fileName: item.name,
						path: item.path || "",
					})),
				}
			})
		}
		return service
	}, [imageFilesForMention, mentionDataServiceCtor])

	// 参考图变化时请求面板刷新
	useEffect(() => {
		if (!mentionDataService?.requestRefresh) return
		queueMicrotask(() => {
			mentionDataService.requestRefresh?.()
		})
	}, [
		mentionDataService,
		externalMatchableItems,
		maxReferenceImages,
		currentReferenceImages,
		isReferenceImageLimitReached,
	])

	// 合并项目图片与当前元素参考图（去重，外部优先）
	const matchableItems = useMemo(() => {
		const itemMap = new Map<string, MatchableMentionItem>()

		imageFilesForMention.forEach((item) => {
			const key = item.path || item.name
			if (key) itemMap.set(key, { name: item.name, path: item.path })
		})

		externalMatchableItems.forEach((item) => {
			const key = item.path || item.name
			if (key) itemMap.set(key, item)
		})

		const result = Array.from(itemMap.values())

		if (isReferenceImageLimitReached && currentReferenceImages.length > 0) {
			const currentPathsSet = new Set(currentReferenceImages)
			return result.map((item) => {
				const isSelected = item.path && currentPathsSet.has(item.path)
				return { ...item, disabled: !isSelected }
			})
		}

		return result
	}, [
		imageFilesForMention,
		externalMatchableItems,
		isReferenceImageLimitReached,
		currentReferenceImages,
	])

	// 配置 MentionExtension，通过依赖注入实现组件隔离
	const mentionExtension = useMemo<Extension | null>(() => {
		if (!mentionDataService || !MentionExtensionClass) return null
		// MentionExtensionClass 是从外部传入的扩展类，使用类型断言
		const ExtensionClass = MentionExtensionClass as {
			configure: (options: {
				language: string
				getParentContainer: () => HTMLElement
				dataService: unknown
			}) => Extension
		}
		return ExtensionClass.configure({
			language: "zh-CN",
			getParentContainer: () => document.body,
			// 外部传入实例实现 DataService，断言以兼容 MentionPanel
			dataService: mentionDataService as never,
		})
	}, [mentionDataService, MentionExtensionClass])

	return {
		matchableItems,
		mentionDataService,
		mentionExtension,
		maxReferenceImages,
		currentReferenceImages,
		isReferenceImageLimitReached,
		mentionEnabled:
			!!mentionDataService &&
			!isLoadingImageModelList &&
			imageModelList.length > 0 &&
			(maxReferenceImages === undefined || maxReferenceImages > 0),
	}
}
