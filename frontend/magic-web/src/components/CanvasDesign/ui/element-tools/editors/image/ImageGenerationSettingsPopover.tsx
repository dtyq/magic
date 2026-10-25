import { useMemo } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/shadcn/popover"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../primitives/shadcn/select"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import type { ImageEditorConfig } from "./useImageEditorConfig"
import styles from "./ImageGenerationSettingsPopover.module.css"

interface ImageGenerationSettingsPopoverProps {
	config: ImageEditorConfig
	disabled?: boolean
}

function getAvailableSettingOptions(
	setting: ImageEditorConfig["supportedImageSettingOptions"][number],
) {
	// Radix Select reserves an empty string for its placeholder, so ignore malformed
	// options defensively while keeping the server-provided order for valid options.
	return setting.options.filter((option) => Boolean(option?.value))
}

function getSettingValue(
	setting: ImageEditorConfig["supportedImageSettingOptions"][number],
	selectedConfig: ImageEditorConfig["selectedImageGenerationConfig"],
): string {
	const options = getAvailableSettingOptions(setting)
	const selectedValue = selectedConfig[setting.requestKey]
	if (selectedValue && options.some((option) => option.value === selectedValue)) {
		return selectedValue
	}
	const defaultOption = options.find((option) => option.value === setting.default)
	return defaultOption?.value || options[0]?.value || ""
}

function isAutomaticOption(value: string, label: string): boolean {
	return value.trim().toLowerCase() === "auto" || label.trim() === "自动"
}

function getTriggerSettingLabel(
	setting: ImageEditorConfig["supportedImageSettingOptions"][number],
	selectedConfig: ImageEditorConfig["selectedImageGenerationConfig"],
): string {
	const selectedValue = getSettingValue(setting, selectedConfig)
	const options = getAvailableSettingOptions(setting)
	const label = options.find((option) => option.value === selectedValue)?.label || selectedValue
	// 自动是默认态，触发器只展示用户改过的画质和透明背景。
	if (
		(isQualitySetting(setting) || isBackgroundSetting(setting)) &&
		isAutomaticOption(selectedValue, label)
	) {
		return ""
	}
	return label
}

function getAspectSizeLabel(option: {
	width: number
	height: number
	originalValue?: string
}): string {
	if (option.originalValue) return option.originalValue
	if (option.width > 0 && option.height > 0) return `${option.width}x${option.height}`
	return ""
}

function buildTriggerSummaryLabel(segments: string[], fallback: string): string {
	const nonEmptySegments = segments.filter(Boolean)
	return nonEmptySegments.length > 0 ? nonEmptySegments.join(" · ") : fallback
}

function getSettingTestIdKey(key: string): string {
	return key
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()
}

// 模型配置里的画质是短选项（如 high / standard），和分辨率一样用按钮组点选。
const QUALITY_REQUEST_KEY = "quality"
const BACKGROUND_REQUEST_KEY = "background"

function isQualitySetting(
	setting: ImageEditorConfig["supportedImageSettingOptions"][number],
): boolean {
	return setting.requestKey === QUALITY_REQUEST_KEY
}

function isBackgroundSetting(
	setting: ImageEditorConfig["supportedImageSettingOptions"][number],
): boolean {
	return setting.requestKey === BACKGROUND_REQUEST_KEY
}

// 按钮只保留程度词，分组标题已经表达「画质」。去掉后为空时保留原文，避免按钮没有文字。
function getQualityButtonLabel(label: string): string {
	const shortened = label.replace(/画质/g, "").trim()
	return shortened || label
}

interface OptionButtonGroupProps {
	label: string
	options: Array<{ label: string; value: string }>
	value?: string
	disabled: boolean
	onChange: (value: string) => void
}

function OptionButtonGroup(props: OptionButtonGroupProps) {
	const { label, options, value, disabled, onChange } = props

	return (
		<div className={styles.buttonGroup} role="group" aria-label={label}>
			{options.map((option) => {
				if (!option.value) return null
				const isActive = value === option.value
				return (
					<button
						key={option.value}
						type="button"
						disabled={disabled}
						className={`${styles.buttonGroupItem} ${
							isActive ? styles.buttonGroupItemActive : ""
						}`}
						aria-pressed={isActive}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

export function ImageGenerationSettingsPopover(props: ImageGenerationSettingsPopoverProps) {
	const { config, disabled = false } = props
	const { t } = useCanvasDesignI18n()

	const {
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedImageSettingOptions,
		selectedImageGenerationConfig,
		selectedResolution,
		currentSelectValue,
		ratioOption,
		handlers,
	} = config

	const availableImageSettings = useMemo(
		() =>
			supportedImageSettingOptions.filter(
				(setting) => getAvailableSettingOptions(setting).length > 0,
			),
		[supportedImageSettingOptions],
	)
	const hasAspect = supportedAspectRatioOptions.some((option) => Boolean(option?.value))
	const hasResolution = supportedResolutionOptions.some((option) => Boolean(option?.value))
	const hasImageSettings = availableImageSettings.length > 0

	const selectedAspectRatioLabel = useMemo(() => {
		if (ratioOption?.label) return ratioOption.label
		if (!currentSelectValue) return undefined
		return (
			supportedAspectRatioOptions.find((option) => option.value === currentSelectValue)
				?.label || t("imageEditor.custom", "自定义")
		)
	}, [currentSelectValue, ratioOption?.label, supportedAspectRatioOptions, t])

	const selectedResolutionLabel = useMemo(
		() =>
			supportedResolutionOptions.find((option) => option.value === selectedResolution)
				?.label || selectedResolution,
		[selectedResolution, supportedResolutionOptions],
	)

	// Resolve labels from the model response so newly added dynamic settings appear without
	// requiring another frontend mapping or changing the request payload shape.
	const triggerLabel = useMemo(() => {
		const settingLabels = availableImageSettings.map((setting) =>
			getTriggerSettingLabel(setting, selectedImageGenerationConfig),
		)

		return buildTriggerSummaryLabel(
			[
				hasAspect ? selectedAspectRatioLabel || "" : "",
				hasResolution ? selectedResolutionLabel || "" : "",
				...settingLabels,
			],
			t("imageEditor.generationSettings", "生成设置"),
		)
	}, [
		hasAspect,
		hasResolution,
		selectedAspectRatioLabel,
		selectedImageGenerationConfig,
		selectedResolutionLabel,
		availableImageSettings,
		t,
	])

	if (!hasAspect && !hasResolution && !hasImageSettings) return null

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={styles.trigger}
					aria-label={t("imageEditor.generationSettingsAria", "图片生成参数")}
				>
					<span className={styles.triggerText}>{triggerLabel}</span>
					<ChevronsUpDown size={16} aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={6} className={styles.popoverContent}>
				{hasAspect && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("imageEditor.aspectRatio", "比例")}
						</div>
						<div
							className={`${styles.buttonGroup} ${styles.aspectButtonGroup}`}
							role="group"
							aria-label={t("imageEditor.aspectRatio", "比例")}
						>
							{supportedAspectRatioOptions.map((option) => {
								if (!option?.value) return null
								const isActive = currentSelectValue === option.value
								const sizeLabel = getAspectSizeLabel(option)
								return (
									<button
										key={option.value}
										type="button"
										disabled={disabled}
										className={`${styles.buttonGroupItem} ${styles.aspectButton} ${
											isActive ? styles.buttonGroupItemActive : ""
										}`}
										aria-pressed={isActive}
										onClick={() => handlers.handleRatioChange(option.value)}
									>
										<span className={styles.aspectButtonInner}>
											<span className={styles.aspectIconFrame} aria-hidden>
												<span
													className={styles.aspectIconBox}
													style={{
														width: `${option.iconWidth}px`,
														height: `${option.iconHeight}px`,
													}}
												/>
											</span>
											<span>{option.label}</span>
										</span>
										{sizeLabel ? (
											<span className={styles.aspectSize} aria-hidden>
												{sizeLabel}
											</span>
										) : null}
									</button>
								)
							})}
						</div>
					</div>
				)}

				{hasResolution && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("imageEditor.resolution", "分辨率")}
						</div>
						<OptionButtonGroup
							label={t("imageEditor.resolution", "分辨率")}
							options={supportedResolutionOptions}
							value={selectedResolution}
							disabled={disabled}
							onChange={handlers.handleResolutionChange}
						/>
					</div>
				)}

				{hasImageSettings &&
					availableImageSettings.map((setting) => {
						const selectedValue = getSettingValue(
							setting,
							selectedImageGenerationConfig,
						)
						const options = getAvailableSettingOptions(setting)
						const testIdKey = getSettingTestIdKey(setting.requestKey)
						const isBackground = isBackgroundSetting(setting)
						const sectionTitle = isBackground
							? t("imageEditor.transparentBackground", "透明背景")
							: setting.label
						const buttonOptions = isQualitySetting(setting)
							? options.map((option) => ({
									...option,
									label: getQualityButtonLabel(option.label),
								}))
							: options

						return (
							<div className={styles.section} key={setting.key}>
								<div className={styles.sectionTitle}>{sectionTitle}</div>
								{isQualitySetting(setting) || isBackground ? (
									<OptionButtonGroup
										label={sectionTitle}
										options={buttonOptions}
										value={selectedValue}
										disabled={disabled}
										onChange={(value) =>
											handlers.handleImageSettingChange(
												setting.requestKey,
												value,
											)
										}
									/>
								) : (
									<Select
										disabled={disabled}
										value={selectedValue}
										onValueChange={(value) =>
											handlers.handleImageSettingChange(
												setting.requestKey,
												value,
											)
										}
									>
										<SelectTrigger
											className={styles.selectTrigger}
											aria-label={setting.label}
											data-testid={`image-editor-${testIdKey}-setting-trigger`}
										>
											<span className={styles.selectTriggerText}>
												{options.find(
													(option) => option.value === selectedValue,
												)?.label || selectedValue}
											</span>
											<ChevronsUpDown size={16} aria-hidden />
										</SelectTrigger>
										<SelectContent
											className={styles.selectContent}
											style={{ minWidth: 160 }}
										>
											{options.map((option) => (
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
								)}
							</div>
						)
					})}
			</PopoverContent>
		</Popover>
	)
}

export default ImageGenerationSettingsPopover
