import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import type { SelfMediaPlatform } from "@/pages/superMagic/components/Detail/types"
import { getVisualPresetsForPlatform } from "@/pages/superMagic/components/Detail/components/SelfMediaRootRender/components/SelfMediaInitPanel/types"
import { PresetLayoutMark } from "@/pages/superMagic/components/Detail/components/SelfMediaRootRender/components/SelfMediaInitPanel/components/picker/PresetLayoutMark"
import { useOptionalScenePanelVariant, useSceneStateStore } from "../stores"
import { ScenePanelVariant } from "./LazyScenePanel/types"
import {
	SELF_MEDIA_CARD_COUNT_MAX,
	SELF_MEDIA_CARD_COUNT_MIN,
	SELF_MEDIA_CARD_COUNT_PRESETS,
	SELF_MEDIA_CUSTOM_CARD_COUNT,
	buildSelfMediaComposerPresetContent,
	getDefaultSelfMediaComposerConfig,
	getSelfMediaPlatformOptions,
	platformSupportsCardCount,
	resolveSelfMediaCardCount,
	type SelfMediaCardCountMode,
} from "../utils/selfMediaComposerConfig"
import SelfMediaComposerPresetPreview from "./SelfMediaComposerPresetPreview"
import {
	SelfMediaComposerConfigClearButton,
	SelfMediaComposerConfigSummary,
} from "./SelfMediaComposerConfigSummary"

const SELF_MEDIA_COMPOSER_SUFFIX_SOURCE = "self-media-composer"
const HIDDEN_VISUAL_PRESET_VALUES = new Set(["custom", "none"])

interface SelectedConfigFields {
	cardCount: boolean
	platform: boolean
	visualPreset: boolean
}

const EMPTY_SELECTED_FIELDS: SelectedConfigFields = {
	cardCount: false,
	platform: false,
	visualPreset: false,
}

function SelfMediaComposerConfigPanel({ className }: { className?: string }) {
	const { t } = useTranslation("super")
	const sceneStateStore = useSceneStateStore()
	const panelVariant = useOptionalScenePanelVariant()
	const defaults = useMemo(() => getDefaultSelfMediaComposerConfig(), [])
	const [popoverOpen, setPopoverOpen] = useState(false)
	const [platform, setPlatform] = useState<SelfMediaPlatform>(defaults.platform)
	const [visualPreset, setVisualPreset] = useState(defaults.visualPreset)
	const [cardCountMode, setCardCountMode] = useState<SelfMediaCardCountMode>(
		String(defaults.cardCount) as SelfMediaCardCountMode,
	)
	const [customCardCount, setCustomCardCount] = useState(String(defaults.cardCount))
	const [selectedFields, setSelectedFields] =
		useState<SelectedConfigFields>(EMPTY_SELECTED_FIELDS)
	const composerConfigLabels = useMemo(
		() => ({
			platform: t("detail.selfMedia.initPanel.composerConfig.fields.platform"),
			visualPreset: t("detail.selfMedia.initPanel.composerConfig.fields.visualPreset"),
			cardCount: t("detail.selfMedia.initPanel.composerConfig.fields.cardCount"),
		}),
		[t],
	)

	const platformOptions = useMemo(() => getSelfMediaPlatformOptions(), [])
	const visualPresets = useMemo(() => getVisualPresetsForPlatform(platform), [platform])
	const selectableVisualPresets = useMemo(
		() => visualPresets.filter((preset) => !HIDDEN_VISUAL_PRESET_VALUES.has(preset.value)),
		[visualPresets],
	)
	const resolvedVisualPreset = useMemo(() => {
		if (
			visualPreset &&
			selectableVisualPresets.some((preset) => preset.value === visualPreset)
		) {
			return visualPreset
		}

		return selectableVisualPresets[0]?.value ?? ""
	}, [selectableVisualPresets, visualPreset])
	const supportsCardCount = platformSupportsCardCount(platform)
	const resolvedCardCount = resolveSelfMediaCardCount({
		mode: cardCountMode,
		customValue: customCardCount,
		platform,
	})
	const selectedPlatformLabel = platformOptions.find((option) => option.value === platform)?.label
	const selectedVisualPreset = selectableVisualPresets.find(
		(preset) => preset.value === resolvedVisualPreset,
	)
	const selectedVisualPresetLabel = selectedVisualPreset
		? t(selectedVisualPreset.labelKey)
		: resolvedVisualPreset
	const isConfigured = Object.values(selectedFields).some(Boolean)
	const triggerSegments = [
		...(selectedFields.platform
			? [{ label: composerConfigLabels.platform, value: selectedPlatformLabel ?? platform }]
			: []),
		...(selectedFields.visualPreset
			? [{ label: composerConfigLabels.visualPreset, value: selectedVisualPresetLabel }]
			: []),
		...(selectedFields.cardCount && supportsCardCount
			? [
					{
						label: composerConfigLabels.cardCount,
						value: t("detail.selfMedia.initPanel.composerConfig.cardCountValue", {
							count: resolvedCardCount,
						}),
					},
				]
			: []),
	]
	const triggerText =
		triggerSegments.length > 0
			? triggerSegments.map((segment) => `${segment.label}:${segment.value}`).join(" / ")
			: t("detail.selfMedia.initPanel.composerConfig.empty")
	const currentConfigText = t("detail.selfMedia.initPanel.composerConfig.currentConfig", {
		value: triggerText,
	})

	useEffect(() => {
		if (resolvedVisualPreset && resolvedVisualPreset !== visualPreset) {
			setVisualPreset(resolvedVisualPreset)
		}
		if (!resolvedVisualPreset && selectedFields.visualPreset) {
			setSelectedFields((current) => ({ ...current, visualPreset: false }))
		}
	}, [resolvedVisualPreset, selectedFields.visualPreset, visualPreset])

	useEffect(() => {
		if (!isConfigured) {
			sceneStateStore.setPresetSuffixContentForSource(
				SELF_MEDIA_COMPOSER_SUFFIX_SOURCE,
				undefined,
			)
			return
		}

		sceneStateStore.setPresetSuffixContentForSource(
			SELF_MEDIA_COMPOSER_SUFFIX_SOURCE,
			buildSelfMediaComposerPresetContent(
				{
					platform: selectedFields.platform ? platform : undefined,
					visualPreset:
						selectedFields.visualPreset && resolvedVisualPreset
							? resolvedVisualPreset
							: undefined,
					cardCount:
						selectedFields.cardCount && supportsCardCount
							? resolvedCardCount
							: undefined,
				},
				composerConfigLabels,
			),
		)

		return () => {
			sceneStateStore.setPresetSuffixContentForSource(
				SELF_MEDIA_COMPOSER_SUFFIX_SOURCE,
				undefined,
			)
		}
	}, [
		isConfigured,
		platform,
		resolvedCardCount,
		resolvedVisualPreset,
		selectedFields.cardCount,
		selectedFields.platform,
		selectedFields.visualPreset,
		sceneStateStore,
		supportsCardCount,
		composerConfigLabels,
	])

	const resetSelection = useCallback(() => {
		const nextDefaults = getDefaultSelfMediaComposerConfig()
		setPlatform(nextDefaults.platform)
		setVisualPreset(nextDefaults.visualPreset)
		setCardCountMode(String(nextDefaults.cardCount) as SelfMediaCardCountMode)
		setCustomCardCount(String(nextDefaults.cardCount))
		setSelectedFields(EMPTY_SELECTED_FIELDS)
	}, [])

	const sendCount = sceneStateStore.sendCount
	useEffect(() => {
		if (!sendCount) return
		resetSelection()
	}, [resetSelection, sendCount])

	const handlePlatformSelect = (nextPlatform: SelfMediaPlatform) => {
		setSelectedFields((current) => ({
			...current,
			cardCount: platformSupportsCardCount(nextPlatform) ? current.cardCount : false,
			platform: current.platform && platform === nextPlatform ? false : true,
		}))
		setPlatform(nextPlatform)
		if (!platformSupportsCardCount(nextPlatform)) return
		if (cardCountMode !== SELF_MEDIA_CUSTOM_CARD_COUNT) return

		const nextCardCount = resolveSelfMediaCardCount({
			mode: SELF_MEDIA_CUSTOM_CARD_COUNT,
			customValue: customCardCount,
			platform: nextPlatform,
		})
		setCustomCardCount(String(nextCardCount))
	}

	const handleCardCountModeSelect = (nextMode: SelfMediaCardCountMode) => {
		setSelectedFields((current) => ({
			...current,
			cardCount: current.cardCount && cardCountMode === nextMode ? false : true,
		}))
		setCardCountMode(nextMode)
		if (nextMode === SELF_MEDIA_CUSTOM_CARD_COUNT) {
			setCustomCardCount(String(resolvedCardCount || defaults.cardCount))
		}
	}

	const handleVisualPresetSelect = (nextVisualPreset: string) => {
		if (!nextVisualPreset) return
		setSelectedFields((current) => ({
			...current,
			visualPreset:
				current.visualPreset && resolvedVisualPreset === nextVisualPreset ? false : true,
		}))
		setVisualPreset(nextVisualPreset)
	}

	const hasSelectedVisualPreview = selectedFields.visualPreset && Boolean(selectedVisualPreset)
	const shouldUseCompactPopover = panelVariant === ScenePanelVariant.TopicPage

	const summaryContent = (
		<SelfMediaComposerConfigSummary
			emptyLabel={t("detail.selfMedia.initPanel.composerConfig.empty")}
			segments={triggerSegments}
		/>
	)
	const triggerSummaryContent = (
		<SelfMediaComposerConfigSummary
			emptyLabel={t("detail.selfMedia.initPanel.composerConfig.empty")}
			segments={triggerSegments}
			variant="trigger"
		/>
	)

	const clearButton = (
		<SelfMediaComposerConfigClearButton
			label={t("detail.selfMedia.initPanel.composerConfig.clear")}
			onClick={resetSelection}
		/>
	)

	const configContent = (
		<div className="flex flex-col gap-3" data-testid="self-media-composer-config-content">
			<div className="flex items-center justify-between gap-3">
				{summaryContent}
				{clearButton}
			</div>
			<div
				className={cn(
					"grid min-w-0 gap-3",
					hasSelectedVisualPreview && "lg:grid-cols-[minmax(0,1fr)_250px]",
				)}
			>
				<div className="flex min-w-0 flex-col gap-3">
					<div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
						<span className="text-sm font-medium text-muted-foreground">
							{composerConfigLabels.platform}
						</span>
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							{platformOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									aria-label={`select-platform-${option.value}`}
									aria-pressed={
										selectedFields.platform && platform === option.value
									}
									onClick={() => handlePlatformSelect(option.value)}
									className={cn(
										"h-9 rounded-full border px-4 text-sm font-medium shadow-xs transition-colors",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										selectedFields.platform && platform === option.value
											? "border-primary bg-primary text-primary-foreground"
											: "border-border bg-background text-foreground hover:bg-sidebar-accent",
									)}
									data-testid="handle-platform-select"
								>
									{option.label}
									<span className="sr-only"> {option.value}</span>
								</button>
							))}
						</div>
					</div>

					<div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-start gap-3">
						<span className="pt-2 text-sm font-medium text-muted-foreground">
							{composerConfigLabels.visualPreset}
						</span>
						<div
							className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-2"
							data-testid="self-media-visual-preset-grid"
						>
							{selectableVisualPresets.length > 0 ? (
								selectableVisualPresets.map((preset) => {
									const label = t(preset.labelKey)

									return (
										<button
											key={preset.value}
											type="button"
											aria-label={`select-visual-preset-${preset.value}`}
											aria-pressed={
												selectedFields.visualPreset &&
												resolvedVisualPreset === preset.value
											}
											onClick={() => handleVisualPresetSelect(preset.value)}
											className={cn(
												"group relative flex h-11 min-w-0 items-center gap-2 rounded-full border bg-background px-2 text-left shadow-xs transition-colors",
												"hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
												selectedFields.visualPreset &&
													resolvedVisualPreset === preset.value
													? "border-primary bg-sidebar-accent ring-1 ring-primary"
													: "border-border",
											)}
											data-testid="handle-visual-preset-select"
										>
											<PresetLayoutMark
												className="size-8 shrink-0"
												preset={preset}
											/>
											<span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground">
												{label}
											</span>
											{selectedFields.visualPreset &&
											resolvedVisualPreset === preset.value ? (
												<Check className="size-4 shrink-0 text-primary" />
											) : null}
										</button>
									)
								})
							) : (
								<div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
									{t("detail.selfMedia.initPanel.composerConfig.emptyPresets")}
								</div>
							)}
						</div>
					</div>

					{supportsCardCount ? (
						<div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{composerConfigLabels.cardCount}
							</span>
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								{SELF_MEDIA_CARD_COUNT_PRESETS.map((count) => (
									<button
										key={count}
										type="button"
										aria-pressed={
											selectedFields.cardCount &&
											cardCountMode === String(count)
										}
										onClick={() =>
											handleCardCountModeSelect(
												String(count) as SelfMediaCardCountMode,
											)
										}
										className={cn(
											"h-9 min-w-10 rounded-full border px-3 text-sm font-medium shadow-xs transition-colors",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
											selectedFields.cardCount &&
												cardCountMode === String(count)
												? "border-primary bg-primary text-primary-foreground"
												: "border-border bg-background text-foreground hover:bg-sidebar-accent",
										)}
										data-testid="handle-card-count-mode-select"
									>
										{count}
									</button>
								))}
								<button
									type="button"
									aria-label="custom-card-count"
									aria-pressed={
										selectedFields.cardCount &&
										cardCountMode === SELF_MEDIA_CUSTOM_CARD_COUNT
									}
									onClick={() =>
										handleCardCountModeSelect(SELF_MEDIA_CUSTOM_CARD_COUNT)
									}
									className={cn(
										"h-9 rounded-full border px-4 text-sm font-medium shadow-xs transition-colors",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										selectedFields.cardCount &&
											cardCountMode === SELF_MEDIA_CUSTOM_CARD_COUNT
											? "border-primary bg-primary text-primary-foreground"
											: "border-border bg-background text-foreground hover:bg-sidebar-accent",
									)}
									data-testid="handle-card-count-mode-select-2"
								>
									{t("detail.selfMedia.initPanel.composerConfig.custom")}
								</button>
								{selectedFields.cardCount &&
								cardCountMode === SELF_MEDIA_CUSTOM_CARD_COUNT ? (
									<Input
										aria-label="card-count-custom-input"
										type="number"
										min={SELF_MEDIA_CARD_COUNT_MIN}
										max={SELF_MEDIA_CARD_COUNT_MAX}
										value={customCardCount}
										onChange={(event) => {
											setSelectedFields((current) => ({
												...current,
												cardCount: true,
											}))
											setCustomCardCount(event.target.value)
										}}
										onBlur={() => setCustomCardCount(String(resolvedCardCount))}
										className="h-9 w-20 rounded-full text-center text-sm"
									/>
								) : null}
							</div>
						</div>
					) : null}
				</div>

				{hasSelectedVisualPreview ? (
					<SelfMediaComposerPresetPreview
						description={
							selectedVisualPreset
								? t(selectedVisualPreset.descriptionKey)
								: undefined
						}
						label={selectedVisualPresetLabel}
						preset={selectedVisualPreset}
					/>
				) : null}
			</div>
		</div>
	)

	if (shouldUseCompactPopover) {
		return (
			<section
				aria-label={`self-media-config-panel ${triggerText}`}
				className={cn("w-full", className)}
				data-testid="self-media-composer-config-panel"
			>
				<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={`self-media-config-trigger ${triggerText}`}
							aria-expanded={popoverOpen}
							className={cn(
								"inline-flex h-8 ml-0.5 mb-0.5 max-w-full items-center gap-2 overflow-hidden rounded-full bg-background px-3 shadow-xs ring-1 ring-border transition-colors",
								"hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
								popoverOpen && "bg-sidebar-accent ring-foreground/20",
							)}
							data-testid="self-media-composer-config-trigger"
						>
							{triggerSummaryContent}
							<ChevronDown
								className={cn(
									"size-4 shrink-0 text-muted-foreground transition-transform",
									popoverOpen && "rotate-180",
								)}
							/>
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						sideOffset={8}
						className="w-[860px] max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-background p-3.5 shadow-lg"
					>
						{configContent}
					</PopoverContent>
				</Popover>
				<span className="sr-only">{currentConfigText}</span>
			</section>
		)
	}

	return (
		<section
			aria-label={`self-media-config-panel ${triggerText}`}
			className={cn("w-full", className)}
			data-testid="self-media-composer-config-panel"
		>
			{configContent}
			<span className="sr-only">{currentConfigText}</span>
		</section>
	)
}

export default observer(SelfMediaComposerConfigPanel)
