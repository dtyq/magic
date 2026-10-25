import { useCallback, useEffect, useMemo, useRef } from "react"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import { useOptionalCanvas } from "../../../../app/providers/CanvasProvider"
import type {
	MentionDataServicePort,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelCatalogBehavior,
	ReferenceResourcePanelInitialLoadOptions,
	ReferenceResourcePanelLimitInfo,
	ReferenceResourcePanelNavigationItem,
	ReferenceResourcePanelSelectionSummary,
	ReferenceResourcePanelSelectableItem,
} from "../../../../public/props"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceFileInfo,
	ReferenceResourceTypeFilter,
} from "./reference-resource.types"
import {
	classifyReferenceAssetFile,
	isReferenceResourceCurrentlySelected,
} from "./referenceResourceSelection"
import {
	CANVAS_REFERENCE_MENTION_ITEM_TYPE,
	CANVAS_REFERENCE_MENTION_PANEL_STATE,
} from "./canvasReferenceMention.constants"

interface UseCanvasReferenceMentionRuntimeOptions {
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
}

export function canSelectCanvasReferenceMentionItem(
	item: ReferenceResourcePanelSelectableItem,
): boolean {
	// Treat either signal as authoritative so a partially normalized folder row
	// cannot be staged when the data service omits or changes its item type.
	return item.type !== CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder && item.isFolder !== true
}

export const canvasReferenceMentionCatalogBehavior: ReferenceResourcePanelCatalogBehavior = {
	shouldEnterFolderDirectly: ({ selectedItem, enterFolder }) => {
		return Boolean(
			!enterFolder &&
			selectedItem.type === CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder &&
			selectedItem.isFolder,
		)
	},
	getDynamicTransition: ({ selectedItem, enterFolder }) => {
		if (selectedItem.type !== CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder) return null
		if (!enterFolder || !selectedItem.isFolder) return null

		return {
			state: CANVAS_REFERENCE_MENTION_PANEL_STATE.folder,
		}
	},
}

// Single source of truth for Canvas reference resources. Keep both inline "@"
// mentions and the "select from project" popover wired through this runtime so
// default-folder, filtering, limit, and folder-navigation rules cannot drift.
export function useCanvasReferenceMentionRuntime(
	options: UseCanvasReferenceMentionRuntimeOptions,
): {
	dataService?: MentionDataServicePort
	projectAttachmentMentionTree: ProjectAttachmentMentionNode[]
	projectFilesPathPrefix: string
	selectionSummary?: ReferenceResourcePanelSelectionSummary
	/** Stable resource scope for a single Canvas project-selection session. */
	selectionScopeId?: string
	mentionFileSubtitleParentPrefix?: string
	initialLoadOptions?: ReferenceResourcePanelInitialLoadOptions
	initialNavigationStack?: ReferenceResourcePanelNavigationItem[]
	getInitialLoadOptions: () => ReferenceResourcePanelInitialLoadOptions | undefined
	getInitialNavigationStack: () => ReferenceResourcePanelNavigationItem[] | undefined
	catalogBehavior: ReferenceResourcePanelCatalogBehavior
	canSelectItem: typeof canSelectCanvasReferenceMentionItem
} {
	const {
		projectAttachmentMentionTree = [],
		defaultProjectAttachmentFolderId,
		defaultProjectAttachmentFolderName,
		mentionDataServiceCtor,
		methods,
	} = useMagic()
	const canvas = useOptionalCanvas()
	const { t } = useCanvasDesignI18n()
	const {
		maxReferenceFiles,
		currentReferenceFiles = [],
		isReferenceFileLimitReached = false,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
	} = options

	const projectFilesPathPrefix = t("referenceAssets.projectFilesRoot", "当前项目文件")
	const mentionFileSubtitleParentPrefix = defaultProjectAttachmentFolderName?.trim() || undefined
	// Keep a stable session boundary even while the attachment tree is still loading.
	// Include Canvas identity so equal relative folder paths from different projects
	// cannot reuse a stale selection session.
	const selectionScopeParts = [canvas?.id, defaultProjectAttachmentFolderId].filter(
		(value): value is string => Boolean(value),
	)
	const selectionScopeId = selectionScopeParts.length ? selectionScopeParts.join(":") : undefined
	// Keep the count snapshot and duplicate identity check next to the same limit
	// inputs used by DataService, so the breadcrumb cannot drift from selection rules.
	const selectionSummary = useMemo<ReferenceResourcePanelSelectionSummary | undefined>(() => {
		if (!assetLimits || !currentAssetCounts) {
			// Image generation exposes a single type limit instead of the video editor's
			// per-type limit object. Preserve the same summary contract for its @ panel.
			if (
				typeof maxReferenceFiles !== "number" ||
				!Number.isFinite(maxReferenceFiles) ||
				maxReferenceFiles <= 0 ||
				typeof referenceResourceType !== "string" ||
				!(["image", "video", "audio"] as const).includes(referenceResourceType)
			)
				return undefined

			const type = referenceResourceType
			return {
				currentCounts: {
					image: type === "image" ? currentReferenceFiles.length : 0,
					video: type === "video" ? currentReferenceFiles.length : 0,
					audio: type === "audio" ? currentReferenceFiles.length : 0,
				},
				limits: {
					[type]: maxReferenceFiles,
				},
				totalLimit: maxReferenceFiles,
				getItemAssetType: (item) => {
					const fileClass = classifyReferenceAssetFile({
						filePath: item.data.file_path,
						fileName: item.data.file_name,
						fileExtension: item.data.file_extension,
					})
					return fileClass === "unknown" ? undefined : fileClass
				},
				isItemAlreadySelected: (item) =>
					isReferenceResourceCurrentlySelected(
						[item.data.file_path, item.data.file_id, item.data.file_name],
						currentReferenceFiles,
						methods?.resolveResourceReference,
					),
			}
		}

		return {
			currentCounts: {
				image: currentAssetCounts.images,
				video: currentAssetCounts.videos,
				audio: currentAssetCounts.audios,
			},
			limits: {
				image: assetLimits.reference_images.max,
				video: assetLimits.reference_videos.max,
				audio: assetLimits.reference_audios.max,
			},
			totalLimit: assetLimits.total.max,
			getItemAssetType: (item) => {
				const fileClass = classifyReferenceAssetFile({
					filePath: item.data.file_path,
					fileName: item.data.file_name,
					fileExtension: item.data.file_extension,
				})
				return fileClass === "unknown" ? undefined : fileClass
			},
			isItemAlreadySelected: (item) =>
				isReferenceResourceCurrentlySelected(
					[item.data.file_path, item.data.file_id, item.data.file_name],
					currentReferenceFiles,
					methods?.resolveResourceReference,
				),
		}
	}, [
		assetLimits,
		currentAssetCounts,
		currentReferenceFiles,
		maxReferenceFiles,
		methods?.resolveResourceReference,
		referenceResourceType,
	])

	const limitInfoRef = useRef<ReferenceResourcePanelLimitInfo>({
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		resolveResourceReference: methods?.resolveResourceReference,
		projectFilesPathPrefix,
		mentionFileSubtitleParentPrefix,
	})

	limitInfoRef.current = {
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		resolveResourceReference: methods?.resolveResourceReference,
		projectFilesPathPrefix,
		mentionFileSubtitleParentPrefix,
	}

	// DataService 实例稳定，附件树和限制信息通过 sync/ref 更新，避免 TipTap 扩展重建导致失焦。
	const attachmentTreeRef = useRef(projectAttachmentMentionTree)
	attachmentTreeRef.current = projectAttachmentMentionTree

	const dataService = useMemo(() => {
		if (!mentionDataServiceCtor) return undefined
		const service = new mentionDataServiceCtor(attachmentTreeRef.current)
		service.setLimitInfoGetter?.(() => limitInfoRef.current)
		return service
	}, [mentionDataServiceCtor])

	useEffect(() => {
		dataService?.syncProjectAttachmentRoots?.(projectAttachmentMentionTree)
	}, [dataService, projectAttachmentMentionTree])

	useEffect(() => {
		if (!canvas || !dataService?.invalidateCanvasElementsCache) return

		const invalidate = () => {
			dataService.invalidateCanvasElementsCache?.()
		}
		const unsubscribes = [
			canvas.eventEmitter.on("element:change", ({ data }) => {
				if (data?.phase === "transient") return
				invalidate()
			}),
			canvas.eventEmitter.on("canvas:clear", invalidate),
			canvas.eventEmitter.on("element:temporary:converted", invalidate),
			canvas.eventEmitter.on("document:loaded", invalidate),
			canvas.eventEmitter.on("document:restored", invalidate),
		]

		return () => {
			unsubscribes.forEach((unsubscribe) => unsubscribe())
		}
	}, [canvas, dataService])

	useEffect(() => {
		if (!dataService?.setCanvasReferenceElementsContext) return

		if (!canvas) {
			dataService.setCanvasReferenceElementsContext(undefined)
			return
		}

		dataService.setCanvasReferenceElementsContext({
			canvasName: mentionFileSubtitleParentPrefix,
			rootFolderId: defaultProjectAttachmentFolderId,
			getCanvasDocument: () => canvas.exportDocument({ includeTemporary: false }),
		})

		queueMicrotask(() => {
			dataService.requestRefresh?.()
		})

		return () => {
			dataService.setCanvasReferenceElementsContext?.(undefined)
		}
	}, [canvas, dataService, defaultProjectAttachmentFolderId, mentionFileSubtitleParentPrefix])

	useEffect(() => {
		if (!dataService?.requestRefresh) return
		queueMicrotask(() => {
			dataService.requestRefresh?.()
		})
	}, [
		dataService,
		projectAttachmentMentionTree,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		methods?.resolveResourceReference,
		projectFilesPathPrefix,
		mentionFileSubtitleParentPrefix,
		defaultProjectAttachmentFolderId,
	])

	const initialLoadOptions = useMemo<ReferenceResourcePanelInitialLoadOptions | undefined>(() => {
		if (!defaultProjectAttachmentFolderId) return undefined
		return {
			itemId: defaultProjectAttachmentFolderId,
		}
	}, [defaultProjectAttachmentFolderId])

	const initialNavigationStack = useMemo<
		ReferenceResourcePanelNavigationItem[] | undefined
	>(() => {
		if (!defaultProjectAttachmentFolderId || !defaultProjectAttachmentFolderName)
			return undefined
		return [
			{
				id: defaultProjectAttachmentFolderId,
				name: defaultProjectAttachmentFolderName,
				state: CANVAS_REFERENCE_MENTION_PANEL_STATE.default,
			},
		]
	}, [defaultProjectAttachmentFolderId, defaultProjectAttachmentFolderName])
	const initialLoadOptionsRef = useRef(initialLoadOptions)
	initialLoadOptionsRef.current = initialLoadOptions
	const initialNavigationStackRef = useRef(initialNavigationStack)
	initialNavigationStackRef.current = initialNavigationStack

	const getInitialLoadOptions = useCallback(() => initialLoadOptionsRef.current, [])
	const getInitialNavigationStack = useCallback(() => initialNavigationStackRef.current, [])

	return {
		dataService,
		projectAttachmentMentionTree,
		projectFilesPathPrefix,
		selectionSummary,
		selectionScopeId,
		mentionFileSubtitleParentPrefix,
		initialLoadOptions,
		initialNavigationStack,
		getInitialLoadOptions,
		getInitialNavigationStack,
		catalogBehavior: canvasReferenceMentionCatalogBehavior,
		canSelectItem: canSelectCanvasReferenceMentionItem,
	}
}
