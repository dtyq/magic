import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select"
import styles from "./index.module.css"
import { ChevronsUpDown } from "lucide-react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import ResolutionSelect from "../ui/custom/ResolutionSelect"
import EditorModelSelect from "../GenerateEditor/EditorModelSelect"
import type { ImageEditorConfig } from "./useImageEditorConfig"
import ReferenceResourceSlotPopover from "../MessageEditor/reference-assets/ReferenceResourceSlotPopover"
import type { ReferenceResourceSourceType } from "../MessageEditor/reference-assets/reference-resource.types"
import type { ReferenceResourcePanelItem } from "../../types"
import SizeIconPreview from "../ui/custom/SizeIconPreview"
import SourceList, { type SourceListOption, type SourceListRenderItemParams } from "../SourceList"

interface ImageEditorReferencePopoverState {
	slotKey: string
	currentFiles: string[]
	maxReferenceFiles: number | undefined
	isLimitReached: boolean
}

interface ImageEditorReferenceSlotPopoverProps {
	className: string
	style: CSSProperties
	content: ReactNode
	slotKey: string
	isPopoverOpen: boolean
	selectedSlotKey: string | null
	onSelectSlot: (slotKey: string) => void
	onPopoverOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	referencePopoverState: ImageEditorReferencePopoverState
	referenceResourceType: ImageEditorConfig["referenceResourceType"]
	referenceFileInfos: ImageEditorConfig["referenceFileInfos"]
	onProjectSelect?: (item: ReferenceResourcePanelItem) => void
	slotRootRef?: SourceListRenderItemParams["slotRootRef"]
}

function ImageEditorReferenceSlotPopover(props: ImageEditorReferenceSlotPopoverProps) {
	const {
		className,
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
		slotRootRef,
	} = props

	return (
		<ReferenceResourceSlotPopover
			className={className}
			style={style}
			content={content}
			slotKey={slotKey}
			slotRootRef={slotRootRef}
			isPopoverOpen={isPopoverOpen}
			selectedSlotKey={selectedSlotKey}
			onActivateSlot={() => onSelectSlot(slotKey)}
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
		/>
	)
}

interface ImageEditorControlsProps {
	config: ImageEditorConfig
	protectedReferenceFileIndex?: number
	onSelectSource: (source: ReferenceResourceSourceType) => void
	onProjectSelect?: (item: ReferenceResourcePanelItem) => void
	/** 参考文件删除回调，传入时优先使用（用于同步到 TipTap） */
	onReferenceFileRemove?: (path: string) => void
	renderSendButton?: () => React.ReactNode
}

export default function ImageEditorControls(props: ImageEditorControlsProps) {
	const {
		config,
		protectedReferenceFileIndex,
		onSelectSource,
		onProjectSelect,
		onReferenceFileRemove,
		renderSendButton,
	} = props
	const { t } = useCanvasDesignI18n()

	const {
		selectedModelId,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		maxReferenceFiles,
		currentReferenceFiles,
		referenceFileInfos,
		supportedResolutionOptions,
		supportedImageSettingOptions,
		supportedAspectRatioOptions,
		selectedImageGenerationConfig,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		referenceResourceType,
		handlers,
	} = config
	const [selectedReferenceSlotKey, setSelectedReferenceSlotKey] = useState<string | null>(null)

	useEffect(() => {
		if (!isPopoverOpen) {
			setSelectedReferenceSlotKey(null)
		}
	}, [isPopoverOpen])

	const canAddReferenceFile =
		maxReferenceFiles === undefined || currentReferenceFiles.length < maxReferenceFiles

	const referenceSourceListOptions = useMemo<SourceListOption[]>(() => {
		if (!maxReferenceFiles || maxReferenceFiles <= 0) {
			return []
		}

		const options: SourceListOption[] = referenceFileInfos.map((info, index) => {
			const isProtected =
				protectedReferenceFileIndex !== undefined && index === protectedReferenceFileIndex

			return {
				kind: "slot",
				label: t("imageEditor.referenceImage", "参考图"),
				value: `image-reference-${index}-${info.path}`,
				slotIndex: index,
				resourcePath: info.path,
				resourceFileName: info.fileName,
				...(isProtected
					? {}
					: {
							removeResourceAriaLabel: t(
								"imageEditor.removeReferenceResource",
								"移除该参考资源",
							),
							onRemoveResource: () => {
								;(onReferenceFileRemove ?? handlers.handleReferenceFileRemove)(
									info.path,
								)
							},
						}),
			}
		})

		if (canAddReferenceFile) {
			options.push({
				kind: "slot",
				label: t("imageEditor.referenceImage", "参考图"),
				secondaryLabel:
					maxReferenceFiles !== undefined && currentReferenceFiles.length > 0
						? `(${currentReferenceFiles.length}/${maxReferenceFiles})`
						: undefined,
				value: `image-reference-empty-${currentReferenceFiles.length}`,
				slotIndex: currentReferenceFiles.length,
			})
		}

		return options
	}, [
		maxReferenceFiles,
		referenceFileInfos,
		protectedReferenceFileIndex,
		t,
		onReferenceFileRemove,
		handlers.handleReferenceFileRemove,
		canAddReferenceFile,
		currentReferenceFiles.length,
	])

	const resolveReferencePopoverState = useCallback(
		(option: { slotIndex: number; value: string }): ImageEditorReferencePopoverState => {
			const slotPath = currentReferenceFiles[option.slotIndex]
			const filesWithoutSlot = slotPath
				? currentReferenceFiles.filter((path) => path !== slotPath)
				: currentReferenceFiles

			return {
				slotKey: option.value,
				currentFiles: filesWithoutSlot,
				maxReferenceFiles,
				isLimitReached:
					maxReferenceFiles !== undefined && filesWithoutSlot.length >= maxReferenceFiles,
			}
		},
		[currentReferenceFiles, maxReferenceFiles],
	)

	const renderReferenceSourceListItem = useCallback(
		(params: SourceListRenderItemParams) => {
			const { option, className, style, content, slotRootRef } = params
			const isProtected =
				protectedReferenceFileIndex !== undefined &&
				option.slotIndex === protectedReferenceFileIndex

			if (isProtected) {
				return (
					<div ref={slotRootRef} className={className} style={style}>
						{content}
					</div>
				)
			}

			const referencePopoverState = resolveReferencePopoverState(option)
			return (
				<ImageEditorReferenceSlotPopover
					className={className}
					style={style}
					content={content}
					slotKey={referencePopoverState.slotKey}
					isPopoverOpen={isPopoverOpen}
					selectedSlotKey={selectedReferenceSlotKey}
					onSelectSlot={setSelectedReferenceSlotKey}
					onPopoverOpenChange={handlers.setPopoverOpen}
					onMouseEnter={handlers.handlePopoverMouseEnter}
					onMouseLeave={handlers.handlePopoverMouseLeave}
					onSelectSource={onSelectSource}
					referencePopoverState={referencePopoverState}
					referenceResourceType={referenceResourceType}
					referenceFileInfos={referenceFileInfos}
					onProjectSelect={onProjectSelect}
					slotRootRef={slotRootRef}
				/>
			)
		},
		[
			resolveReferencePopoverState,
			protectedReferenceFileIndex,
			isPopoverOpen,
			selectedReferenceSlotKey,
			handlers.setPopoverOpen,
			handlers.handlePopoverMouseEnter,
			handlers.handlePopoverMouseLeave,
			onSelectSource,
			referenceResourceType,
			referenceFileInfos,
			onProjectSelect,
		],
	)

	return (
		<>
			<div className={styles.controllers}>
				{referenceSourceListOptions.length > 0 && (
					<div className={styles.top}>
						<div className={styles.sourceListScroller}>
							<div className={styles.sourceListScrollerContent}>
								<SourceList
									options={referenceSourceListOptions}
									renderItem={renderReferenceSourceListItem}
								/>
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
					</div>
					<div className={styles.right}>
						{supportedImageSettingOptions.map((setting) => {
							const defaultOption = setting.options.find(
								(option) => option.value === setting.default,
							)
							const selectedValue =
								selectedImageGenerationConfig[setting.requestKey] ||
								defaultOption?.value ||
								setting.options[0]?.value ||
								""
							const selectedOption = setting.options.find(
								(option) => option.value === selectedValue,
							)
							const testIdKey = getSettingTestIdKey(setting.requestKey)

							return (
								<Select
									key={setting.key}
									value={selectedValue}
									onValueChange={(value) =>
										handlers.handleImageSettingChange(setting.requestKey, value)
									}
								>
									<SelectTrigger
										className={styles.selectTrigger}
										data-testid={`image-editor-${testIdKey}-setting-trigger`}
									>
										<span className={styles.selectTriggerText}>
											{selectedOption?.label || selectedValue}
										</span>
										<ChevronsUpDown size={16} />
									</SelectTrigger>
									<SelectContent
										className={styles.selectContent}
										style={{ minWidth: 160 }}
									>
										<div className={styles.selectContentName}>
											{setting.label}
										</div>
										{setting.options.map((option) => (
											<SelectItem
												key={option.value}
												value={option.value}
												className={styles.selectOptionItem}
												data-testid={`image-editor-${testIdKey}-setting-option`}
											>
												<span>{option.label}</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)
						})}
						{/* 分辨率选择 */}
						<ResolutionSelect
							options={supportedResolutionOptions}
							value={config.selectedResolution}
							onValueChange={handlers.handleResolutionChange}
						/>
						{/* 比例选择 */}
						{supportedAspectRatioOptions.length > 0 && (
							<Select
								value={currentSelectValue || ""}
								onValueChange={handlers.handleRatioChange}
							>
								<SelectTrigger className={styles.selectTrigger}>
									<span className={styles.selectTriggerText}>
										{ratioOption?.label || t("imageEditor.custom", "自定义")}
									</span>
									<ChevronsUpDown size={16} />
								</SelectTrigger>
								<SelectContent
									className={styles.selectContent}
									style={{ minWidth: 200 }}
								>
									<div className={styles.selectContentName}>
										{t("imageEditor.size", "尺寸")}
									</div>
									{supportedAspectRatioOptions.map((option) => {
										if (!option || !option.value) return null
										return (
											<SelectItem
												key={option.value}
												value={option.value}
												className={styles.selectOptionItem}
											>
												<div className={styles.ratioOptionItemContent}>
													<SizeIconPreview
														iconWidth={option.iconWidth}
														iconHeight={option.iconHeight}
														wrapperClassName={styles.icon}
														iconClassName={styles.iconContent}
													/>
													<div
														className={styles.label}
														style={{ width: 60 }}
													>
														{option.label}
													</div>
													<div className={styles.size}>
														{option.width}x{option.height}
													</div>
												</div>
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						)}
						{renderSendButton && renderSendButton()}
					</div>
				</div>
			</div>
		</>
	)
}

function getSettingTestIdKey(key: string): string {
	return key
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()
}
