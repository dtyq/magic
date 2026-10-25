import { ArrowLeftRight, LoaderCircle, X } from "lucide-react"
import type { CSSProperties, ForwardedRef, PointerEvent, ReactNode, RefCallback } from "react"
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import { Switch } from "@/components/shadcn-ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../primitives/shadcn/select"
import EditorModelSelect from "./model-config/EditorModelSelect"
import type {
	VideoEditorConfig,
	LinkedFrameBinding,
	VideoReferenceAssetInfo,
	VideoReferenceAssetKind,
} from "./video-editor-config.types"
import type { VideoInputMode } from "../../../../public/magic-types"
import styles from "./index.module.css"
import sourceListStyles from "../../../panels/source-list/SourceList.module.css"
import SourceList, {
	type SourceListOption,
	type SourceListRenderItemParams,
	type SourceListSlotOption,
} from "../../../panels/source-list/index"
import { VideoGenerationSettingsPopover } from "./model-config/VideoGenerationSettingsPopover"
import {
	canAddReferenceAsset,
	canAddReferenceAssetByCounts,
	countVideoReferenceAssetInfosByKind,
	resolveReferenceAssetLimits,
} from "./model-config/video-editor-config.model"
import ReferenceResourceSlotPopover from "../../../editors/message/reference-assets/ReferenceResourceSlotPopover"
import type {
	ReferenceAssetFileClass,
	ReferenceAssetTypeCounts,
	ReferenceResourceSourceType,
	ReferenceResourceType,
} from "../../../editors/message/reference-assets/reference-resource.types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../../public/props"
import { cn } from "../../../../runtime/shared/lib/utils"
import { useOverflowChange } from "../../../../app/hooks/layout/useOverflowChange"
import { getCanvasResourceFileName } from "../../../../runtime/shared/path/canvasResourcePath"
import type { LinkedEditorMediaItem } from "../../../editors/connection/linkedEditorInputs"
import {
	dedupeLinkedMediaItemsByPath,
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaReferences,
	resolveLinkedMediaDisplay,
} from "../../../editors/connection/linkedEditorInputs"
import { useLinkedMediaSourceListOption } from "../../../editors/connection/useLinkedMediaSourceListOption"
import LinkedFrameMediaMenu from "./LinkedFrameMediaMenu"
import type { LinkedFrameRole } from "./LinkedFrameMediaMenu"
import { resolveLinkedFrameRoleForSlotIndex } from "./linkedFrameBindings"

type ReferencePopoverState = {
	slotKey: string
	referenceAssetKind?: VideoReferenceAssetKind
	currentFiles: string[]
	maxReferenceFiles?: number
	isLimitReached: boolean
	referenceResourceType: ReferenceResourceType
	referenceFileInfos: VideoEditorConfig["referenceImageInfos"]
	referenceAssetKinds?: VideoReferenceAssetKind[]
	assetLimits?: VideoEditorConfig["referenceAssetLimits"]
	currentAssetCounts?: VideoEditorConfig["referenceAssetCounts"]
	canAddReferenceAsset?: (
		kind: ReferenceAssetFileClass,
		counts: ReferenceAssetTypeCounts,
	) => boolean
}

interface VideoEditorEmptyReferenceSlotPopoverProps {
	inputTab: "frame" | "reference"
	option: SourceListSlotOption
	slotKey: string
	className: string
	style: CSSProperties
	content: ReactNode
	slotRootRef?: RefCallback<HTMLDivElement | null>
	isPopoverOpen: boolean
	selectedResourceSlotKey: string | null
	onPrepareResourceSlotSelection: (
		inputTab: "frame" | "reference",
		slotIndex: number,
		options?: {
			slotKey?: string
			referenceAssetKind?: VideoReferenceAssetKind
			referenceAssetKinds?: VideoReferenceAssetKind[]
			path?: string
		},
	) => void
	onPopoverOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	maxReferenceFiles?: number
	currentReferenceFiles: string[]
	isReferenceFileLimitReached: boolean
	referenceResourceType: ReferenceResourceType
	referenceFileInfos: VideoEditorConfig["referenceImageInfos"]
	referenceAssetKind?: VideoReferenceAssetKind
	referenceAssetKinds?: VideoReferenceAssetKind[]
	assetLimits?: VideoEditorConfig["referenceAssetLimits"]
	currentAssetCounts?: VideoEditorConfig["referenceAssetCounts"]
	canAddReferenceAsset?: (
		kind: ReferenceAssetFileClass,
		counts: VideoEditorConfig["referenceAssetCounts"],
	) => boolean
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	beforeSourceActions?: ReactNode
	onProjectSelectPanelOpenChange: (open: boolean) => void
	enableProjectSelectMultiSelect?: boolean
	maxProjectSelectBatchCount?: number
}

const VideoEditorReferenceSlotPopover = forwardRef<
	HTMLDivElement,
	VideoEditorEmptyReferenceSlotPopoverProps
>(function VideoEditorReferenceSlotPopover(props, forwardedRef) {
	const {
		inputTab,
		option,
		slotKey,
		className,
		style,
		content,
		isPopoverOpen,
		selectedResourceSlotKey,
		onPrepareResourceSlotSelection,
		onPopoverOpenChange,
		onMouseEnter,
		onMouseLeave,
		onSelectSource,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		referenceAssetKind,
		referenceAssetKinds,
		assetLimits,
		currentAssetCounts,
		canAddReferenceAsset,
		onProjectSelect,
		beforeSourceActions,
		onProjectSelectPanelOpenChange,
		enableProjectSelectMultiSelect,
		maxProjectSelectBatchCount,
		slotRootRef,
	} = props

	const handleSlotRootRef = useCallback(
		(node: HTMLDivElement | null) => {
			slotRootRef?.(node)
			assignForwardedRef(forwardedRef, node)
		},
		[forwardedRef, slotRootRef],
	)

	return (
		<ReferenceResourceSlotPopover
			className={className}
			style={style}
			content={content}
			slotKey={slotKey}
			slotRootRef={handleSlotRootRef}
			isPopoverOpen={isPopoverOpen}
			selectedSlotKey={selectedResourceSlotKey}
			onActivateSlot={() =>
				onPrepareResourceSlotSelection(inputTab, option.slotIndex, {
					slotKey,
					referenceAssetKind,
					referenceAssetKinds,
					path: option.resourcePath,
				})
			}
			onPopoverOpenChange={onPopoverOpenChange}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onSelectSource={onSelectSource}
			includeAssetsSource
			maxReferenceFiles={maxReferenceFiles}
			currentReferenceFiles={currentReferenceFiles}
			isReferenceFileLimitReached={isReferenceFileLimitReached}
			referenceResourceType={referenceResourceType}
			referenceFileInfos={referenceFileInfos}
			assetLimits={assetLimits}
			currentAssetCounts={currentAssetCounts}
			canAcceptNextAsset={canAddReferenceAsset}
			onProjectSelect={onProjectSelect}
			beforeSourceActions={beforeSourceActions}
			onProjectSelectPanelOpenChange={onProjectSelectPanelOpenChange}
			enableProjectSelectMultiSelect={enableProjectSelectMultiSelect}
			maxProjectSelectBatchCount={maxProjectSelectBatchCount}
		/>
	)
})

function assignForwardedRef<T>(ref: ForwardedRef<T>, value: T | null) {
	if (!ref) return
	if (typeof ref === "function") {
		ref(value)
		return
	}
	ref.current = value
}

function getLinkedMediaFileName(item: LinkedEditorMediaItem & { path: string }): string {
	return item.fileName || getCanvasResourceFileName(item.path) || item.path
}

/** 视频编辑器底部工具区：模型、输入 Tab 与发送区；SourceList 可挂载到顶部。 */
interface VideoEditorControlsProps {
	config: VideoEditorConfig
	hoveredMentionPath?: string | null
	onSourceListScrollbarChange?: (hasScrollbar: boolean) => void
	onPrepareResourceSlotSelection: (
		inputTab: "frame" | "reference",
		slotIndex: number,
		options?: {
			slotKey?: string
			referenceAssetKind?: VideoReferenceAssetKind
			referenceAssetKinds?: VideoReferenceAssetKind[]
			path?: string
		},
	) => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	renderSendButton?: () => React.ReactNode
	renderRestoreDefaultConfigButton?: () => React.ReactNode
	/** 点击顶部栏空白区域（非 SourceList）时聚焦提示词编辑器 */
	onFocusEditor?: () => void
	linkedMediaItems?: LinkedEditorMediaItem[]
	onLinkedMediaSelectionChange?: (connectionId: string, selected: boolean) => void
	linkedFrameBindings?: Array<LinkedFrameBinding | undefined>
	onLinkedMediaFrameSelect?: (
		slotIndex: number,
		frameRole: LinkedFrameRole,
		item: LinkedEditorMediaItem & { kind: "image"; path: string },
	) => void
	renderPromptOptimizationButton?: () => React.ReactNode
	/** 将媒体 SourceList 挂载到编辑器顶部；未传入时保留内联渲染。 */
	sourceListContainer?: HTMLElement | null
}

export default function VideoEditorControls(props: VideoEditorControlsProps) {
	const {
		config,
		hoveredMentionPath,
		onSourceListScrollbarChange,
		onPrepareResourceSlotSelection,
		onSelectSource,
		onProjectSelect,
		renderSendButton,
		renderRestoreDefaultConfigButton,
		onFocusEditor,
		linkedMediaItems = [],
		onLinkedMediaSelectionChange,
		linkedFrameBindings = [],
		onLinkedMediaFrameSelect,
		renderPromptOptimizationButton,
		sourceListContainer,
	} = props
	const { t } = useCanvasDesignI18n()
	const { methods } = useMagic()
	const resolveResourceReference = methods?.resolveResourceReference
	const createLinkedMediaSourceListOption = useLinkedMediaSourceListOption()
	const sourceListScrollerRef = useRef<HTMLDivElement | null>(null)
	const [hasSourceListScrollbar, setHasSourceListScrollbar] = useState(false)
	const {
		selectedModelId,
		selectedInputMode,
		availableInputModes,
		selectedResolution,
		selectedDraft,
		canEnableDraft,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		activeInputTab,
		currentInputModeConfig,
		supportsEndFrame,
		maxFrameImages,
		currentFrameImages,
		frameImageInfos,
		referenceImageInfos,
		supportsReferenceAssets,
		supportsReferenceImages,
		supportsReferenceVideos,
		supportsReferenceAudios,
		supportsStartFrame,
		isPopoverOpen,
		selectedResourceSlot,
		isUploading,
		resourceUploadSlotKey,
		uploadUiDismissed,
		handlers,
	} = config

	const removeSlotAriaLabel = t("videoEditor.removeSlotResource", "移除该参考资源")
	/** 文生视频走提示词，不作为模式菜单项展示；仅展示需切换素材类型的模式 */
	const inputModesForSelect = useMemo(
		() =>
			availableInputModes.filter(
				(mode): mode is Exclude<VideoInputMode, "standard"> => mode !== "standard",
			),
		[availableInputModes],
	)
	const shouldShowModeSelect =
		inputModesForSelect.length > 0 &&
		(inputModesForSelect.length > 1 || availableInputModes.includes("standard"))
	const selectedInputModeForSelect = inputModesForSelect.includes(
		selectedInputMode as Exclude<VideoInputMode, "standard">,
	)
		? (selectedInputMode as Exclude<VideoInputMode, "standard">)
		: inputModesForSelect[0]
	const inputModeLabels = {
		framesLabel: t("videoEditor.frames", "首尾帧"),
		videoEditLabel: t("videoEditor.videoEdit", "视频编辑"),
		referenceImageLabel: t("videoEditor.referenceImage", "参考图"),
		referenceAssetLabel: t("videoEditor.referenceAsset", "全能模式"),
	}
	const handleInputModeSelect = useCallback(
		(value: string) => {
			if (!inputModesForSelect.includes(value as Exclude<VideoInputMode, "standard">)) return
			handlers.handleInputModeChange(value as VideoInputMode)
		},
		[handlers, inputModesForSelect],
	)
	// draft 是服务端按模型能力声明的生成开关，不能用模型 ID 做前端推断。
	// 样片协议固定使用 480p；其他分辨率下不展示该开关，避免用户误以为可提交样片。
	const draftConfig = selectedModelOption?.model.video_generation_config?.generation?.draft
	const hasDraft =
		draftConfig !== undefined && selectedDraft !== undefined && selectedResolution === "480p"
	const draftLabel = draftConfig?.name || t("videoEditor.draft", "样片模式")

	const getPopoverLimitState = useCallback(
		(paths: Array<string | undefined>, slotIndex: number, maxCount?: number) => {
			const slotPath = paths[slotIndex]
			const currentFiles =
				slotPath !== undefined
					? paths.filter((_, index) => index !== slotIndex && Boolean(paths[index]))
					: paths.filter(Boolean)
			const isLimitReached = maxCount !== undefined && currentFiles.length >= maxCount

			return {
				currentFiles: currentFiles as string[],
				isLimitReached,
			}
		},
		[],
	)
	const supportedReferenceKinds = useMemo(() => {
		// video_edit：视频槽在前，方便先选待编辑视频再补参考图
		const orderedKinds =
			selectedInputMode === "video_edit"
				? [
						supportsReferenceVideos ? "video" : null,
						supportsReferenceImages ? "image" : null,
						supportsReferenceAudios ? "audio" : null,
					]
				: [
						supportsReferenceImages ? "image" : null,
						supportsReferenceVideos ? "video" : null,
						supportsReferenceAudios ? "audio" : null,
					]
		return orderedKinds.filter((item): item is VideoReferenceAssetKind => Boolean(item))
	}, [
		selectedInputMode,
		supportsReferenceAudios,
		supportsReferenceImages,
		supportsReferenceVideos,
	])
	const referenceSlotLabelByType = useMemo(
		() => ({
			image:
				selectedInputMode === "image_reference"
					? t("videoEditor.slotLabelReferenceImage", "参考图")
					: t("videoEditor.promptPlaceholderReferenceImageTokenLabel", "图片"),
			video: t("videoEditor.promptPlaceholderReferenceVideoTokenLabel", "视频"),
			audio: t("videoEditor.promptPlaceholderReferenceAudioTokenLabel", "音频"),
		}),
		[selectedInputMode, t],
	)
	const referenceResourceTypeByKind = useMemo(
		() =>
			({
				image: "image",
				video: "video",
				audio: "audio",
			}) satisfies Record<VideoReferenceAssetKind, ReferenceResourceType>,
		[],
	)
	const linkedDisplayMediaItems = useMemo(
		() =>
			linkedMediaItems.filter((item): item is LinkedEditorMediaItem & { path: string } =>
				Boolean(item.path),
			),
		[linkedMediaItems],
	)
	const linkedFrameMediaItems = useMemo(() => {
		const boundConnectionIds = new Set(
			linkedFrameBindings.flatMap((binding) => (binding ? [binding.sourceConnectionId] : [])),
		)
		const imageItems = linkedDisplayMediaItems
			.filter(
				(item): item is LinkedEditorMediaItem & { kind: "image"; path: string } =>
					item.kind === "image",
			)
			.sort(
				(left, right) =>
					Number(boundConnectionIds.has(right.connectionId)) -
					Number(boundConnectionIds.has(left.connectionId)),
			)
		return dedupeLinkedMediaItemsByPath(imageItems, resolveResourceReference)
	}, [linkedDisplayMediaItems, linkedFrameBindings, resolveResourceReference])
	const linkedActiveMediaItems = useMemo(
		() => linkedDisplayMediaItems.filter((item) => item.status === "active"),
		[linkedDisplayMediaItems],
	)
	const {
		manualItems: visibleReferenceImageEntries,
		linkedItems: visibleLinkedDisplayMediaItems,
	} = useMemo(
		() =>
			resolveLinkedMediaDisplay(
				referenceImageInfos.map((info, index) => ({ info, index })),
				(entry) => entry.info.path,
				linkedDisplayMediaItems,
				resolveResourceReference,
			),
		[linkedDisplayMediaItems, referenceImageInfos, resolveResourceReference],
	)
	const linkedActiveReferenceAssetInfos = useMemo<VideoReferenceAssetInfo[]>(
		() =>
			linkedActiveMediaItems.map((item) => ({
				path: item.path,
				src: item.path,
				fileName: getLinkedMediaFileName(item),
				assetType: item.kind,
			})),
		[linkedActiveMediaItems],
	)
	const effectiveReferenceAssetInfos = useMemo(
		() =>
			mergeLinkedMediaReferences(
				referenceImageInfos.map((info) => ({
					kind: info.assetType,
					path: info.path,
				})),
				linkedActiveReferenceAssetInfos.map((info) => ({
					kind: info.assetType,
					path: info.path,
				})),
				resolveResourceReference,
			).map((reference) => {
				const manualInfo = referenceImageInfos.find(
					(info) =>
						getLinkedMediaReferenceIdentity(info.path, resolveResourceReference) ===
						getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference),
				)
				return (
					manualInfo ?? {
						path: reference.path,
						src: reference.path,
						fileName: getCanvasResourceFileName(reference.path) || reference.path,
						assetType: reference.kind,
					}
				)
			}),
		[linkedActiveReferenceAssetInfos, referenceImageInfos, resolveResourceReference],
	)
	const effectiveReferenceAssetLimits = useMemo(
		() =>
			resolveReferenceAssetLimits(currentInputModeConfig, effectiveReferenceAssetInfos, {
				ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference",
			}),
		[currentInputModeConfig, effectiveReferenceAssetInfos, selectedInputMode],
	)
	const effectiveMaxReferenceFiles = useMemo(() => {
		if (!supportsReferenceAssets) return 0
		const maxCount = effectiveReferenceAssetLimits.total.max
		if (!Number.isFinite(maxCount)) return undefined
		return maxCount && maxCount > 0 ? maxCount : undefined
	}, [effectiveReferenceAssetLimits.total.max, supportsReferenceAssets])
	const effectiveReferenceAssetCounts = useMemo(
		() => countVideoReferenceAssetInfosByKind(effectiveReferenceAssetInfos),
		[effectiveReferenceAssetInfos],
	)
	const effectiveReferenceAssetTotalCount = effectiveReferenceAssetInfos.length
	const displayReferenceKinds = useMemo(() => {
		const nextKinds: VideoReferenceAssetKind[] = [...supportedReferenceKinds]
		visibleLinkedDisplayMediaItems.forEach((item) => {
			if (!nextKinds.includes(item.kind)) {
				nextKinds.push(item.kind)
			}
		})
		return nextKinds
	}, [supportedReferenceKinds, visibleLinkedDisplayMediaItems])

	const frameOptions = useMemo((): SourceListOption[] => {
		const options: SourceListOption[] = []
		let slotIndex = 0
		if (supportsStartFrame) {
			const idx = slotIndex
			const path = currentFrameImages[idx]
			options.push({
				kind: "slot",
				label: t("videoEditor.slotLabelFirstFrame", "首帧"),
				value: `frame-slot-${idx}-${path ?? ""}`,
				slotIndex: idx,
				...(path
					? {
							resourcePath: path,
							resourceMediaType: "image",
							resourceStatusLabel: t("videoEditor.slotLabelFirstFrame", "首帧"),
							resourceFileName:
								getLinkedMediaReferenceIdentity(
									linkedFrameBindings[idx]?.framePath,
									resolveResourceReference,
								) ===
								getLinkedMediaReferenceIdentity(path, resolveResourceReference)
									? linkedFrameBindings[idx]?.sourceFileName
									: frameImageInfos[idx]?.fileName,
							isLinked:
								getLinkedMediaReferenceIdentity(
									linkedFrameBindings[idx]?.framePath,
									resolveResourceReference,
								) ===
								getLinkedMediaReferenceIdentity(path, resolveResourceReference),
							removeResourceAriaLabel: removeSlotAriaLabel,
							onRemoveResource: () => handlers.handleFrameImageRemove(idx),
						}
					: {}),
			})
			slotIndex += 1
		}
		if (supportsEndFrame) {
			const idx = slotIndex
			const path = currentFrameImages[idx]
			options.push({
				kind: "slot",
				label: t("videoEditor.slotLabelLastFrame", "尾帧"),
				value: `frame-slot-${idx}-${path ?? ""}`,
				slotIndex: idx,
				...(path
					? {
							resourcePath: path,
							resourceMediaType: "image",
							resourceStatusLabel: t("videoEditor.slotLabelLastFrame", "尾帧"),
							resourceFileName:
								getLinkedMediaReferenceIdentity(
									linkedFrameBindings[idx]?.framePath,
									resolveResourceReference,
								) ===
								getLinkedMediaReferenceIdentity(path, resolveResourceReference)
									? linkedFrameBindings[idx]?.sourceFileName
									: frameImageInfos[idx]?.fileName,
							isLinked:
								getLinkedMediaReferenceIdentity(
									linkedFrameBindings[idx]?.framePath,
									resolveResourceReference,
								) ===
								getLinkedMediaReferenceIdentity(path, resolveResourceReference),
							removeResourceAriaLabel: removeSlotAriaLabel,
							onRemoveResource: () => handlers.handleFrameImageRemove(idx),
						}
					: {}),
			})
		}
		const bothFrameImagesFilled =
			supportsStartFrame &&
			supportsEndFrame &&
			Boolean(currentFrameImages[0]) &&
			Boolean(currentFrameImages[1])
		if (bothFrameImagesFilled) {
			const swapLabel = t("videoEditor.swapStartEndFrames", "互换首尾帧")
			options.push({
				kind: "overlay",
				value: "frame-pair-swap-overlay",
				betweenSlotOrdinals: [0, 1],
				render: () => (
					<button
						type="button"
						className={styles.sourceListOverlaySwapButton}
						aria-label={swapLabel}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							handlers.handleSwapFramePair()
						}}
					>
						<ArrowLeftRight
							size={12}
							aria-hidden
							className={styles.sourceListOverlaySwapIcon}
						/>
					</button>
				),
			})
		}
		return options
	}, [
		supportsStartFrame,
		supportsEndFrame,
		resolveResourceReference,
		currentFrameImages,
		frameImageInfos,
		linkedFrameBindings,
		removeSlotAriaLabel,
		handlers,
		t,
	])

	const referenceAssetOptions = useMemo((): SourceListOption[] => {
		if (!supportsReferenceAssets && visibleLinkedDisplayMediaItems.length === 0) return []
		const totalCount = effectiveReferenceAssetTotalCount
		const totalLimitReached =
			effectiveMaxReferenceFiles !== undefined && totalCount >= effectiveMaxReferenceFiles
		const existingItemsByType = {
			image: [] as Array<{
				info: VideoEditorConfig["referenceImageInfos"][number]
				index: number
			}>,
			video: [] as Array<{
				info: VideoEditorConfig["referenceImageInfos"][number]
				index: number
			}>,
			audio: [] as Array<{
				info: VideoEditorConfig["referenceImageInfos"][number]
				index: number
			}>,
		}

		visibleReferenceImageEntries.forEach(({ info, index }) => {
			existingItemsByType[info.assetType].push({ info, index })
		})
		const linkedItemsByType = {
			image: [] as Array<LinkedEditorMediaItem & { path: string }>,
			video: [] as Array<LinkedEditorMediaItem & { path: string }>,
			audio: [] as Array<LinkedEditorMediaItem & { path: string }>,
		}
		visibleLinkedDisplayMediaItems.forEach((item) => {
			linkedItemsByType[item.kind].push(item)
		})

		const getTypeMax = (kind: VideoReferenceAssetKind): number | undefined => {
			const range =
				kind === "image"
					? effectiveReferenceAssetLimits.reference_images
					: kind === "video"
						? effectiveReferenceAssetLimits.reference_videos
						: effectiveReferenceAssetLimits.reference_audios
			if (!Number.isFinite(range.max)) return undefined
			return Math.max(range.max, 0)
		}

		const getTypeCount = (kind: VideoReferenceAssetKind): number => {
			if (kind === "image") return effectiveReferenceAssetCounts.images
			if (kind === "video") return effectiveReferenceAssetCounts.videos
			return effectiveReferenceAssetCounts.audios
		}

		const getInsertIndex = (kind: VideoReferenceAssetKind): number => {
			const items = existingItemsByType[kind]
			if (items.length > 0) return items[items.length - 1].index + 1
			const currentKindIndex = supportedReferenceKinds.indexOf(kind)
			for (const laterKind of supportedReferenceKinds.slice(currentKindIndex + 1)) {
				const nextItems = existingItemsByType[laterKind]
				if (nextItems.length > 0) return nextItems[0].index
			}
			return referenceImageInfos.length
		}

		const options: SourceListOption[] = []
		const isOmniReferenceMode = selectedInputMode === "omni_reference"
		if (isOmniReferenceMode) {
			for (const kind of displayReferenceKinds) {
				const items = existingItemsByType[kind]
				const linkedItems = linkedItemsByType[kind]
				const maxCount = getTypeMax(kind)
				const typeCount = getTypeCount(kind)
				const countLabel =
					typeCount > 0 && maxCount !== undefined
						? `(${typeCount}/${maxCount})`
						: undefined
				items.forEach(({ info, index }) => {
					options.push({
						kind: "slot",
						label: referenceSlotLabelByType[kind],
						secondaryLabel: countLabel,
						value: `reference-${kind}-${index}-${info.path}`,
						slotIndex: index,
						groupId: kind,
						resourcePath: info.path,
						resourceFileName: info.fileName,
						resourceMediaType: info.assetType,
						removeResourceAriaLabel: removeSlotAriaLabel,
						onRemoveResource: () => handlers.handleReferenceImageRemove(info.path),
					})
				})
				linkedItems.forEach((item, linkedIndex) => {
					options.push(
						createLinkedMediaSourceListOption({
							item,
							index: linkedIndex,
							slotIndex: referenceImageInfos.length + linkedIndex,
							label: referenceSlotLabelByType[kind],
							onLinkedMediaSelectionChange,
						}),
					)
				})
			}
			const canAddAnyReferenceKind = supportedReferenceKinds.some((kind) => {
				const maxCount = getTypeMax(kind)
				return (
					(maxCount === undefined || getTypeCount(kind) < maxCount) &&
					canAddReferenceAsset(
						currentInputModeConfig,
						effectiveReferenceAssetInfos,
						kind,
						{ ignoreModeMaxCountForTotal: true },
					)
				)
			})
			options.push({
				kind: "slot",
				label: t("videoEditor.slotLabelReferenceMedia", "媒体"),
				value: `reference-media-empty-${referenceImageInfos.length}-${effectiveReferenceAssetTotalCount}`,
				slotIndex: referenceImageInfos.length,
				groupId: "media",
				disabled: !canAddAnyReferenceKind,
			})
			return options
		}
		for (const kind of displayReferenceKinds) {
			const items = existingItemsByType[kind]
			const linkedItems = linkedItemsByType[kind]
			const maxCount = getTypeMax(kind)
			const typeCount = getTypeCount(kind)
			const countLabel =
				typeCount > 0 && maxCount !== undefined ? `(${typeCount}/${maxCount})` : undefined
			items.forEach(({ info, index }) => {
				options.push({
					kind: "slot",
					label: referenceSlotLabelByType[kind],
					secondaryLabel: countLabel,
					value: `reference-${kind}-${index}-${info.path}`,
					slotIndex: index,
					groupId: kind,
					resourcePath: info.path,
					resourceFileName: info.fileName,
					resourceMediaType: info.assetType,
					removeResourceAriaLabel: removeSlotAriaLabel,
					onRemoveResource: () => handlers.handleReferenceImageRemove(info.path),
				})
			})
			linkedItems.forEach((item, linkedIndex) => {
				options.push(
					createLinkedMediaSourceListOption({
						item,
						index: linkedIndex,
						slotIndex: referenceImageInfos.length + linkedIndex,
						label: referenceSlotLabelByType[kind],
						onLinkedMediaSelectionChange,
					}),
				)
			})

			const canAddMoreOfType =
				supportedReferenceKinds.includes(kind) &&
				!totalLimitReached &&
				(maxCount === undefined || typeCount < maxCount)
			if (!canAddMoreOfType) continue

			const insertIndex = getInsertIndex(kind)
			options.push({
				kind: "slot",
				label: referenceSlotLabelByType[kind],
				secondaryLabel: countLabel,
				value: `reference-${kind}-empty-${insertIndex}-${typeCount}`,
				slotIndex: insertIndex,
				groupId: kind,
			})
		}

		return options
	}, [
		supportsReferenceAssets,
		selectedInputMode,
		effectiveReferenceAssetTotalCount,
		effectiveReferenceAssetInfos,
		effectiveMaxReferenceFiles,
		currentInputModeConfig,
		visibleReferenceImageEntries,
		visibleLinkedDisplayMediaItems,
		referenceImageInfos,
		effectiveReferenceAssetLimits,
		effectiveReferenceAssetCounts,
		supportedReferenceKinds,
		displayReferenceKinds,
		referenceSlotLabelByType,
		createLinkedMediaSourceListOption,
		removeSlotAriaLabel,
		onLinkedMediaSelectionChange,
		handlers,
		t,
	])
	const showTopImageInputs =
		supportsStartFrame ||
		supportsEndFrame ||
		supportsReferenceAssets ||
		linkedDisplayMediaItems.length > 0

	const selectedResourceSlotKey = selectedResourceSlot
		? selectedResourceSlot.slotKey ||
			`${selectedResourceSlot.inputTab}-${selectedResourceSlot.slotIndex}`
		: null

	const resolveReferencePopoverState = useCallback(
		(option: SourceListSlotOption): ReferencePopoverState => {
			const isAggregateMediaSlot = option.groupId === "media"
			const referenceAssetKind = (option.groupId || "image") as VideoReferenceAssetKind
			const referenceAssetKinds = isAggregateMediaSlot
				? supportedReferenceKinds
				: [referenceAssetKind]
			const allowedInfos = referenceImageInfos.filter((info) =>
				referenceAssetKinds.includes(info.assetType),
			)
			const optionIdentity = getLinkedMediaReferenceIdentity(
				option.resourcePath,
				resolveResourceReference,
			)
			const currentReferenceInfos = effectiveReferenceAssetInfos.filter(
				(info) =>
					!optionIdentity ||
					getLinkedMediaReferenceIdentity(info.path, resolveResourceReference) !==
						optionIdentity,
			)
			const currentReferenceCount = currentReferenceInfos.length
			const currentAssetCounts = countVideoReferenceAssetInfosByKind(currentReferenceInfos)
			const typeRange =
				referenceAssetKind === "image"
					? effectiveReferenceAssetLimits.reference_images
					: referenceAssetKind === "video"
						? effectiveReferenceAssetLimits.reference_videos
						: effectiveReferenceAssetLimits.reference_audios
			const totalMax = effectiveReferenceAssetLimits.total.max
			const effectiveMax = isAggregateMediaSlot
				? totalMax
				: Number.isFinite(typeRange.max)
					? Math.min(Math.max(typeRange.max, 0), totalMax)
					: totalMax
			const usedCount =
				referenceAssetKind === "image"
					? currentAssetCounts.images
					: referenceAssetKind === "video"
						? currentAssetCounts.videos
						: currentAssetCounts.audios
			const hasRemainingCapacity = isAggregateMediaSlot
				? referenceAssetKinds.some((kind) => {
						const range =
							kind === "image"
								? effectiveReferenceAssetLimits.reference_images
								: kind === "video"
									? effectiveReferenceAssetLimits.reference_videos
									: effectiveReferenceAssetLimits.reference_audios
						const count =
							kind === "image"
								? currentAssetCounts.images
								: kind === "video"
									? currentAssetCounts.videos
									: currentAssetCounts.audios
						return !Number.isFinite(range.max) || count < range.max
					})
				: !Number.isFinite(typeRange.max) || usedCount < typeRange.max
			return {
				slotKey: option.value,
				referenceAssetKind: isAggregateMediaSlot ? undefined : referenceAssetKind,
				referenceAssetKinds,
				currentFiles: currentReferenceInfos.map((info) => info.path),
				maxReferenceFiles:
					Number.isFinite(effectiveMax) && effectiveMax > 0 ? effectiveMax : undefined,
				isLimitReached:
					(Number.isFinite(totalMax) && currentReferenceCount >= totalMax) ||
					!hasRemainingCapacity,
				referenceResourceType: isAggregateMediaSlot
					? "file"
					: referenceResourceTypeByKind[referenceAssetKind],
				referenceFileInfos: allowedInfos,
				assetLimits: effectiveReferenceAssetLimits,
				currentAssetCounts,
				canAddReferenceAsset: (
					kind: ReferenceAssetFileClass,
					counts: ReferenceAssetTypeCounts,
				) =>
					kind !== "unknown" &&
					canAddReferenceAssetByCounts(currentInputModeConfig, counts, kind, {
						ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference",
					}),
			}
		},
		[
			effectiveReferenceAssetLimits,
			effectiveReferenceAssetInfos,
			referenceImageInfos,
			referenceResourceTypeByKind,
			supportedReferenceKinds,
			resolveResourceReference,
			currentInputModeConfig,
			selectedInputMode,
		],
	)

	const buildRenderSourceListSlotItem = useCallback(
		(
			inputTab: "frame" | "reference",
			resolvePopoverState: (option: SourceListSlotOption) => ReferencePopoverState,
		) => {
			return function renderSourceListSlotItem(params: SourceListRenderItemParams) {
				const { option, className, style, content, onClick, slotRootRef } = params
				if (option.disabled) {
					return (
						<div
							ref={slotRootRef}
							className={cn(className, "pointer-events-none opacity-50")}
							style={style}
							aria-disabled="true"
							title={t(
								"videoEditor.referenceAssetAllTypesMaxReached",
								"图片、视频和音频均已达到数量上限",
							)}
						>
							{content}
						</div>
					)
				}
				const {
					slotKey,
					referenceAssetKind,
					currentFiles,
					maxReferenceFiles,
					isLimitReached,
					referenceResourceType: slotReferenceResourceType,
					referenceFileInfos: slotReferenceFileInfos,
					referenceAssetKinds,
					assetLimits,
					currentAssetCounts,
					canAddReferenceAsset,
				} = resolvePopoverState(option)
				const frameRole: LinkedFrameRole | undefined =
					inputTab === "frame"
						? resolveLinkedFrameRoleForSlotIndex(
								option.slotIndex,
								supportsStartFrame,
								supportsEndFrame,
							)
						: undefined
				const linkedFrameMenu =
					frameRole && linkedFrameMediaItems.length > 0 ? (
						<LinkedFrameMediaMenu
							items={linkedFrameMediaItems}
							bindings={linkedFrameBindings}
							slotIndex={option.slotIndex}
							frameRole={frameRole}
							resolveResourceReference={resolveResourceReference}
							onSelect={(item) => {
								onLinkedMediaFrameSelect?.(option.slotIndex, frameRole, item)
								handlers.setPopoverOpen(false)
							}}
							onClear={() => {
								handlers.handleFrameImageRemove(option.slotIndex)
							}}
						/>
					) : undefined
				const isSlotUploading =
					isUploading &&
					resourceUploadSlotKey != null &&
					resourceUploadSlotKey === slotKey &&
					!uploadUiDismissed
				if (isSlotUploading) {
					const uploadingLabel = t("videoEditor.uploadingResource", "上传中")
					const cancelUploadLabel = t("videoEditor.cancelPendingUpload", "取消上传")
					return (
						<div
							ref={slotRootRef}
							className={cn(className, sourceListStyles.sourceItemHasResource)}
							style={style}
							aria-busy
							aria-label={uploadingLabel}
						>
							<div className={sourceListStyles.sourceItemInnerFilled}>
								<div className={styles.imageSlotUploadingBackdrop}>
									<LoaderCircle
										size={20}
										className="shrink-0 animate-spin text-muted-foreground"
										aria-hidden
									/>
									<span className={styles.imageSlotUploadingLabel}>
										{uploadingLabel}
									</span>
								</div>
							</div>
							<button
								type="button"
								className={sourceListStyles.sourceItemRemoveButton}
								aria-label={cancelUploadLabel}
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									handlers.cancelPendingResourceUpload()
								}}
							>
								<X
									size={20}
									className={sourceListStyles.sourceItemRemoveIcon}
									aria-hidden
								/>
							</button>
						</div>
					)
				}
				if (option.readOnly) {
					return (
						<div
							ref={slotRootRef}
							className={className}
							style={style}
							onClick={onClick}
						>
							{content}
						</div>
					)
				}
				return (
					<VideoEditorReferenceSlotPopover
						inputTab={inputTab}
						option={option}
						slotKey={slotKey}
						className={cn(
							className,
							Boolean(option.resourcePath && hoveredMentionPath) &&
								getLinkedMediaReferenceIdentity(
									option.resourcePath,
									resolveResourceReference,
								) ===
									getLinkedMediaReferenceIdentity(
										hoveredMentionPath ?? undefined,
										resolveResourceReference,
									) &&
								sourceListStyles.sourceItemMentionHovered,
						)}
						style={style}
						content={content}
						slotRootRef={slotRootRef}
						isPopoverOpen={isPopoverOpen}
						selectedResourceSlotKey={selectedResourceSlotKey}
						onPrepareResourceSlotSelection={onPrepareResourceSlotSelection}
						onPopoverOpenChange={handlers.setPopoverOpen}
						onMouseEnter={handlers.handlePopoverMouseEnter}
						onMouseLeave={handlers.handlePopoverMouseLeave}
						onSelectSource={onSelectSource}
						maxReferenceFiles={maxReferenceFiles}
						currentReferenceFiles={currentFiles}
						isReferenceFileLimitReached={isLimitReached}
						referenceResourceType={slotReferenceResourceType}
						referenceFileInfos={slotReferenceFileInfos}
						referenceAssetKind={referenceAssetKind}
						referenceAssetKinds={referenceAssetKinds}
						assetLimits={assetLimits}
						currentAssetCounts={currentAssetCounts}
						canAddReferenceAsset={canAddReferenceAsset}
						onProjectSelect={onProjectSelect}
						beforeSourceActions={linkedFrameMenu}
						onProjectSelectPanelOpenChange={handlers.setReferenceProjectPanelOpen}
						enableProjectSelectMultiSelect={!option.resourcePath}
						maxProjectSelectBatchCount={option.resourcePath ? 1 : undefined}
					/>
				)
			}
		},
		[
			isUploading,
			resourceUploadSlotKey,
			uploadUiDismissed,
			isPopoverOpen,
			selectedResourceSlotKey,
			onPrepareResourceSlotSelection,
			handlers,
			onSelectSource,
			onProjectSelect,
			hoveredMentionPath,
			t,
			linkedFrameMediaItems,
			linkedFrameBindings,
			supportsStartFrame,
			supportsEndFrame,
			onLinkedMediaFrameSelect,
			resolveResourceReference,
		],
	)

	const renderFrameSourceListItem = useMemo(
		() =>
			buildRenderSourceListSlotItem("frame", (option) => {
				const framePopoverState = getPopoverLimitState(
					currentFrameImages,
					option.slotIndex,
					maxFrameImages,
				)
				return {
					slotKey: option.value,
					currentFiles: framePopoverState.currentFiles,
					maxReferenceFiles: maxFrameImages,
					isLimitReached: framePopoverState.isLimitReached,
					referenceResourceType: "image" as const,
					referenceFileInfos: frameImageInfos.filter(
						Boolean,
					) as VideoEditorConfig["referenceImageInfos"],
					referenceAssetKinds: ["image"],
				}
			}),
		[
			buildRenderSourceListSlotItem,
			currentFrameImages,
			frameImageInfos,
			getPopoverLimitState,
			maxFrameImages,
		],
	)

	const renderReferenceSourceListItem = useMemo(
		() => buildRenderSourceListSlotItem("reference", resolveReferencePopoverState),
		[buildRenderSourceListSlotItem, resolveReferencePopoverState],
	)

	const handleTopPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (!onFocusEditor) return
			const target = event.target
			if (!(target instanceof Element)) return
			if (target.closest("[data-video-editor-source-list]")) return
			onFocusEditor()
		},
		[onFocusEditor],
	)
	const resolveSourceListOverflowTargets = useCallback(
		(scroller: HTMLDivElement) => [scroller.firstElementChild],
		[],
	)
	const handleSourceListOverflowChange = useCallback(
		(hasOverflow: boolean) => {
			setHasSourceListScrollbar(hasOverflow)
			onSourceListScrollbarChange?.(hasOverflow)
		},
		[onSourceListScrollbarChange],
	)
	const { checkOverflow: checkSourceListScrollbar } = useOverflowChange({
		targetRef: sourceListScrollerRef,
		axis: "x",
		enabled: showTopImageInputs,
		onOverflowChange: handleSourceListOverflowChange,
		observeTargets: resolveSourceListOverflowTargets,
	})

	useEffect(() => {
		checkSourceListScrollbar()
	}, [
		checkSourceListScrollbar,
		activeInputTab,
		frameOptions.length,
		referenceAssetOptions.length,
	])

	const sourceList = showTopImageInputs ? (
		<div className={styles.top} onPointerDown={handleTopPointerDown}>
			<div
				ref={sourceListScrollerRef}
				className={styles.sourceListScroller}
				data-has-scrollbar={hasSourceListScrollbar ? "" : undefined}
			>
				<div className={styles.sourceListScrollerContent}>
					{activeInputTab === "frame" && frameOptions.length > 0 && (
						<SourceList
							options={frameOptions}
							renderItem={renderFrameSourceListItem}
							resolveResourceReference={resolveResourceReference}
						/>
					)}
					{activeInputTab === "reference" && referenceAssetOptions.length > 0 && (
						<SourceList
							options={referenceAssetOptions}
							renderItem={renderReferenceSourceListItem}
							resolveResourceReference={resolveResourceReference}
						/>
					)}
				</div>
			</div>
		</div>
	) : null

	return (
		<>
			{sourceListContainer && sourceList
				? createPortal(sourceList, sourceListContainer)
				: null}
			<div className={styles.controllers} data-testid="video-generate-editor-controls">
				{sourceListContainer === undefined ? sourceList : null}
				<div className={styles.bottom}>
					<div className={styles.left}>
						<EditorModelSelect
							selectedModelId={selectedModelId}
							modelOptions={modelOptions}
							modelOptionGroups={modelOptionGroups}
							selectedModelOption={selectedModelOption}
							onModelChange={handlers.handleModelChange}
						/>
						{shouldShowModeSelect && selectedInputModeForSelect && (
							<Select
								value={selectedInputModeForSelect}
								onValueChange={handleInputModeSelect}
							>
								<SelectTrigger className={styles.modeSelectTrigger}>
									{getInputModeLabel(selectedInputModeForSelect, inputModeLabels)}
								</SelectTrigger>
								<SelectContent className={styles.modeSelectContent}>
									{inputModesForSelect.map((inputMode) => (
										<SelectItem
											key={inputMode}
											value={inputMode}
											className={styles.modeSelectItem}
											data-testid={`video-generate-editor-mode-${inputMode}`}
										>
											{getInputModeLabel(inputMode, inputModeLabels)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{hasDraft && (
							<Switch
								className={styles.draftModeSwitch}
								checked={selectedDraft === true}
								onCheckedChange={handlers.handleDraftChange}
								disabled={!canEnableDraft}
								title={draftConfig?.description}
								data-testid="video-generate-editor-draft-mode"
							>
								<span className={styles.draftModeSwitchLabel}>{draftLabel}</span>
							</Switch>
						)}
					</div>
					<div className={styles.right}>
						{renderRestoreDefaultConfigButton && renderRestoreDefaultConfigButton()}
						<VideoGenerationSettingsPopover config={config} />
						{renderPromptOptimizationButton && renderPromptOptimizationButton()}
						{renderSendButton && renderSendButton()}
					</div>
				</div>
			</div>
		</>
	)
}

function getInputModeLabel(
	inputMode: Exclude<VideoInputMode, "standard">,
	labels: {
		framesLabel: string
		videoEditLabel: string
		referenceImageLabel: string
		referenceAssetLabel: string
	},
): string {
	if (inputMode === "image_reference") return labels.referenceImageLabel
	if (inputMode === "omni_reference") return labels.referenceAssetLabel
	if (inputMode === "video_edit") return labels.videoEditLabel
	return labels.framesLabel
}
