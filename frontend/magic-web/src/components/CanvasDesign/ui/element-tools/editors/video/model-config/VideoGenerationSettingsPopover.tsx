import { useMemo } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/shadcn/popover"
import { Slider } from "@/components/shadcn-ui/slider"
import { Switch } from "@/components/shadcn-ui/switch"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import type { VideoEditorConfig } from "../video-editor-config.types"
import type { VideoGenerationDurationRange } from "../../../../../public/magic-types"
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

interface DurationRangeControlProps {
	label: string
	value: number | undefined
	range: VideoGenerationDurationRange
	onChange: (seconds: number) => void
	onCommit: (seconds: number) => void
}

function DurationRangeControl(props: DurationRangeControlProps) {
	const { label, value, range, onChange, onCommit } = props
	const initialSeconds = value ?? range.min

	return (
		<>
			<div className={styles.sectionHeader}>
				<div className={styles.sectionTitle}>{label}</div>
				<div className={styles.rangeValue}>{`${initialSeconds}s`}</div>
			</div>
			<div className={styles.rangeControl}>
				<Slider
					value={[initialSeconds]}
					min={range.min}
					max={range.max}
					step={range.step}
					onValueChange={([next]) => onChange(next)}
					onValueCommit={([next]) => onCommit(next)}
					aria-label={label}
				/>
			</div>
		</>
	)
}

export function VideoGenerationSettingsPopover(props: VideoGenerationSettingsPopoverProps) {
	const { config } = props
	const { t } = useCanvasDesignI18n()

	const {
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedDurationOptions,
		durationType,
		durationRange,
		supportedCompressionQualityOptions,
		selectedResolution,
		selectedDurationSeconds,
		durationDraftSeconds,
		selectedGenerateAudio,
		selectedWebSearch,
		selectedCompressionQuality,
		currentSelectValue,
		ratioOption,
		handlers,
	} = config

	const hasAspect = supportedAspectRatioOptions.length > 0
	const hasResolution = supportedResolutionOptions.length > 0
	const hasDuration = supportedDurationOptions.length > 0
	const hasQuality = supportedCompressionQualityOptions.length > 0
	const hasAudio = selectedGenerateAudio !== undefined
	const hasWebSearch = selectedWebSearch !== undefined

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

	if (!hasAspect && !hasResolution && !hasDuration && !hasQuality && !hasAudio && !hasWebSearch)
		return null

	return (
		<Popover onOpenChange={handlers.handleDurationPopoverOpenChange}>
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
						{durationType === "range" && durationRange ? (
							<DurationRangeControl
								label={t("videoEditor.duration", "时长")}
								value={durationDraftSeconds ?? selectedDurationSeconds}
								range={durationRange}
								onChange={handlers.handleDurationDraftChange}
								onCommit={handlers.handleDurationChange}
							/>
						) : (
							<>
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
												onClick={() =>
													handlers.handleDurationChange(seconds)
												}
											>
												{`${seconds}s`}
											</button>
										)
									})}
								</div>
							</>
						)}
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

				{hasAudio && (
					<div className={styles.section}>
						<label className={styles.switchRow}>
							<span className={styles.sectionTitle}>
								{t("videoEditor.generateAudio", "音频")}
							</span>
							<Switch
								checked={selectedGenerateAudio}
								onCheckedChange={handlers.handleGenerateAudioChange}
							/>
						</label>
					</div>
				)}

				{hasWebSearch && (
					<div className={styles.section}>
						<label className={styles.switchRow}>
							<span className={styles.sectionTitle}>
								{t("videoEditor.webSearch", "网络搜索")}
							</span>
							<Switch
								checked={selectedWebSearch}
								onCheckedChange={handlers.handleWebSearchChange}
							/>
						</label>
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}
