import {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
	type ForwardedRef,
	type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import EditorModelSelect from "../video/model-config/EditorModelSelect"
import type { ImageEditorConfig } from "./useImageEditorConfig"
import ImageGenerationSettingsPopover from "./ImageGenerationSettingsPopover"
import ReferenceResourceSlotPopover from "../../../editors/message/reference-assets/ReferenceResourceSlotPopover"
import type { ReferenceResourceSourceType } from "../../../editors/message/reference-assets/reference-resource.types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../../public/props"
import SourceList, {
	isSourceListSlotOption,
	type SourceListOption,
	type SourceListRenderItemParams,
} from "../../../panels/source-list/index"
import sourceListStyles from "../../../panels/source-list/SourceList.module.css"
import { cn } from "../../../../runtime/shared/lib/utils"
import type {
	LinkedEditorMediaItem,
	LinkedEditorMediaKind,
} from "../../../editors/connection/linkedEditorInputs"
import {
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaPathsWithResolver,
	resolveLinkedMediaDisplay,
} from "../../../editors/connection/linkedEditorInputs"
import { useLinkedMediaSourceListOption } from "../../../editors/connection/useLinkedMediaSourceListOption"

interface ImageEditorReferencePopoverState {
	slotKey: string
	currentFiles: string[]
	maxReferenceFiles: number | undefined
	isLimitReached: boolean
}

interface ImageEditorReferenceSlotPopoverProps {
	readOnly: boolean
	className: string
	style: CSSProperties
	content: ReactNode
	slotKey: string
	isPopoverOpen: boolean
	selectedSlotKey: string | null
	onSelectSlot: () => void
	onPopoverOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	referencePopoverState: ImageEditorReferencePopoverState
	referenceResourceType: ImageEditorConfig["referenceResourceType"]
	referenceFileInfos: ImageEditorConfig["referenceFileInfos"]
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	enableProjectSelectMultiSelect?: boolean
	maxProjectSelectBatchCount?: number
	slotRootRef?: SourceListRenderItemParams["slotRootRef"]
}

const ImageEditorReferenceSlotPopover = forwardRef<
	HTMLDivElement,
	ImageEditorReferenceSlotPopoverProps
>(function ImageEditorReferenceSlotPopover(props, forwardedRef) {
	const {
		className,
		readOnly,
		style,
		content,
		slotKey,
		isPopoverOpen,
		selectedSlotKey,
		onSelectSlot,
		onPopoverOpenChange,
		onMouseEnter,
		onMouseLeave,
		onSelectSource,
		referencePopoverState,
		referenceResourceType,
		referenceFileInfos,
		onProjectSelect,
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
			includeAssetsSource={!readOnly && Boolean(referencePopoverState.maxReferenceFiles)}
			className={className}
			style={style}
			content={content}
			slotKey={slotKey}
			slotRootRef={handleSlotRootRef}
			isPopoverOpen={isPopoverOpen}
			selectedSlotKey={selectedSlotKey}
			onActivateSlot={onSelectSlot}
			onPopoverOpenChange={onPopoverOpenChange}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onSelectSource={onSelectSource}
			maxReferenceFiles={referencePopoverState.maxReferenceFiles}
			currentReferenceFiles={referencePopoverState.currentFiles}
			isReferenceFileLimitReached={referencePopoverState.isLimitReached}
			referenceResourceType={referenceResourceType}
			referenceFileInfos={referenceFileInfos}
			onProjectSelect={onProjectSelect}
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

interface ImageEditorControlsProps {
	readOnly?: boolean
	config: ImageEditorConfig
	hoveredMentionPath?: string | null
	onSelectSource: (source: ReferenceResourceSourceType) => void
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	/** 参考文件删除回调，传入时优先使用（用于同步到 TipTap） */
	onReferenceFileRemove?: (path: string) => void
	linkedMediaItems?: LinkedEditorMediaItem[]
	onLinkedMediaSelectionChange?: (connectionId: string, selected: boolean) => void
	renderPromptOptimizationButton?: () => React.ReactNode
	renderSendButton?: () => React.ReactNode
	renderRestoreDefaultConfigButton?: () => React.ReactNode
	/** 将媒体 SourceList 挂载到编辑器顶部；未传入时保留内联渲染。 */
	sourceListContainer?: HTMLElement | null
}

export default function ImageEditorControls(props: ImageEditorControlsProps) {
	const {
		config,
		readOnly = false,
		hoveredMentionPath,
		onSelectSource,
		onProjectSelect,
		onReferenceFileRemove,
		linkedMediaItems = [],
		onLinkedMediaSelectionChange,
		renderPromptOptimizationButton,
		renderSendButton,
		renderRestoreDefaultConfigButton,
		sourceListContainer,
	} = props
	const { t } = useCanvasDesignI18n()
	const { methods } = useMagic()
	const resolveResourceReference = methods?.resolveResourceReference
	const createLinkedMediaSourceListOption = useLinkedMediaSourceListOption()
	const linkedMediaKindLabelByKind = useMemo<Record<LinkedEditorMediaKind, string>>(
		() => ({
			image: t("connectionEditor.mediaKindImage", "图片"),
			video: t("connectionEditor.mediaKindVideo", "视频"),
			audio: t("connectionEditor.mediaKindAudio", "音频"),
		}),
		[t],
	)

	const {
		selectedModelId,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		maxReferenceFiles,
		currentReferenceFiles,
		referenceFileInfos,
		isPopoverOpen,
		referenceResourceType,
		handlers,
	} = config
	const [selectedReferenceSlotKey, setSelectedReferenceSlotKey] = useState<string | null>(null)
	const linkedActiveImagePaths = useMemo(
		() =>
			linkedMediaItems
				.filter(
					(item): item is LinkedEditorMediaItem & { path: string } =>
						item.status === "active" && item.kind === "image" && Boolean(item.path),
				)
				.map((item) => item.path),
		[linkedMediaItems],
	)
	const effectiveReferenceFileCount = mergeLinkedMediaPathsWithResolver(
		resolveResourceReference,
		currentReferenceFiles,
		linkedActiveImagePaths,
	).length
	const { manualItems: visibleReferenceFileInfos, linkedItems: visibleLinkedMediaItems } =
		useMemo(
			() =>
				resolveLinkedMediaDisplay(
					referenceFileInfos.map((info, index) => ({ info, index })),
					(entry) => entry.info.path,
					linkedMediaItems,
					resolveResourceReference,
				),
			[linkedMediaItems, referenceFileInfos, resolveResourceReference],
		)

	useEffect(() => {
		if (!isPopoverOpen) {
			setSelectedReferenceSlotKey(null)
		}
	}, [isPopoverOpen])

	const handleSelectReferenceSlot = useCallback(
		(option: SourceListOption) => {
			if (!isSourceListSlotOption(option)) return
			setSelectedReferenceSlotKey(option.value)
			handlers.prepareReferenceSlotSelection(option.slotIndex, {
				slotKey: option.value,
				path: option.resourcePath,
			})
		},
		[handlers],
	)

	const canAddReferenceFile =
		!readOnly &&
		(maxReferenceFiles === undefined || effectiveReferenceFileCount < maxReferenceFiles)

	const referenceSourceListOptions = useMemo<SourceListOption[]>(() => {
		if (!readOnly && (!maxReferenceFiles || maxReferenceFiles <= 0)) {
			return visibleLinkedMediaItems.map((item, index) =>
				createLinkedMediaSourceListOption({
					item,
					index,
					slotIndex: index,
					label: linkedMediaKindLabelByKind[item.kind],
					onLinkedMediaSelectionChange,
				}),
			)
		}

		const options: SourceListOption[] = visibleReferenceFileInfos.map(({ info, index }) => {
			return {
				kind: "slot",
				label: t("imageEditor.referenceImage", "参考图"),
				value: `image-reference-${index}-${info.path}`,
				slotIndex: index,
				resourcePath: info.path,
				resourceFileName: info.fileName,
				resourceMediaType: "image",
				readOnly,
				removeResourceAriaLabel: t("imageEditor.removeReferenceResource", "移除该参考资源"),
				onRemoveResource: readOnly
					? undefined
					: () => {
							;(onReferenceFileRemove ?? handlers.handleReferenceFileRemove)(
								info.path,
							)
						},
			}
		})

		const linkedOptions = visibleLinkedMediaItems.map((item, index) =>
			createLinkedMediaSourceListOption({
				item,
				index,
				slotIndex: currentReferenceFiles.length + index,
				label:
					item.kind === "image"
						? t("imageEditor.referenceImage", "参考图")
						: linkedMediaKindLabelByKind[item.kind],
				onLinkedMediaSelectionChange,
			}),
		)
		options.push(...linkedOptions)

		if (canAddReferenceFile) {
			options.push({
				kind: "slot",
				label: t("imageEditor.referenceImage", "参考图"),
				secondaryLabel:
					maxReferenceFiles !== undefined && effectiveReferenceFileCount > 0
						? `(${effectiveReferenceFileCount}/${maxReferenceFiles})`
						: undefined,
				value: `image-reference-empty-${currentReferenceFiles.length}`,
				slotIndex: currentReferenceFiles.length,
			})
		}

		return options
	}, [
		maxReferenceFiles,
		visibleReferenceFileInfos,
		visibleLinkedMediaItems,
		createLinkedMediaSourceListOption,
		linkedMediaKindLabelByKind,
		t,
		onReferenceFileRemove,
		onLinkedMediaSelectionChange,
		handlers.handleReferenceFileRemove,
		canAddReferenceFile,
		currentReferenceFiles.length,
		effectiveReferenceFileCount,
		readOnly,
	])

	const resolveReferencePopoverState = useCallback(
		(option: { slotIndex: number; value: string }): ImageEditorReferencePopoverState => {
			const slotPath = currentReferenceFiles[option.slotIndex]
			const filesWithoutSlot = slotPath
				? currentReferenceFiles.filter(
						(path) =>
							getLinkedMediaReferenceIdentity(path, resolveResourceReference) !==
							getLinkedMediaReferenceIdentity(slotPath, resolveResourceReference),
					)
				: currentReferenceFiles
			const effectiveFilesWithoutSlot = mergeLinkedMediaPathsWithResolver(
				resolveResourceReference,
				filesWithoutSlot,
				linkedActiveImagePaths,
			)

			return {
				slotKey: option.value,
				currentFiles: effectiveFilesWithoutSlot,
				maxReferenceFiles,
				isLimitReached:
					maxReferenceFiles !== undefined &&
					effectiveFilesWithoutSlot.length >= maxReferenceFiles,
			}
		},
		[
			currentReferenceFiles,
			linkedActiveImagePaths,
			maxReferenceFiles,
			resolveResourceReference,
		],
	)

	const renderReferenceSourceListItem = useCallback(
		(params: SourceListRenderItemParams) => {
			const { option, className, style, content, onClick, slotRootRef } = params
			if (option.readOnly) {
				return (
					<div ref={slotRootRef} className={className} style={style} onClick={onClick}>
						{content}
					</div>
				)
			}
			const referencePopoverState = resolveReferencePopoverState(option)
			return (
				<ImageEditorReferenceSlotPopover
					readOnly={readOnly}
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
					slotKey={referencePopoverState.slotKey}
					isPopoverOpen={isPopoverOpen}
					selectedSlotKey={selectedReferenceSlotKey}
					onSelectSlot={() => handleSelectReferenceSlot(option)}
					onPopoverOpenChange={handlers.setPopoverOpen}
					onMouseEnter={handlers.handlePopoverMouseEnter}
					onMouseLeave={handlers.handlePopoverMouseLeave}
					onSelectSource={onSelectSource}
					referencePopoverState={referencePopoverState}
					referenceResourceType={referenceResourceType}
					referenceFileInfos={referenceFileInfos}
					onProjectSelect={onProjectSelect}
					enableProjectSelectMultiSelect={!option.resourcePath}
					maxProjectSelectBatchCount={option.resourcePath ? 1 : undefined}
					slotRootRef={slotRootRef}
				/>
			)
		},
		[
			readOnly,
			resolveReferencePopoverState,
			isPopoverOpen,
			selectedReferenceSlotKey,
			handlers.setPopoverOpen,
			handlers.handlePopoverMouseEnter,
			handlers.handlePopoverMouseLeave,
			onSelectSource,
			referenceResourceType,
			referenceFileInfos,
			onProjectSelect,
			hoveredMentionPath,
			handleSelectReferenceSlot,
			resolveResourceReference,
		],
	)

	const sourceList =
		referenceSourceListOptions.length > 0 ? (
			<div className={styles.top}>
				<div className={styles.sourceListScroller}>
					<div className={styles.sourceListScrollerContent}>
						<SourceList
							options={referenceSourceListOptions}
							renderItem={renderReferenceSourceListItem}
							resolveResourceReference={resolveResourceReference}
						/>
					</div>
				</div>
			</div>
		) : null

	return (
		<>
			{sourceListContainer && sourceList
				? createPortal(sourceList, sourceListContainer)
				: null}
			<div className={styles.controllers}>
				{sourceListContainer === undefined ? sourceList : null}
				<div className={styles.bottom}>
					<div className={styles.left}>
						{readOnly && config.hasGenerationRequest && !selectedModelOption ? (
							<span className={styles.selectTrigger}>
								{t("imageEditor.modelUnavailable", "模型信息暂不可用")}
							</span>
						) : (
							<EditorModelSelect
								disabled={readOnly}
								selectedModelId={selectedModelId}
								modelOptions={modelOptions}
								modelOptionGroups={modelOptionGroups}
								selectedModelOption={selectedModelOption}
								onModelChange={handlers.handleModelChange}
							/>
						)}
					</div>
					<div className={styles.right}>
						{renderRestoreDefaultConfigButton && renderRestoreDefaultConfigButton()}
						<ImageGenerationSettingsPopover config={config} disabled={readOnly} />
						{renderPromptOptimizationButton && renderPromptOptimizationButton()}
						{renderSendButton && renderSendButton()}
					</div>
				</div>
			</div>
		</>
	)
}
