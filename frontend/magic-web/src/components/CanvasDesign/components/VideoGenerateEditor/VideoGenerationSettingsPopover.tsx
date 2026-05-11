import { useMemo } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import type { VideoEditorConfig } from "./video-editor-config.types"
import styles from "./VideoGenerationSettingsPopover.module.css"

interface VideoGenerationSettingsPopoverProps {
	config: VideoEditorConfig
}

function buildTriggerSummaryLabel(input: {
	aspectLabel?: string
	durationSeconds?: number
	resolution?: string
	quality?: string
	fallback: string
}): string {
	const segments: string[] = []
	if (input.aspectLabel) segments.push(input.aspectLabel)
	if (input.durationSeconds != null && Number.isFinite(input.durationSeconds)) {
		segments.push(`${input.durationSeconds}s`)
	}
	if (input.resolution) segments.push(input.resolution)
	if (input.quality) segments.push(input.quality)
	if (segments.length === 0) return input.fallback
	return segments.join(" · ")
}

export function VideoGenerationSettingsPopover(props: VideoGenerationSettingsPopoverProps) {
	const { config } = props
	const { t } = useCanvasDesignI18n()

	const {
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedDurationOptions,
		supportedCompressionQualityOptions,
		selectedResolution,
		selectedDurationSeconds,
		selectedCompressionQuality,
		currentSelectValue,
		ratioOption,
		handlers,
	} = config

	const hasAspect = supportedAspectRatioOptions.length > 0
	const hasResolution = supportedResolutionOptions.length > 0
	const hasDuration = supportedDurationOptions.length > 0
	const hasQuality = supportedCompressionQualityOptions.length > 0

	const fallbackTriggerLabel = t("videoEditor.generationSettings", "生成设置")

	const aspectLabel = ratioOption?.label || currentSelectValue || undefined

	const triggerLabel = useMemo(
		() =>
			buildTriggerSummaryLabel({
				aspectLabel: hasAspect ? aspectLabel : undefined,
				durationSeconds: hasDuration ? selectedDurationSeconds : undefined,
				resolution: hasResolution ? selectedResolution : undefined,
				quality: hasQuality ? selectedCompressionQuality : undefined,
				fallback: fallbackTriggerLabel,
			}),
		[
			aspectLabel,
			fallbackTriggerLabel,
			hasAspect,
			hasDuration,
			hasQuality,
			hasResolution,
			selectedCompressionQuality,
			selectedDurationSeconds,
			selectedResolution,
		],
	)

	if (!hasAspect && !hasResolution && !hasDuration && !hasQuality) return null

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={styles.trigger}
					aria-label={t("videoEditor.generationSettingsAria", "视频生成参数")}
				>
					<span className={styles.triggerText}>{triggerLabel}</span>
					<ChevronsUpDown size={16} aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={6} className={styles.popoverContent}>
				{hasAspect && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("videoEditor.aspectRatio", "比例")}
						</div>
						<div className={styles.buttonGroup} role="group">
							{supportedAspectRatioOptions.map((option) => {
								if (!option?.value) return null
								const isActive = currentSelectValue === option.value
								return (
									<button
										key={option.value}
										type="button"
										className={`${styles.buttonGroupItem} ${
											isActive ? styles.buttonGroupItemActive : ""
										}`}
										onClick={() => handlers.handleRatioChange(option.value)}
									>
										<span className={styles.aspectButtonInner}>
											<span
												className={styles.aspectIconBox}
												style={{
													width: `${option.iconWidth}px`,
													height: `${option.iconHeight}px`,
												}}
											/>
											<span>{option.label}</span>
										</span>
									</button>
								)
							})}
						</div>
					</div>
				)}

				{hasResolution && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("videoEditor.resolution", "分辨率")}
						</div>
						<div className={styles.buttonGroup} role="group">
							{supportedResolutionOptions.map((option) => {
								if (!option?.value) return null
								const isActive = selectedResolution === option.value
								return (
									<button
										key={option.value}
										type="button"
										className={`${styles.buttonGroupItem} ${
											isActive ? styles.buttonGroupItemActive : ""
										}`}
										onClick={() =>
											handlers.handleResolutionChange(option.value)
										}
									>
										{option.label}
									</button>
								)
							})}
						</div>
					</div>
				)}

				{hasDuration && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("videoEditor.duration", "时长")}
						</div>
						<div className={styles.buttonGroup} role="group">
							{supportedDurationOptions.map((seconds) => {
								const isActive = selectedDurationSeconds === seconds
								return (
									<button
										key={seconds}
										type="button"
										className={`${styles.buttonGroupItem} ${
											isActive ? styles.buttonGroupItemActive : ""
										}`}
										onClick={() => handlers.handleDurationChange(seconds)}
									>
										{`${seconds}s`}
									</button>
								)
							})}
						</div>
					</div>
				)}

				{hasQuality && (
					<div className={styles.section}>
						<div className={styles.sectionTitle}>
							{t("videoEditor.quality", "画质")}
						</div>
						<div className={styles.buttonGroup} role="group">
							{supportedCompressionQualityOptions.map((value) => {
								const isActive = selectedCompressionQuality === value
								return (
									<button
										key={value}
										type="button"
										className={`${styles.buttonGroupItem} ${
											isActive ? styles.buttonGroupItemActive : ""
										}`}
										onClick={() =>
											handlers.handleCompressionQualityChange(value)
										}
									>
										{value}
									</button>
								)
							})}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}
