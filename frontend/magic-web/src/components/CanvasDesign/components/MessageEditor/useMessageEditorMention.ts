import { createElement, useEffect, useMemo, useRef } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useMagic } from "../../context/MagicContext"
import type {
	CanvasMentionAttributes,
	CanvasMentionExtensionRuntimeOptions,
	CanvasMentionNodeViewRenderer,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelFileData,
	ReferenceResourcePanelLimitInfo,
} from "../../types"
import { MENTION_CARET_GUARD_TEXT, type MatchableMentionItem } from "./tiptap/contentUtils"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceType,
} from "./reference-assets/reference-resource.types"
import {
	isReferenceResourceTypeAllowed,
	isReferenceSelectionLimitBlocked,
	classifyReferenceAssetFile,
	isReferenceAssetTypeCapacityBlocked,
} from "./reference-assets/referenceResourceSelection"

const PROJECT_FILE_MENTION_ITEM_TYPE = "project_file"
const FOLDER_MENTION_ITEM_TYPE = "project_directory"
const MENTION_PANEL_DEFAULT_STATE = "default" as const
const MENTION_PANEL_FOLDER_STATE = "directory" as const
const mentionPanelCatalogBehavior = {
	shouldEnterFolderDirectly: ({
		selectedItem,
		enterFolder,
	}: {
		selectedItem: MentionSelectableItem
		enterFolder: boolean
	}) => {
		return (
			!enterFolder &&
			selectedItem.type === FOLDER_MENTION_ITEM_TYPE &&
			selectedItem.isFolder === true
		)
	},
	getDynamicTransition: ({
		selectedItem,
		enterFolder,
	}: {
		selectedItem: MentionSelectableItem
		enterFolder: boolean
	}) => {
		if (selectedItem.type !== FOLDER_MENTION_ITEM_TYPE) return null
		if (!enterFolder || selectedItem.isFolder !== true) return null
		return {
			state: MENTION_PANEL_FOLDER_STATE,
		}
	},
}

interface MentionSelectableItem {
	type?: string
	isFolder?: boolean
}

interface UseMessageEditorMentionOptions {
	/** 可匹配的项列表（从 referenceImagesState 派生） */
	matchableItems?: MatchableMentionItem[]
	/** 外部显式控制 @ 功能可用性；不传时使用默认模型就绪判定 */
	mentionEnabledOverride?: boolean
	/** 最大参考文件数量限制 */
	maxReferenceFiles?: number
	/** 当前已选中的参考文件路径列表 */
	currentReferenceFiles?: string[]
	/** 是否已达到参考文件数量限制 */
	isReferenceFileLimitReached?: boolean
	/** 当前资源选择器允许的文件类型 */
	referenceResourceType?: ReferenceResourceType
	/** 按类型细分的限制对象（视频编辑器场景传入，可覆盖总数判断） */
	assetLimits?: ReferenceAssetPerTypeLimits
	/** 当前已选各类型资源数量（与 assetLimits 配套使用） */
	currentAssetCounts?: ReferenceAssetTypeCounts
}

/**
 * 复用 MessageEditor @ 面板所需数据：matchableItems、mentionDataService
 * 供图片与视频编辑器共用
 *
 * mentionDataService 实例仅随 ctor 变化；附件树通过 syncProjectAttachmentRoots 同步，
 * limitInfo 通过 ref 存储，getter 调用时读取最新值，避免重建 TipTap Mention 扩展导致失焦。
 */
export function useMessageEditorMention(options?: UseMessageEditorMentionOptions) {
	const {
		projectAttachmentMentionTree = [],
		defaultProjectAttachmentFolderId,
		defaultProjectAttachmentFolderName,
		mentionDataServiceCtor,
		mentionExtension: MentionExtensionClass,
		methods,
		isLoadingImageModelList = false,
		imageModelList = [],
	} = useMagic()
	const { t: canvasT } = useCanvasDesignI18n()
	const projectFilesPathPrefix = canvasT("referenceAssets.projectFilesRoot", "当前项目文件")
	const {
		matchableItems: externalMatchableItems = [],
		mentionEnabledOverride,
		maxReferenceFiles,
		currentReferenceFiles = [],
		isReferenceFileLimitReached = false,
		referenceResourceType = "image",
		assetLimits,
		currentAssetCounts,
	} = options || {}

	// 附件树实时快照；新建 service 读一次，后续靠 sync 更新实例内数据
	const attachmentTreeRef = useRef(projectAttachmentMentionTree ?? [])
	attachmentTreeRef.current = projectAttachmentMentionTree ?? []

	// nodeView 与初始面板配置通过 ref 读取，避免因宿主回传新引用而重建 mentionExtension
	const locateProjectFileRef = useRef(methods?.locateProjectFile)
	locateProjectFileRef.current = methods?.locateProjectFile
	const initialMentionPanelLoadOptionsRef = useRef<{ itemId: string } | undefined>(undefined)
	if (!initialMentionPanelLoadOptionsRef.current && defaultProjectAttachmentFolderId) {
		initialMentionPanelLoadOptionsRef.current = {
			itemId: defaultProjectAttachmentFolderId,
		}
	}
	const initialMentionPanelNavigationStackRef = useRef<
		Array<{ id: string; name: string; state: typeof MENTION_PANEL_DEFAULT_STATE }> | undefined
	>(undefined)
	if (
		!initialMentionPanelNavigationStackRef.current &&
		defaultProjectAttachmentFolderId &&
		defaultProjectAttachmentFolderName
	) {
		initialMentionPanelNavigationStackRef.current = [
			{
				id: defaultProjectAttachmentFolderId,
				name: defaultProjectAttachmentFolderName,
				state: MENTION_PANEL_DEFAULT_STATE,
			},
		]
	}

	// 使用 ref 存储最新的限制信息，limitInfoGetter 调用时读取，确保始终获取最新值
	const limitInfoRef = useRef<
		ReferenceResourcePanelLimitInfo & {
			externalMatchableItems: MatchableMentionItem[]
		}
	>({
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos: externalMatchableItems.map((item) => ({
			src: item.path || "",
			fileName: item.name,
			path: item.path || "",
		})),
		externalMatchableItems,
		projectFilesPathPrefix,
		mentionFileSubtitleParentPrefix: defaultProjectAttachmentFolderName?.trim() || undefined,
	})

	// 同步更新 ref（在 useMemo 之前执行）
	limitInfoRef.current = {
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos: externalMatchableItems.map((item) => ({
			src: item.path || "",
			fileName: item.name,
			path: item.path || "",
		})),
		externalMatchableItems,
		projectFilesPathPrefix,
		mentionFileSubtitleParentPrefix: defaultProjectAttachmentFolderName?.trim() || undefined,
	}

	// 仅 ctor 变时新建；附件树更新见下方 sync + requestRefresh
	const mentionDataService = useMemo(() => {
		if (!mentionDataServiceCtor) return undefined
		const service = new mentionDataServiceCtor(attachmentTreeRef.current)
		if (service.setLimitInfoGetter) {
			service.setLimitInfoGetter(() => {
				const current = limitInfoRef.current
				return {
					maxReferenceFiles: current.maxReferenceFiles,
					currentReferenceFiles: current.currentReferenceFiles,
					isReferenceFileLimitReached: current.isReferenceFileLimitReached,
					referenceResourceType: current.referenceResourceType,
					referenceFileInfos: current.referenceFileInfos,
					projectFilesPathPrefix: current.projectFilesPathPrefix,
					mentionFileSubtitleParentPrefix: current.mentionFileSubtitleParentPrefix,
				}
			})
		}
		return service
	}, [mentionDataServiceCtor])

	// 树变只 sync 内存，不 new service，避免 mentionExtension 变导致编辑器重建
	useEffect(() => {
		mentionDataService?.syncProjectAttachmentRoots?.(projectAttachmentMentionTree ?? [])
	}, [mentionDataService, projectAttachmentMentionTree])

	// 参考文件变化时请求面板刷新
	useEffect(() => {
		if (!mentionDataService?.requestRefresh) return
		queueMicrotask(() => {
			mentionDataService.requestRefresh?.()
		})
	}, [
		mentionDataService,
		externalMatchableItems,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		projectFilesPathPrefix,
		defaultProjectAttachmentFolderName,
	])

	// 合并项目文件与当前元素参考文件（去重，外部优先）
	const matchableItems = useMemo(() => {
		const result: MatchableMentionItem[] = []
		const seenPaths = new Set<string>()

		const pushItem = (item: MatchableMentionItem) => {
			if (item.path) {
				if (seenPaths.has(item.path)) return
				seenPaths.add(item.path)
			}
			result.push(item)
		}

		// 优先放入当前元素参考文件，确保同名文件在 string -> mention 解析时优先命中当前上下文路径。
		externalMatchableItems.forEach((item) => {
			pushItem(item)
		})

		for (const item of flattenProjectAttachmentFiles(projectAttachmentMentionTree)) {
			pushItem({
				name: item.name,
				path: item.path,
				disabled: !isReferenceResourceTypeAllowed({
					fileName: item.name,
					filePath: item.path,
					referenceResourceType,
				}),
			})
		}

		return result.map((item) => ({
			...item,
			disabled:
				Boolean(item.disabled) ||
				(assetLimits && currentAssetCounts
					? isReferenceAssetTypeCapacityBlocked({
							fileClass: classifyReferenceAssetFile({
								filePath: item.path,
								fileName: item.name,
							}),
							assetLimits,
							currentAssetCounts,
							candidatePaths: [item.path, item.name],
							currentReferenceFiles,
						})
					: isReferenceSelectionLimitBlocked({
							candidatePaths: [item.path, item.name],
							currentReferenceFiles,
							isReferenceFileLimitReached,
						})),
		}))
	}, [
		projectAttachmentMentionTree,
		externalMatchableItems,
		isReferenceFileLimitReached,
		currentReferenceFiles,
		referenceResourceType,
		assetLimits,
		currentAssetCounts,
	])

	const mentionNodeViewRenderers = useMemo(() => {
		const projectFileRenderer: CanvasMentionNodeViewRenderer = (props) => {
			const attrs = props.node.attrs as CanvasMentionAttributes & {
				data?: ReferenceResourcePanelFileData
			}
			const fileData = attrs.data
			const options = props.extension.options as CanvasMentionExtensionRuntimeOptions
			const displayText = getProjectFileMentionDisplayText(attrs, options)

			return createElement(
				NodeViewWrapper,
				{
					as: "span",
					className: "magic-mention canvas-project-file-mention",
					"data-mention-suggestion-char": attrs.mentionSuggestionChar || "@",
					"data-type": attrs.type,
					"data-data": JSON.stringify(attrs.data || {}),
					"data-file-path": fileData?.file_path,
					"data-testid": "canvas-project-file-mention",
					contentEditable: false,
					style: { cursor: "pointer" },
					onMouseDown: (event: MouseEvent) => {
						event.preventDefault()
					},
					onClick: (event: MouseEvent) => {
						event.preventDefault()
						event.stopPropagation()
						const locateProjectFile = locateProjectFileRef.current
						if (!locateProjectFile) return
						void locateProjectFile({
							fileId: fileData?.file_id,
							filePath: fileData?.file_path,
							fileName: fileData?.file_name,
							locateInTree: true,
						})
					},
				},
				displayText,
			)
		}

		return {
			[PROJECT_FILE_MENTION_ITEM_TYPE]: projectFileRenderer,
		}
	}, [])

	// 配置 MentionExtension，通过依赖注入实现组件隔离
	const mentionExtension = useMemo(() => {
		if (!mentionDataService || !MentionExtensionClass) return null
		return MentionExtensionClass.configure({
			language: "zh-CN",
			getParentContainer: () => document.body,
			dataService: mentionDataService,
			initialLoadOptions: initialMentionPanelLoadOptionsRef.current,
			initialNavigationStack: initialMentionPanelNavigationStackRef.current,
			catalogBehavior: mentionPanelCatalogBehavior,
			trailingTextAfterInsert: MENTION_CARET_GUARD_TEXT,
			canSelectItem: (item: MentionSelectableItem) => item.type !== FOLDER_MENTION_ITEM_TYPE,
			nodeViewRenderers: mentionNodeViewRenderers,
		})
	}, [mentionDataService, MentionExtensionClass, mentionNodeViewRenderers])

	const mentionEnabledByModel = !isLoadingImageModelList && imageModelList.length > 0
	const mentionEnabledByCapability =
		mentionEnabledOverride === undefined ? mentionEnabledByModel : mentionEnabledOverride

	return {
		matchableItems,
		mentionDataService,
		mentionExtension,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		mentionEnabled:
			!!mentionDataService &&
			mentionEnabledByCapability &&
			(maxReferenceFiles === undefined || maxReferenceFiles > 0),
	}
}

function flattenProjectAttachmentFiles(
	nodes: ProjectAttachmentMentionNode[],
): Array<{ name: string; path?: string; extension?: string }> {
	const out: Array<{ name: string; path?: string; extension?: string }> = []
	for (const n of nodes) {
		if (!n.isDirectory) {
			out.push({ name: n.name, path: n.path, extension: n.extension })
			continue
		}
		if (n.children?.length) out.push(...flattenProjectAttachmentFiles(n.children))
	}
	return out
}

function getProjectFileMentionDisplayText(
	attrs: CanvasMentionAttributes,
	options?: CanvasMentionExtensionRuntimeOptions,
) {
	const customText = options?.renderText?.({ options, node: { attrs } })
	const fileName = (attrs.data as ReferenceResourcePanelFileData | undefined)?.file_name
	return `@${customText ?? fileName ?? "File"}`.replace(/^@@/, "@")
}
