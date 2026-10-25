import {
	createElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"
import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { MediaPreviewTrigger } from "@/components/base/MediaPreview"
import { useMagic } from "../../../app/providers/MagicProvider"
import type {
	CanvasMentionAttributes,
	CanvasMentionExtensionRuntimeOptions,
	CanvasMentionNodeViewRenderer,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelFileData,
} from "../../../public/props"
import { MENTION_CARET_GUARD_TEXT, type MatchableMentionItem } from "./tiptap/contentUtils"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceTypeFilter,
} from "./reference-assets/reference-resource.types"
import {
	isReferenceResourceTypeAllowed,
	isReferenceSelectionLimitBlocked,
	classifyReferenceAssetFile,
	isReferenceAssetTypeCapacityBlocked,
} from "./reference-assets/referenceResourceSelection"
import { useCanvasReferenceMentionRuntime } from "./reference-assets/useCanvasReferenceMentionRuntime"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "./reference-assets/canvasReferenceMention.constants"
import {
	MentionPanelViewMode,
	type MentionPanelSelectionSummary,
} from "@/components/business/MentionPanel/types"
import {
	getCanvasResourceAvailability,
	getCanvasResourceReferenceIdentity,
} from "../../../runtime/shared/path/canvasResourcePath"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useOptionalCanvas } from "../../../app/providers/CanvasProvider"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { useCanvasMentionMediaSource } from "./useCanvasMentionMediaSource"
import {
	MESSAGE_FILE_MENTION_NAME_CLASSES,
	MESSAGE_FILE_MENTION_ROOT_CLASS,
	MESSAGE_FILE_MENTION_VISUAL_BASE_CLASSES,
	MESSAGE_FILE_MENTION_VISUAL_CLASS,
	MESSAGE_FILE_MENTION_DESKTOP_CLASSES,
} from "@/components/business/MentionPanel/messageMentionVisual"

interface UseCanvasReferenceMentionOptions {
	/** 可匹配的项列表（从 referenceImagesState 派生） */
	matchableItems?: MatchableMentionItem[]
	/** 外部显式控制 @ 功能可用性；不传时使用默认模型就绪判定 */
	mentionEnabledOverride?: boolean
	/**
	 * 是否把项目附件树并入 string→mention 候选。
	 * 视频首尾帧等无参考资源能力时应关闭，避免 @文件名 被解析成 mention 芯片。
	 */
	includeProjectTreeCandidates?: boolean
	/** 最大参考文件数量限制 */
	maxReferenceFiles?: number
	/** 当前已选中的参考文件路径列表 */
	currentReferenceFiles?: string[]
	/** 是否已达到参考文件数量限制 */
	isReferenceFileLimitReached?: boolean
	/** 当前资源选择器允许的文件类型 */
	referenceResourceType?: ReferenceResourceTypeFilter
	/** 按类型细分的限制对象（视频编辑器场景传入，可覆盖总数判断） */
	assetLimits?: ReferenceAssetPerTypeLimits
	/** 当前已选各类型资源数量（与 assetLimits 配套使用） */
	currentAssetCounts?: ReferenceAssetTypeCounts
}

const CanvasProjectFileMentionNodeView: CanvasMentionNodeViewRenderer = (props) => {
	const { methods } = useMagic()
	const canvas = useOptionalCanvas()
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const [, forceResourceStateRefresh] = useState(0)
	const attrs = props.node.attrs as CanvasMentionAttributes & {
		pending?: boolean
		data?: ReferenceResourcePanelFileData
	}
	const fileData = attrs.data
	const options = props.extension.options as CanvasMentionExtensionRuntimeOptions
	const availability = getCanvasResourceAvailability(
		fileData?.file_path,
		methods?.resolveResourceReference,
	)
	const isPendingUpload = canvas?.canvasFileUploadManager.isPendingResourcePath(
		fileData?.file_path,
	)
	const isDeleted = availability === "deleted" && !isPendingUpload

	useEffect(() => {
		if (!canvas) return
		return canvas.eventEmitter.on("upload:resource-pending-change", ({ data }) => {
			if (!fileData?.file_path || !data.paths.includes(fileData.file_path)) return
			forceResourceStateRefresh((revision) => revision + 1)
		})
	}, [canvas, fileData?.file_path])
	const displayText = `${getProjectFileMentionDisplayText(attrs, options)}${
		isDeleted ? t("messageHistory.deletedSuffix", "（已删除）") : ""
	}`
	const fileType = fileData?.file_extension || fileData?.file_name?.split(".").pop() || ""
	const fileName = fileData?.file_name || displayText
	const uploadStatus = fileData?.upload_status
	const uploadProgress = Math.min(100, Math.max(0, Math.round(fileData?.upload_progress ?? 0)))
	const isUploading =
		attrs.pending === true && (uploadStatus === "init" || uploadStatus === "uploading")
	const isUploadError = attrs.pending === true && uploadStatus === "error"
	const fileIcon = createElement(MagicFileIcon, {
		type: fileType,
		size: 16,
		className: "shrink-0",
	})
	const mediaSource = useCanvasMentionMediaSource({
		path: fileData?.file_path,
		fileName,
		fileExtension: fileType,
		mediaType: fileData?.media_type,
		enabled: Boolean(fileData?.file_path) && !isDeleted && !attrs.pending,
	})
	const renderVisual = (thumbnail: ReactNode) =>
		createElement(
			"span",
			{
				className: `${MESSAGE_FILE_MENTION_VISUAL_CLASS} ${MESSAGE_FILE_MENTION_VISUAL_BASE_CLASSES} ${MESSAGE_FILE_MENTION_DESKTOP_CLASSES}${
					isUploading ? " bg-muted text-muted-foreground" : ""
				}${isUploadError ? " bg-destructive/10 text-destructive" : ""}`,
				"data-testid": "canvas-file-mention-visual",
			},
			isUploading
				? createElement("span", {
						className:
							"pointer-events-none absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200 ease-out",
						style: { width: `${uploadProgress}%` },
						"data-testid": "canvas-file-mention-progress-background",
					})
				: null,
			createElement(
				"span",
				{ className: "relative z-10 flex shrink-0 items-center" },
				thumbnail,
			),
			createElement(
				"span",
				{
					className: MESSAGE_FILE_MENTION_NAME_CLASSES,
					title: fileData?.file_path
						? `${displayText} (${fileData.file_path})`
						: displayText,
				},
				displayText,
			),
			isUploading
				? createElement(
						"span",
						{
							className:
								"relative z-10 shrink-0 text-[0.85em] tabular-nums leading-none text-muted-foreground",
							"data-testid": "canvas-file-mention-progress",
						},
						`${uploadProgress}%`,
					)
				: null,
			isUploadError
				? createElement(
						"span",
						{ className: "relative z-10 shrink-0 text-xs" },
						t("design.errors.uploadFailedBySubDir.images", "上传失败"),
					)
				: null,
		)
	const mediaTrigger = createElement(MediaPreviewTrigger, {
		fileName,
		source: mediaSource,
		fallback: fileIcon,
		renderTrigger: renderVisual,
		labels: {
			errorMessage: t(
				"mediaResourceFullscreenPreview.videoLoadFailed",
				"媒体加载失败，请稍后重试",
			),
			audioLabels: {
				play: t("video.fullscreen.play", "播放"),
				pause: t("video.fullscreen.pause", "暂停"),
				progress: t("video.fullscreen.progress", "播放进度"),
			},
		},
		enableTouchTrigger: true,
		disabled: isDeleted || Boolean(attrs.pending),
		side: "top",
		container: portalContainer,
	})

	return createElement(
		NodeViewWrapper,
		{
			as: "span",
			// Reset legacy .magic-mention chip styles so only the shared visual
			// contract paints the pill (same approach as SuperMagic FileMentionNodeView).
			className: `magic-mention canvas-project-file-mention ${MESSAGE_FILE_MENTION_ROOT_CLASS} relative -top-px inline-flex max-w-full overflow-visible bg-transparent p-0 align-middle${
				attrs.pending ? " opacity-50" : ""
			}`,
			"data-mention-suggestion-char": attrs.mentionSuggestionChar || "@",
			"data-type": attrs.type,
			"data-data": JSON.stringify(attrs.data || {}),
			"data-file-path": fileData?.file_path,
			"data-deleted": isDeleted ? "true" : undefined,
			"data-testid": "canvas-project-file-mention",
			"aria-disabled": isDeleted || undefined,
			contentEditable: false,
			onMouseDown: (event: MouseEvent) => {
				event.preventDefault()
			},
			onClick: (event: MouseEvent) => {
				event.preventDefault()
				event.stopPropagation()
				if (isDeleted) return
				const locateProjectFile = methods?.locateProjectFile
				if (!locateProjectFile) return
				void locateProjectFile({
					fileId: fileData?.file_id,
					filePath: fileData?.file_path,
					fileName: fileData?.file_name,
					locateInTree: true,
				})
			},
		},
		mediaTrigger,
	)
}

/**
 * 复用 MessageEditor @ 面板所需数据：matchableItems、mentionDataService
 * 供图片与视频编辑器共用
 *
 * mentionDataService 实例仅随 ctor 变化；附件树通过 syncProjectAttachmentRoots 同步，
 * limitInfo 由共享 reference mention runtime 管理，避免两个 @文件入口各自维护默认目录与过滤规则。
 */
export function useCanvasReferenceMention(options?: UseCanvasReferenceMentionOptions) {
	const {
		projectAttachmentMentionTree = [],
		mentionExtension: MentionExtensionClass,
		methods,
		isLoadingImageModelList = false,
		imageModelList = [],
	} = useMagic()
	const {
		matchableItems: externalMatchableItems = [],
		mentionEnabledOverride,
		includeProjectTreeCandidates = true,
		maxReferenceFiles,
		currentReferenceFiles = [],
		isReferenceFileLimitReached = false,
		referenceResourceType = "image",
		assetLimits,
		currentAssetCounts,
	} = options || {}

	const referenceFileInfos = useMemo(
		() =>
			externalMatchableItems.map((item) => ({
				src: item.path || "",
				fileName: item.name,
				path: item.path || "",
				...(item.assetType ? { assetType: item.assetType } : {}),
			})),
		[externalMatchableItems],
	)

	const referenceMentionRuntime = useCanvasReferenceMentionRuntime({
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
	})
	const mentionPanelSelectionSummary = useMemo<MentionPanelSelectionSummary | undefined>(() => {
		const summary = referenceMentionRuntime.selectionSummary
		if (!summary) return undefined

		return {
			currentCounts: summary.currentCounts,
			limits: summary.limits,
			totalLimit: summary.totalLimit,
			getItemAssetType: (item) => {
				if (item.type !== CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile) return undefined
				return summary.getItemAssetType?.({ type: item.type, data: item.data })
			},
			isItemAlreadySelected: (item) => {
				if (item.type !== CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile) return false
				return (
					summary.isItemAlreadySelected?.({ type: item.type, data: item.data }) === true
				)
			},
		}
	}, [referenceMentionRuntime.selectionSummary])
	// MessageEditor treats the MentionExtension identity as its lifecycle boundary.
	// Keep live selection counts behind a stable getter so prompt edits do not rebuild
	// Tiptap and steal focus from the user.
	const mentionPanelSelectionSummaryRef = useRef<MentionPanelSelectionSummary | undefined>(
		undefined,
	)
	mentionPanelSelectionSummaryRef.current = mentionPanelSelectionSummary
	const getMentionPanelSelectionSummary = useCallback(
		() => mentionPanelSelectionSummaryRef.current,
		[],
	)
	const {
		dataService: mentionDataService,
		getInitialLoadOptions,
		getInitialNavigationStack,
		catalogBehavior,
		canSelectItem,
	} = referenceMentionRuntime

	// 合并项目文件与当前元素参考文件（去重，外部优先）
	const matchableItems = useMemo(() => {
		const result: MatchableMentionItem[] = []
		const seenPathIdentities = new Set<string>()

		const pushItem = (item: MatchableMentionItem) => {
			if (item.path) {
				const identity = getCanvasResourceReferenceIdentity(
					item.path,
					methods?.resolveResourceReference,
				)
				if (seenPathIdentities.has(identity)) return
				seenPathIdentities.add(identity)
			}
			result.push(item)
		}

		// 优先放入当前元素参考文件，确保同名文件在 string -> mention 解析时优先命中当前上下文路径。
		externalMatchableItems.forEach((item) => {
			pushItem({
				...item,
				source: item.source ?? "element-reference",
			})
		})

		for (const item of includeProjectTreeCandidates
			? flattenProjectAttachmentFiles(projectAttachmentMentionTree)
			: []) {
			pushItem({
				name: item.name,
				path: item.path,
				source: "project-tree",
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
							resolveResourceReference: methods?.resolveResourceReference,
						})
					: isReferenceSelectionLimitBlocked({
							candidatePaths: [item.path, item.name],
							currentReferenceFiles,
							isReferenceFileLimitReached,
							resolveResourceReference: methods?.resolveResourceReference,
						})),
		}))
	}, [
		projectAttachmentMentionTree,
		externalMatchableItems,
		includeProjectTreeCandidates,
		isReferenceFileLimitReached,
		currentReferenceFiles,
		referenceResourceType,
		assetLimits,
		currentAssetCounts,
		methods?.resolveResourceReference,
	])

	const mentionNodeViewRenderers = useMemo(() => {
		return {
			[CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile]: CanvasProjectFileMentionNodeView,
		}
	}, [])

	// 配置 MentionExtension，通过依赖注入实现组件隔离
	const mentionExtension = useMemo(() => {
		if (!mentionDataService || !MentionExtensionClass) return null
		return MentionExtensionClass.configure({
			language: "zh-CN",
			getParentContainer: () => document.body,
			dataService: mentionDataService,
			getInitialLoadOptions,
			getInitialNavigationStack,
			catalogBehavior,
			viewMode: MentionPanelViewMode.GALLERY,
			galleryOptions: { enablePreviewModal: true },
			enableMultiSelect: true,
			// Canvas mentions can reference files, but a folder is only a navigation
			// container and must never enter the pending multi-select batch.
			canToggleMultiSelectItem: canSelectItem,
			multiSelectNavigationPolicy: "preserve",
			selectionScopeId: referenceMentionRuntime.selectionScopeId,
			getSelectionSummary: getMentionPanelSelectionSummary,
			trailingTextAfterInsert: MENTION_CARET_GUARD_TEXT,
			canSelectItem,
			nodeViewRenderers: mentionNodeViewRenderers,
		})
	}, [
		mentionDataService,
		MentionExtensionClass,
		getInitialLoadOptions,
		getInitialNavigationStack,
		catalogBehavior,
		canSelectItem,
		mentionNodeViewRenderers,
		referenceMentionRuntime.selectionScopeId,
		getMentionPanelSelectionSummary,
	])

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
	return (customText ?? fileName ?? "File").replace(/^@+/, "") || "File"
}
