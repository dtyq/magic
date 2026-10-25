import { ChevronDown, CircleX, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/utils/cn"
import { useOptionalMessageEditorStore } from "@/pages/superMagic/components/MessageEditor/stores"
import { VideoProductionConfigStore } from "@/pages/superMagic/components/MessageEditor/stores/VideoProductionConfigStore"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import {
	VIDEO_PRODUCTION_SUFFIX_SOURCE,
	buildVideoProductionPresetContent,
	isVideoProductionContext,
} from "../utils/videoProductionConfig"
import AIAutoSelectVisual from "../scenes/Slides/AIAutoSelectVisual"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { useOptionalScenePanelVariant, useOptionalSceneStateStore } from "../stores"
import { VideoDurationRangeInput } from "./VideoDurationRangeInput"

interface VideoProductionConfigPanelProps {
	topicMode?: string
	agentCode?: string | null
	selectedTopic?: { id?: string; agent_code?: string | null } | null
}

interface VideoProductionConfigScrollProps {
	enabled: boolean
	children: ReactNode
}

function VideoProductionConfigScroll({ enabled, children }: VideoProductionConfigScrollProps) {
	if (!enabled) return <>{children}</>

	return (
		<HeadlessHorizontalScroll
			className="min-w-0 flex-1"
			controlBackground="rgba(255,255,255,0.9)"
			scrollContainerClassName="no-scrollbar flex w-full min-w-0 items-center justify-start overflow-x-auto overflow-y-hidden"
			data-testid="video-production-config-scroll"
		>
			{children}
		</HeadlessHorizontalScroll>
	)
}

type MobileVideoPopupKey = "aspectRatio" | "duration" | "resolution" | "generation"

const VIDEO_CONFIG_CONTROL_WIDTH_CLASS: Record<MobileVideoPopupKey, string> = {
	aspectRatio: "min-w-[104px]",
	duration: "min-w-[104px]",
	resolution: "min-w-[112px]",
	generation: "min-w-[104px]",
}

const VIDEO_CONFIG_DESKTOP_MIN_WIDTH_CLASS: Record<MobileVideoPopupKey, string> = {
	aspectRatio: "min-w-[90px]",
	duration: "min-w-[90px]",
	resolution: "min-w-[90px]",
	generation: "min-w-[90px]",
}

interface MobileVideoOption {
	value: string
	label: ReactNode
}

function VideoConfigClearButton({
	field,
	clearText,
	onClear,
	compact = false,
	hidden = false,
}: {
	field: MobileVideoPopupKey
	clearText: string
	onClear: () => void
	compact?: boolean
	hidden?: boolean
}) {
	const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return
		event.preventDefault()
		event.stopPropagation()
		onClear()
	}

	return (
		<span
			role="button"
			tabIndex={0}
			aria-label={clearText}
			className={cn(
				"inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70",
				compact && "-m-2 size-8 active:bg-muted",
				hidden &&
					"pointer-events-none opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
			)}
			onPointerDown={(event) => {
				event.preventDefault()
				event.stopPropagation()
			}}
			onClick={(event) => {
				event.preventDefault()
				event.stopPropagation()
				onClear()
			}}
			onKeyDown={handleKeyDown}
			data-testid={`video-production-${field}-clear-button`}
		>
			<CircleX className="size-4 text-muted-foreground opacity-50" />
		</span>
	)
}

interface MobileVideoOptionPopupProps {
	open: boolean
	label: string
	value: string
	options: MobileVideoOption[]
	onClose: () => void
	onSelect: (value: string) => void
}

function MobileVideoOptionPopup({
	open,
	label,
	value,
	options,
	onClose,
	onSelect,
}: MobileVideoOptionPopupProps) {
	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			className="rounded-t-[14px] border-0 bg-muted"
			bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
			handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
			title={label}
		>
			<div
				className="flex max-h-[min(520px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] flex-col gap-2 overflow-hidden bg-muted"
				data-testid="mobile-video-production-config-popup"
			>
				<div className="relative flex h-14 shrink-0 flex-row items-center justify-center">
					<button
						type="button"
						onClick={onClose}
						className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
						style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
						aria-label={label}
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</button>
					<div className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground">
						{label}
					</div>
				</div>

				<div className="overflow-y-auto px-3 pb-5">
					<div className="flex flex-col gap-1">
						{options.map((option) => {
							const isSelected = option.value === value
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => onSelect(option.value)}
									className={cn(
										"flex min-h-12 w-full items-center rounded-full px-4 text-left text-base font-medium text-foreground transition-all duration-200",
										isSelected &&
											"bg-card shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]",
										!isSelected &&
											"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/60",
									)}
									data-testid="mobile-video-production-config-option"
									data-selected={isSelected}
								>
									<span className="min-w-0 flex-1">{option.label}</span>
								</button>
							)
						})}
					</div>
				</div>
			</div>
		</MagicPopup>
	)
}

function MobileVideoProductionConfigPanel({
	capabilities,
	config,
	onConfigChange,
	clearText,
	selectPlaceholder,
	t,
}: {
	capabilities: VideoProductionConfigStore["capabilities"]
	config: VideoProductionConfigStore["config"]
	onConfigChange: (patch: Partial<VideoProductionConfigStore["config"]>) => void
	clearText: string
	selectPlaceholder: string
	t: (key: string) => string
}) {
	const [openKey, setOpenKey] = useState<MobileVideoPopupKey | null>(null)
	const generationMode = config.generationMode ?? "normal"
	const closePopup = () => setOpenKey(null)
	const openPopup = (key: MobileVideoPopupKey) => setOpenKey(key)
	const clearValue = (key: MobileVideoPopupKey) => {
		if (key === "aspectRatio") onConfigChange({ aspectRatio: undefined })
		if (key === "resolution") onConfigChange({ resolution: undefined })
		if (key === "duration") onConfigChange({ durationSeconds: undefined })
	}
	const selectValue = (key: MobileVideoPopupKey, value: string) => {
		if (key === "aspectRatio") onConfigChange({ aspectRatio: value })
		if (key === "resolution") onConfigChange({ resolution: value })
		if (key === "duration") onConfigChange({ durationSeconds: Number(value) })
		if (key === "generation") {
			onConfigChange({ generationMode: value as "normal" | "detailed" })
		}
		closePopup()
	}
	const trigger = (key: MobileVideoPopupKey, label: string, value: ReactNode) => (
		<button
			type="button"
			onClick={() => openPopup(key)}
			className={cn(
				"group relative flex !h-8 min-h-8 w-fit shrink-0 items-center gap-1 rounded-full border border-border bg-card py-0 pl-2.5 pr-8 text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] dark:bg-card",
				VIDEO_CONFIG_CONTROL_WIDTH_CLASS[key],
			)}
			aria-label={label}
			data-testid={`mobile-video-production-${key}-trigger`}
		>
			<span className="whitespace-nowrap text-[11px] text-muted-foreground">{label}</span>
			<span
				className={cn(
					"whitespace-nowrap text-left text-[13px] font-medium",
					value === selectPlaceholder ? "text-muted-foreground" : "text-foreground",
				)}
			>
				{value}
			</span>
			<span className="absolute right-2.5 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center">
				{key === "generation" || value === selectPlaceholder ? (
					<ChevronDown className="size-4 text-muted-foreground opacity-50" />
				) : (
					<VideoConfigClearButton
						field={key}
						clearText={clearText}
						compact
						onClear={() => clearValue(key)}
					/>
				)}
			</span>
		</button>
	)

	const aspectLabel = t("messageEditor.videoProductionConfig.aspectRatio")
	const durationLabel = t("messageEditor.videoProductionConfig.duration")
	const resolutionLabel = t("messageEditor.videoProductionConfig.resolution")
	const generationLabel = t("messageEditor.videoProductionConfig.generation")

	return (
		<VideoProductionConfigScroll enabled>
			<div className="flex min-w-max shrink-0 items-center gap-2">
				{capabilities.showAspectRatio && (
					<>
						{trigger(
							"aspectRatio",
							aspectLabel,
							config.aspectRatio ?? selectPlaceholder,
						)}
						<MobileVideoOptionPopup
							open={openKey === "aspectRatio"}
							label={aspectLabel}
							value={config.aspectRatio ?? ""}
							options={capabilities.aspectRatioOptions.map((option) => ({
								value: option.value,
								label: (
									<span className="flex items-center gap-2">
										<AspectRatioPreview aspectRatio={option.label} />
										<span>{option.label}</span>
										<span className="ml-auto text-sm font-normal text-muted-foreground">
											{option.width}x{option.height}
										</span>
									</span>
								),
							}))}
							onClose={closePopup}
							onSelect={(value) => selectValue("aspectRatio", value)}
						/>
					</>
				)}

				{capabilities.showDuration && capabilities.duration.type === "options" && (
					<>
						{trigger(
							"duration",
							durationLabel,
							config.durationSeconds == null
								? selectPlaceholder
								: `${config.durationSeconds}s`,
						)}
						<MobileVideoOptionPopup
							open={openKey === "duration"}
							label={durationLabel}
							value={String(config.durationSeconds ?? "")}
							options={capabilities.duration.options.map((seconds) => ({
								value: String(seconds),
								label: `${seconds}s`,
							}))}
							onClose={closePopup}
							onSelect={(value) => selectValue("duration", value)}
						/>
					</>
				)}

				{capabilities.showDuration && capabilities.duration.type === "range" && (
					<>
						{trigger(
							"duration",
							durationLabel,
							config.durationSeconds == null
								? selectPlaceholder
								: `${config.durationSeconds}s`,
						)}
						<MagicPopup
							visible={openKey === "duration"}
							onClose={closePopup}
							className="rounded-t-[14px] border-0 bg-muted"
							bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
							handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
							title={durationLabel}
						>
							<div className="p-4">
								<div className="mb-4 flex items-center justify-between text-base font-medium">
									<span>{durationLabel}</span>
									<span
										className={cn(
											config.durationSeconds == null
												? "text-muted-foreground"
												: "text-foreground",
										)}
									>
										{config.durationSeconds == null
											? selectPlaceholder
											: `${config.durationSeconds}s`}
									</span>
								</div>
								<VideoDurationRangeInput
									value={config.durationSeconds}
									min={capabilities.duration.min}
									max={capabilities.duration.max}
									step={capabilities.duration.step}
									onValueChange={(durationSeconds) =>
										onConfigChange({ durationSeconds })
									}
									className="w-full accent-primary"
									ariaLabel={durationLabel}
									dataTestId="mobile-video-production-duration-range"
								/>
							</div>
						</MagicPopup>
					</>
				)}

				{capabilities.showResolution && (
					<>
						{trigger(
							"resolution",
							resolutionLabel,
							config.resolution ?? selectPlaceholder,
						)}
						<MobileVideoOptionPopup
							open={openKey === "resolution"}
							label={resolutionLabel}
							value={config.resolution ?? ""}
							options={capabilities.resolutionOptions.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
							onClose={closePopup}
							onSelect={(value) => selectValue("resolution", value)}
						/>
					</>
				)}

				<>
					{trigger(
						"generation",
						generationLabel,
						t(`messageEditor.videoProductionConfig.${generationMode}`),
					)}
					<MobileVideoOptionPopup
						open={openKey === "generation"}
						label={generationLabel}
						value={generationMode}
						options={(["normal", "detailed"] as const).map((mode) => ({
							value: mode,
							label: (
								<div className="flex w-full items-center justify-between gap-4">
									<div className="shrink-0 text-base font-semibold">
										{t(`messageEditor.videoProductionConfig.${mode}`)}
									</div>
									<div className="min-w-0 flex-1 text-right text-xs leading-5 text-muted-foreground">
										{t(
											`messageEditor.videoProductionConfig.${mode}Description`,
										)}
									</div>
								</div>
							),
						}))}
						onClose={closePopup}
						onSelect={(value) => selectValue("generation", value)}
					/>
				</>
			</div>
		</VideoProductionConfigScroll>
	)
}

function VideoProductionConfigPanel({
	topicMode,
	agentCode,
	selectedTopic,
}: VideoProductionConfigPanelProps) {
	const { t } = useTranslation("super")
	const store = useOptionalMessageEditorStore()
	const scenePanelVariant = useOptionalScenePanelVariant()
	const sceneStateStore = useOptionalSceneStateStore()
	const isVisible = isVideoProductionContext({ topicMode, agentCode, selectedTopic })
	const selectedVideoModel = store?.topicModelStore.selectedVideoModel
	const configStore = useMemo(() => new VideoProductionConfigStore(), [])
	const capabilities = configStore.capabilities
	const config = configStore.config
	const generationMode = config.generationMode ?? "normal"
	const selectPlaceholder = t("messageEditor.videoProductionConfig.selectPlaceholder")
	const clearText = t("shadcn-ui:select.clear")
	const [isGenerationPopoverOpen, setIsGenerationPopoverOpen] = useState(false)
	const [isDurationPopoverOpen, setIsDurationPopoverOpen] = useState(false)
	const clearConfigValue = (field: MobileVideoPopupKey) => {
		if (field === "aspectRatio") configStore.setConfig({ aspectRatio: undefined })
		if (field === "resolution") configStore.setConfig({ resolution: undefined })
		if (field === "duration") configStore.setConfig({ durationSeconds: undefined })
	}
	const inputScopeKey =
		sceneStateStore?.inputScopeKey ||
		`${topicMode ?? ""}\u001e${selectedTopic?.id ?? ""}\u001e${agentCode ?? selectedTopic?.agent_code ?? ""}`

	useEffect(() => {
		if (!store) return
		if (!isVisible) {
			configStore.deactivate()
			return
		}
		configStore.setContext({
			model: selectedVideoModel,
			inputScopeKey,
		})
		return () => configStore.deactivate()
	}, [configStore, inputScopeKey, isVisible, selectedVideoModel, store])

	useEffect(() => {
		if (!sceneStateStore) return
		if (!isVisible || !store) {
			sceneStateStore.setPresetSuffixContentForSource(
				VIDEO_PRODUCTION_SUFFIX_SOURCE,
				undefined,
			)
			return
		}

		sceneStateStore.setPresetSuffixContentForSource(
			VIDEO_PRODUCTION_SUFFIX_SOURCE,
			buildVideoProductionPresetContent({
				generationMode: t(`messageEditor.videoProductionConfig.${generationMode}`),
				generationModeKey: generationMode,
				aspectRatio: config.aspectRatio,
				durationSeconds: config.durationSeconds,
				resolution: config.resolution,
				showAspectRatio: capabilities.showAspectRatio && config.aspectRatio !== undefined,
				showDuration: capabilities.showDuration && config.durationSeconds !== undefined,
				showResolution: capabilities.showResolution && config.resolution !== undefined,
				labels: {
					generationMode: t("messageEditor.videoProductionConfig.generationMode"),
					aspectRatio: t("messageEditor.videoProductionConfig.aspectRatio"),
					duration: t("messageEditor.videoProductionConfig.duration"),
					resolution: t("messageEditor.videoProductionConfig.resolution"),
				},
			}),
		)

		return () => {
			sceneStateStore.setPresetSuffixContentForSource(
				VIDEO_PRODUCTION_SUFFIX_SOURCE,
				undefined,
			)
		}
	}, [capabilities, config, generationMode, isVisible, sceneStateStore, store, t])

	const sendCount = sceneStateStore?.sendCount
	const lastHandledSendCountRef = useRef(sendCount)
	useEffect(() => {
		if (
			sendCount === undefined ||
			sendCount <= (lastHandledSendCountRef.current ?? sendCount)
		) {
			lastHandledSendCountRef.current = sendCount
			return
		}

		lastHandledSendCountRef.current = sendCount
		configStore.clearCurrentConfig()
		sceneStateStore?.setPresetSuffixContentForSource(VIDEO_PRODUCTION_SUFFIX_SOURCE, undefined)
	}, [configStore, sceneStateStore, sendCount])

	if (!isVisible || !store) return null

	const triggerClass =
		"flex w-fit shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-xs outline-none transition-[color,box-shadow] hover:bg-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 dark:bg-input/30 dark:hover:bg-input/50"
	const fieldClass = "relative flex items-center gap-2 whitespace-nowrap"
	const isCompactMobile = scenePanelVariant === ScenePanelVariant.Mobile
	const compactTriggerClass =
		"!h-8 min-h-8 min-w-0 shrink-0 gap-1 border-border bg-card pl-2.5 pr-2 text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] dark:bg-card"
	const selectTriggerClass = (key: MobileVideoPopupKey) =>
		cn(
			"!h-8",
			triggerClass,
			VIDEO_CONFIG_DESKTOP_MIN_WIDTH_CLASS[key],
			isCompactMobile && compactTriggerClass,
		)
	const popoverTriggerClass = (key: MobileVideoPopupKey) =>
		cn(
			"h-8",
			triggerClass,
			VIDEO_CONFIG_DESKTOP_MIN_WIDTH_CLASS[key],
			isCompactMobile && compactTriggerClass,
		)
	const compactValueClass = (hasValue: boolean) =>
		cn(
			"whitespace-nowrap text-[13px] font-medium",
			hasValue ? "text-foreground" : "text-muted-foreground",
		)
	const popoverValueClass = (hasValue: boolean) =>
		cn("whitespace-nowrap text-left", hasValue ? "text-foreground" : "text-muted-foreground")
	const shouldShowBackground = scenePanelVariant === ScenePanelVariant.HomePage
	const shouldUseHorizontalScroll =
		scenePanelVariant === ScenePanelVariant.TopicPage ||
		scenePanelVariant === ScenePanelVariant.Mobile

	if (isCompactMobile) {
		return (
			<div
				className="relative flex min-h-8 w-full min-w-0 items-center overflow-hidden"
				data-testid="video-production-config-panel"
			>
				<MobileVideoProductionConfigPanel
					capabilities={capabilities}
					config={config}
					onConfigChange={configStore.setConfig}
					clearText={clearText}
					selectPlaceholder={selectPlaceholder}
					t={t}
				/>
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative flex w-full min-w-0 items-center overflow-hidden",
				isCompactMobile
					? "min-h-8"
					: "min-h-16 justify-between gap-4 rounded-xl border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl",
			)}
			data-testid="video-production-config-panel"
		>
			{shouldShowBackground ? <AIAutoSelectVisual /> : null}
			<div
				className={cn(
					"relative z-10 flex w-full items-center",
					isCompactMobile ? "min-w-0" : "justify-between gap-4",
				)}
			>
				{/*
				 * 产品暂时隐藏 skill 入口；保留实现和空 options 状态，后续确认接入来源后可直接恢复。
				 * <button
				 * 	type="button"
				 * 	className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white/75 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:cursor-default disabled:opacity-100"
				 * 	aria-label={t("messageEditor.videoProductionConfig.skill")}
				 * 	data-testid="video-production-skill"
				 * >
				 * 	<BookOpen className="size-4" />
				 * 	{t("messageEditor.videoProductionConfig.skill")}
				 * </button>
				 */}

				<VideoProductionConfigScroll enabled={shouldUseHorizontalScroll}>
					<div
						className={
							isCompactMobile
								? "flex min-w-max shrink-0 items-center gap-2"
								: shouldUseHorizontalScroll
									? "ml-auto flex min-w-max shrink-0 items-center gap-4"
									: "ml-auto flex items-center gap-4"
						}
					>
						{capabilities.showAspectRatio && (
							<label className={cn(fieldClass, isCompactMobile && "gap-0")}>
								{isCompactMobile ? null : (
									<span className="text-sm font-normal text-foreground">
										{t("messageEditor.videoProductionConfig.aspectRatio")}
									</span>
								)}
								<Select
									value={config.aspectRatio ?? ""}
									onValueChange={(value) =>
										configStore.setConfig({ aspectRatio: value })
									}
								>
									<SelectTrigger
										aria-label={t(
											"messageEditor.videoProductionConfig.aspectRatio",
										)}
										className={cn(
											"group",
											selectTriggerClass("aspectRatio"),
											config.aspectRatio !== undefined &&
												"[&>svg:last-child]:hidden",
										)}
									>
										{isCompactMobile ? (
											<>
												<span className="whitespace-nowrap text-[11px] text-muted-foreground">
													{t(
														"messageEditor.videoProductionConfig.aspectRatio",
													)}
												</span>
												<span
													className={compactValueClass(
														config.aspectRatio !== undefined,
													)}
												>
													{config.aspectRatio ?? selectPlaceholder}
												</span>
											</>
										) : (
											<SelectValue
												placeholder={selectPlaceholder}
												className="whitespace-nowrap"
											>
												{config.aspectRatio}
											</SelectValue>
										)}
										{config.aspectRatio !== undefined && (
											<VideoConfigClearButton
												field="aspectRatio"
												clearText={clearText}
												hidden
												onClear={() => clearConfigValue("aspectRatio")}
											/>
										)}
									</SelectTrigger>
									<SelectContent
										align="start"
										showScrollButtons={false}
										className="min-w-[200px]"
									>
										{capabilities.aspectRatioOptions.map((option) => (
											<SelectItem
												key={option.value}
												value={option.value}
												className="min-h-10 py-2 pl-2.5 pr-8 text-xs font-medium [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
											>
												<span className="flex w-full min-w-0 items-center gap-1.5">
													<AspectRatioPreview
														aspectRatio={option.label}
													/>
													<span className="min-w-0 shrink-0 truncate">
														{option.label}
													</span>
													<span className="ml-auto shrink-0 font-normal text-muted-foreground">
														{option.width}x{option.height}
													</span>
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</label>
						)}

						{capabilities.showDuration && (
							<label className={cn(fieldClass, isCompactMobile && "gap-0")}>
								{isCompactMobile ? null : (
									<span className="text-sm font-normal text-foreground">
										{t("messageEditor.videoProductionConfig.duration")}
									</span>
								)}
								{capabilities.duration.type === "range" ? (
									<Popover
										open={isDurationPopoverOpen}
										onOpenChange={setIsDurationPopoverOpen}
									>
										<PopoverTrigger asChild>
											<button
												type="button"
												className={cn(
													"group",
													popoverTriggerClass("duration"),
												)}
												aria-label={t(
													"messageEditor.videoProductionConfig.duration",
												)}
												data-testid="video-production-duration-trigger"
											>
												{isCompactMobile ? (
													<>
														<span className="whitespace-nowrap text-[11px] text-muted-foreground">
															{t(
																"messageEditor.videoProductionConfig.duration",
															)}
														</span>
														<span
															className={compactValueClass(
																config.durationSeconds !==
																	undefined,
															)}
														>
															{config.durationSeconds == null
																? selectPlaceholder
																: `${config.durationSeconds}s`}
														</span>
													</>
												) : (
													<span
														className={popoverValueClass(
															config.durationSeconds !== undefined,
														)}
													>
														{config.durationSeconds == null
															? selectPlaceholder
															: `${config.durationSeconds}s`}
													</span>
												)}
												<span className="relative flex size-4 shrink-0 items-center justify-center">
													{config.durationSeconds !== undefined ? (
														<VideoConfigClearButton
															field="duration"
															clearText={clearText}
															hidden
															onClear={() =>
																clearConfigValue("duration")
															}
														/>
													) : (
														<ChevronDown className="size-4 text-muted-foreground opacity-50" />
													)}
												</span>
											</button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											sideOffset={8}
											className="w-64 rounded-xl p-4"
										>
											<div className="flex flex-col gap-3">
												<div className="flex items-center justify-between text-sm">
													<span className="text-muted-foreground">
														{t(
															"messageEditor.videoProductionConfig.duration",
														)}
													</span>
													<span
														className={cn(
															"font-medium",
															config.durationSeconds == null
																? "text-muted-foreground"
																: "text-foreground",
														)}
													>
														{config.durationSeconds == null
															? selectPlaceholder
															: `${config.durationSeconds}s`}
													</span>
												</div>
												<VideoDurationRangeInput
													value={config.durationSeconds}
													min={capabilities.duration.min}
													max={capabilities.duration.max}
													step={capabilities.duration.step}
													onValueChange={(durationSeconds) =>
														configStore.setConfig({ durationSeconds })
													}
													className="w-full accent-primary"
													ariaLabel={t(
														"messageEditor.videoProductionConfig.duration",
													)}
													dataTestId="video-production-duration-range"
												/>
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>{capabilities.duration.min}s</span>
													<span>{capabilities.duration.max}s</span>
												</div>
											</div>
										</PopoverContent>
									</Popover>
								) : (
									<Select
										value={
											config.durationSeconds == null
												? ""
												: String(config.durationSeconds)
										}
										onValueChange={(value) =>
											configStore.setConfig({
												durationSeconds: Number(value),
											})
										}
									>
										<SelectTrigger
											aria-label={t(
												"messageEditor.videoProductionConfig.duration",
											)}
											className={cn(
												selectTriggerClass("duration"),
												config.durationSeconds !== undefined &&
													"[&>svg:last-child]:hidden",
											)}
										>
											{isCompactMobile ? (
												<>
													<span className="whitespace-nowrap text-[11px] text-muted-foreground">
														{t(
															"messageEditor.videoProductionConfig.duration",
														)}
													</span>
													<span
														className={compactValueClass(
															config.durationSeconds !== undefined,
														)}
													>
														{config.durationSeconds == null
															? selectPlaceholder
															: `${config.durationSeconds}s`}
													</span>
												</>
											) : (
												<SelectValue
													placeholder={selectPlaceholder}
													className="whitespace-nowrap"
												>
													{config.durationSeconds == null
														? undefined
														: `${config.durationSeconds}s`}
												</SelectValue>
											)}
											{config.durationSeconds !== undefined && (
												<VideoConfigClearButton
													field="duration"
													clearText={clearText}
													hidden
													onClear={() => clearConfigValue("duration")}
												/>
											)}
										</SelectTrigger>
										<SelectContent align="start" showScrollButtons={false}>
											{capabilities.duration.options.map((seconds) => (
												<SelectItem key={seconds} value={String(seconds)}>
													{seconds}s
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</label>
						)}

						{capabilities.showResolution && (
							<label className={cn(fieldClass, isCompactMobile && "gap-0")}>
								{isCompactMobile ? null : (
									<span className="text-sm font-normal text-foreground">
										{t("messageEditor.videoProductionConfig.resolution")}
									</span>
								)}
								<Select
									value={config.resolution ?? ""}
									onValueChange={(value) =>
										configStore.setConfig({ resolution: value })
									}
								>
									<SelectTrigger
										aria-label={t(
											"messageEditor.videoProductionConfig.resolution",
										)}
										className={cn(
											"group",
											selectTriggerClass("resolution"),
											config.resolution !== undefined &&
												"[&>svg:last-child]:hidden",
										)}
									>
										{isCompactMobile ? (
											<>
												<span className="whitespace-nowrap text-[11px] text-muted-foreground">
													{t(
														"messageEditor.videoProductionConfig.resolution",
													)}
												</span>
												<span
													className={compactValueClass(
														config.resolution !== undefined,
													)}
												>
													{config.resolution ?? selectPlaceholder}
												</span>
											</>
										) : (
											<SelectValue
												placeholder={selectPlaceholder}
												className="whitespace-nowrap"
											/>
										)}
										{config.resolution !== undefined && (
											<VideoConfigClearButton
												field="resolution"
												clearText={clearText}
												hidden
												onClear={() => clearConfigValue("resolution")}
											/>
										)}
									</SelectTrigger>
									<SelectContent align="start" showScrollButtons={false}>
										{capabilities.resolutionOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</label>
						)}

						<label className={cn(fieldClass, isCompactMobile && "gap-0")}>
							{isCompactMobile ? null : (
								<span className="text-sm font-normal text-foreground">
									{t("messageEditor.videoProductionConfig.generation")}
								</span>
							)}
							<Popover
								open={isGenerationPopoverOpen}
								onOpenChange={setIsGenerationPopoverOpen}
							>
								<PopoverTrigger asChild>
									<button
										type="button"
										className={cn("group", popoverTriggerClass("generation"))}
										aria-label={t(
											"messageEditor.videoProductionConfig.generation",
										)}
										data-testid="video-production-generation-trigger"
									>
										{isCompactMobile ? (
											<>
												<span className="whitespace-nowrap text-[11px] text-muted-foreground">
													{t(
														"messageEditor.videoProductionConfig.generation",
													)}
												</span>
												<span className={compactValueClass(true)}>
													{t(
														`messageEditor.videoProductionConfig.${generationMode}`,
													)}
												</span>
											</>
										) : (
											<span className={popoverValueClass(true)}>
												{t(
													`messageEditor.videoProductionConfig.${generationMode}`,
												)}
											</span>
										)}
										<span className="relative flex size-4 shrink-0 items-center justify-center">
											<ChevronDown className="size-4 text-muted-foreground opacity-50" />
										</span>
									</button>
								</PopoverTrigger>
								<PopoverContent
									align="end"
									sideOffset={8}
									className="w-[360px] rounded-2xl p-3"
								>
									<div
										className="grid grid-cols-2 gap-2"
										data-testid="video-production-generation-options"
									>
										{(["normal", "detailed"] as const).map((mode) => (
											<button
												key={mode}
												type="button"
												className={`rounded-2xl border p-4 text-left transition-colors ${
													generationMode === mode
														? "border-foreground bg-foreground text-background"
														: "border-border bg-muted/30 text-foreground hover:bg-muted"
												}`}
												aria-pressed={generationMode === mode}
												onClick={() => {
													configStore.setConfig({
														generationMode: mode,
													})
													setIsGenerationPopoverOpen(false)
												}}
											>
												<div className="text-base font-semibold">
													{t(
														`messageEditor.videoProductionConfig.${mode}`,
													)}
												</div>
												<div className="mt-1 text-xs leading-5 opacity-70">
													{t(
														`messageEditor.videoProductionConfig.${mode}Description`,
													)}
												</div>
											</button>
										))}
									</div>
								</PopoverContent>
							</Popover>
						</label>
					</div>
				</VideoProductionConfigScroll>
			</div>
		</div>
	)
}

const ASPECT_RATIO_ICON_BASE_SIZE = 16

function getAspectRatioIconSize(aspectRatio: string) {
	const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number)
	const ratio = rawWidth / rawHeight
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return {
			iconWidth: ASPECT_RATIO_ICON_BASE_SIZE,
			iconHeight: Math.round((ASPECT_RATIO_ICON_BASE_SIZE * 9) / 16),
		}
	}
	return {
		iconWidth:
			ratio >= 1
				? ASPECT_RATIO_ICON_BASE_SIZE
				: Math.max(8, Math.round(ASPECT_RATIO_ICON_BASE_SIZE * ratio)),
		iconHeight:
			ratio >= 1
				? Math.max(8, Math.round(ASPECT_RATIO_ICON_BASE_SIZE / ratio))
				: ASPECT_RATIO_ICON_BASE_SIZE,
	}
}

/** 画幅预览：24px 灰底容器内按 16px 长边绘制比例矩形，四周留出 padding。 */
function AspectRatioPreview({ aspectRatio }: { aspectRatio: string }) {
	const { iconWidth, iconHeight } = getAspectRatioIconSize(aspectRatio)
	return (
		<span
			className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-input"
			aria-hidden="true"
		>
			<span
				className="box-border block shrink-0 rounded-[2px] border border-muted-foreground bg-white/40"
				style={{ width: iconWidth, height: iconHeight }}
			/>
		</span>
	)
}

export default observer(VideoProductionConfigPanel)
