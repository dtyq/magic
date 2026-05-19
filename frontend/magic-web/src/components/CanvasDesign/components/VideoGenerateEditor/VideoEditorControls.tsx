import { ArrowLeftRight, LoaderCircle, X } from "lucide-react"
import type { CSSProperties, ForwardedRef, PointerEvent, ReactNode, RefCallback } from "react"
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import EditorModelSelect from "../GenerateEditor/EditorModelSelect"
import type { VideoEditorConfig, VideoReferenceAssetKind } from "./video-editor-config.types"
import type { VideoInputMode } from "../../types.magic"
import styles from "./index.module.css"
import sourceListStyles from "../SourceList/SourceList.module.css"
import SourceList, {
	type SourceListOption,
	type SourceListRenderItemParams,
	type SourceListSlotOption,
} from "../SourceList"
import { VideoGenerationSettingsPopover } from "./VideoGenerationSettingsPopover"
import ReferenceResourceSlotPopover from "../MessageEditor/reference-assets/ReferenceResourceSlotPopover"
import type {
	ReferenceResourceSourceType,
	ReferenceResourceType,
} from "../MessageEditor/reference-assets/reference-resource.types"
import type { ReferenceResourcePanelItem, ReferenceResourcePanelSelectContext } from "../../types"
import { cn } from "../../lib/utils"
import { useOverflowChange } from "../../hooks/useOverflowChange"

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
	assetLimits?: VideoEditorConfig["referenceAssetLimits"]
	currentAssetCounts?: VideoEditorConfig["referenceAssetCounts"]
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	onProjectSelectPanelOpenChange: (open: boolean) => void
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
		assetLimits,
		currentAssetCounts,
		onProjectSelect,
		onProjectSelectPanelOpenChange,
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
				})
			}
			onPopoverOpenChange={onPopoverOpenChange}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onSelectSource={onSelectSource}
			maxReferenceFiles={maxReferenceFiles}
			currentReferenceFiles={currentReferenceFiles}
			isReferenceFileLimitReached={isReferenceFileLimitReached}
			referenceResourceType={referenceResourceType}
			referenceFileInfos={referenceFileInfos}
			assetLimits={assetLimits}
			currentAssetCounts={currentAssetCounts}
			onProjectSelect={onProjectSelect}
			onProjectSelectPanelOpenChange={onProjectSelectPanelOpenChange}
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

/** 视频编辑器底部工具区：模型、输入 Tab、参考图与发送区 */
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
		},
	) => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	renderSendButton?: () => React.ReactNode
	/** 点击顶部栏空白区域（非 SourceList）时聚焦提示词编辑器 */
	onFocusEditor?: () => void
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
		onFocusEditor,
	} = props
	const { t } = useCanvasDesignI18n()
	const sourceListScrollerRef = useRef<HTMLDivElement | null>(null)
	const [hasSourceListScrollbar, setHasSourceListScrollbar] = useState(false)
	const {
		selectedModelId,
		selectedInputMode,
		availableInputModes,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		activeInputTab,
		supportsEndFrame,
		maxFrameImages,
		currentFrameImages,
		frameImageInfos,
		maxReferenceImages,
		referenceImageInfos,
		referenceAssetLimits,
		referenceAssetCounts,
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

	/** 文生视频走提示词，不作为模式 Tab 展示；仅展示需切换素材类型的模式 */
	const inputModesForTabs = useMemo(
		() => availableInputModes.filter((mode) => mode !== "standard"),
		[availableInputModes],
	)
	const shouldShowModeTabs =
		inputModesForTabs.length > 0 &&
		(inputModesForTabs.length > 1 || availableInputModes.includes("standard"))

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
	const supportedReferenceKinds = useMemo(
		() =>
			[
				supportsReferenceImages ? "image" : null,
				supportsReferenceVideos ? "video" : null,
				supportsReferenceAudios ? "audio" : null,
			].filter((item): item is VideoReferenceAssetKind => Boolean(item)),
		[supportsReferenceAudios, supportsReferenceImages, supportsReferenceVideos],
	)
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
							resourceFileName: frameImageInfos[idx]?.fileName,
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
							resourceFileName: frameImageInfos[idx]?.fileName,
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
		currentFrameImages,
		frameImageInfos,
		removeSlotAriaLabel,
		handlers,
		t,
	])

	const referenceAssetOptions = useMemo((): SourceListOption[] => {
		if (!supportsReferenceAssets) return []
		const totalCount = referenceImageInfos.length
		const totalLimitReached =
			maxReferenceImages !== undefined && totalCount >= maxReferenceImages
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

		referenceImageInfos.forEach((info, index) => {
			existingItemsByType[info.assetType].push({ info, index })
		})

		const getTypeMax = (kind: VideoReferenceAssetKind): number | undefined => {
			const range =
				kind === "image"
					? referenceAssetLimits.reference_images
					: kind === "video"
						? referenceAssetLimits.reference_videos
						: referenceAssetLimits.reference_audios
			if (!Number.isFinite(range.max)) return undefined
			return range.max > 0 ? range.max : undefined
		}

		const getTypeCount = (kind: VideoReferenceAssetKind): number => {
			if (kind === "image") return referenceAssetCounts.images
			if (kind === "video") return referenceAssetCounts.videos
			return referenceAssetCounts.audios
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
		for (const kind of supportedReferenceKinds) {
			const items = existingItemsByType[kind]
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
					removeResourceAriaLabel: removeSlotAriaLabel,
					onRemoveResource: () => handlers.handleReferenceImageRemove(info.path),
				})
			})

			const canAddMoreOfType =
				!totalLimitReached && (maxCount === undefined || typeCount < maxCount)
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
		maxReferenceImages,
		referenceImageInfos,
		referenceAssetLimits,
		referenceAssetCounts,
		supportedReferenceKinds,
		referenceSlotLabelByType,
		removeSlotAriaLabel,
		handlers,
	])

	const selectedResourceSlotKey = selectedResourceSlot
		? selectedResourceSlot.slotKey ||
			`${selectedResourceSlot.inputTab}-${selectedResourceSlot.slotIndex}`
		: null

	const resolveReferencePopoverState = useCallback(
		(option: SourceListSlotOption) => {
			const referenceAssetKind = (option.groupId || "image") as VideoReferenceAssetKind
			const allowedInfos = referenceImageInfos.filter(
				(info) => info.assetType === referenceAssetKind,
			)
			const currentInfos = allowedInfos.filter(
				(info, index) => !option.resourcePath || index !== option.slotIndex,
			)
			const currentAssetCounts = currentInfos.reduce(
				(acc, info) => {
					if (info.assetType === "image") acc.images++
					else if (info.assetType === "video") acc.videos++
					else acc.audios++
					return acc
				},
				{ images: 0, videos: 0, audios: 0 },
			)
			const typeRange =
				referenceAssetKind === "image"
					? referenceAssetLimits.reference_images
					: referenceAssetKind === "video"
						? referenceAssetLimits.reference_videos
						: referenceAssetLimits.reference_audios
			const totalMax = referenceAssetLimits.total.max
			const effectiveMax = Number.isFinite(typeRange.max)
				? Math.min(Math.max(typeRange.max, 0), totalMax)
				: totalMax
			const usedCount =
				referenceAssetKind === "image"
					? currentAssetCounts.images
					: referenceAssetKind === "video"
						? currentAssetCounts.videos
						: currentAssetCounts.audios
			const hasRemainingCapacity =
				!Number.isFinite(typeRange.max) || usedCount < typeRange.max
			return {
				slotKey: option.value,
				referenceAssetKind,
				currentFiles: currentInfos.map((info) => info.path),
				maxReferenceFiles:
					Number.isFinite(effectiveMax) && effectiveMax > 0 ? effectiveMax : undefined,
				isLimitReached:
					(Number.isFinite(totalMax) && currentInfos.length >= totalMax) ||
					!hasRemainingCapacity,
				referenceResourceType: referenceResourceTypeByKind[referenceAssetKind],
				referenceFileInfos: allowedInfos,
				assetLimits: referenceAssetLimits,
				currentAssetCounts,
			}
		},
		[referenceAssetLimits, referenceImageInfos, referenceResourceTypeByKind],
	)

	const buildRenderSourceListSlotItem = useCallback(
		(
			inputTab: "frame" | "reference",
			resolvePopoverState: (option: SourceListSlotOption) => {
				slotKey: string
				referenceAssetKind?: VideoReferenceAssetKind
				currentFiles: string[]
				maxReferenceFiles?: number
				isLimitReached: boolean
				referenceResourceType: ReferenceResourceType
				referenceFileInfos: VideoEditorConfig["referenceImageInfos"]
				assetLimits?: VideoEditorConfig["referenceAssetLimits"]
				currentAssetCounts?: VideoEditorConfig["referenceAssetCounts"]
			},
		) => {
			return function renderSourceListSlotItem(params: SourceListRenderItemParams) {
				const { option, className, style, content, slotRootRef } = params
				const {
					slotKey,
					referenceAssetKind,
					currentFiles,
					maxReferenceFiles,
					isLimitReached,
					referenceResourceType: slotReferenceResourceType,
					referenceFileInfos: slotReferenceFileInfos,
					assetLimits,
					currentAssetCounts,
				} = resolvePopoverState(option)
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
				return (
					<VideoEditorReferenceSlotPopover
						inputTab={inputTab}
						option={option}
						slotKey={slotKey}
						className={cn(
							className,
							option.resourcePath === hoveredMentionPath &&
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
						assetLimits={assetLimits}
						currentAssetCounts={currentAssetCounts}
						onProjectSelect={onProjectSelect}
						onProjectSelectPanelOpenChange={handlers.setReferenceProjectPanelOpen}
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

	const showTopImageInputs = supportsStartFrame || supportsEndFrame || supportsReferenceAssets

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

	return (
		<div className={styles.controllers} data-testid="video-generate-editor-controls">
			{showTopImageInputs && (
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
								/>
							)}
							{activeInputTab === "reference" && referenceAssetOptions.length > 0 && (
								<SourceList
									options={referenceAssetOptions}
									renderItem={renderReferenceSourceListItem}
								/>
							)}
						</div>
					</div>
				</div>
			)}
			<div className={styles.bottom}>
				<div className={styles.left}>
					<EditorModelSelect
						selectedModelId={selectedModelId}
						modelOptions={modelOptions}
						modelOptionGroups={modelOptionGroups}
						selectedModelOption={selectedModelOption}
						onModelChange={handlers.handleModelChange}
					/>
					{shouldShowModeTabs && (
						<div className={styles.tabsList} role="tablist">
							{inputModesForTabs.map((inputMode) => (
								<button
									key={inputMode}
									type="button"
									role="tab"
									aria-selected={selectedInputMode === inputMode}
									className={styles.tabsTrigger}
									data-state={
										selectedInputMode === inputMode ? "active" : undefined
									}
									data-testid={`video-generate-editor-mode-${inputMode}`}
									onClick={() => handlers.handleInputModeChange(inputMode)}
								>
									{getInputModeLabel(inputMode, {
										framesLabel: t("videoEditor.frames", "首尾帧"),
										videoEditLabel: t("videoEditor.videoEdit", "视频编辑"),
										referenceImageLabel: t(
											"videoEditor.referenceImage",
											"参考图",
										),
										referenceAssetLabel: t(
											"videoEditor.referenceAsset",
											"全能模式",
										),
									})}
								</button>
							))}
						</div>
					)}
				</div>
				<div className={styles.right}>
					<VideoGenerationSettingsPopover config={config} />
					{renderSendButton && renderSendButton()}
				</div>
			</div>
		</div>
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
