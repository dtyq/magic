import {
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react"
import {
	Award,
	Check,
	Eye,
	FolderOpen,
	Image as ImageIcon,
	MousePointerClick,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/shadcn-ui/hover-card"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import { formatNumber } from "@/utils/format"
import type { OptionItem } from "../types"
import { useLocaleText } from "../hooks/useLocaleText"
import { localeTextToDisplayString } from "../utils"
import {
	getFeaturedSlidesTemplateTag,
	getSlidesTemplateTagDisplayName,
	hasSlidesTemplateUsageCount,
} from "./templateMeta"
import SlidesTemplateFavoriteIcon from "./SlidesTemplateFavoriteIcon"

interface SlidesPresetCardProps {
	template: OptionItem
	isSelected?: boolean
	onClick?: (template: OptionItem) => void
	onPreviewClick?: (template: OptionItem) => void
	onPreviewPreload?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onRemove?: (template: OptionItem) => void
	removePending?: boolean
	favoritePending?: boolean
	canUseHoverPreview?: boolean
	showHoverDetails?: boolean
	hoverDetailsContainer?: HTMLElement | null
}

const PREVIEW_PRELOAD_DELAY_MS = 300
const HOVER_DETAILS_OPEN_DELAY_MS = 1000

function FeaturedTagIcon({ label, testId }: { label: string; testId: string }) {
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-[0_2px_6px_rgba(245,158,11,0.3)]"
			data-testid={testId}
		>
			<Award className="size-3" aria-hidden="true" />
		</span>
	)
}

function FeaturedTagBadge({ label, testId }: { label: string; testId: string }) {
	return (
		<span
			title={label}
			className="inline-flex shrink-0 items-center rounded-full border border-amber-500/60 bg-amber-100/70 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-800"
			data-testid={testId}
		>
			{label}
		</span>
	)
}

function SlidesPresetCard({
	template,
	isSelected = false,
	onClick,
	onPreviewClick,
	onPreviewPreload,
	onFavoriteToggle,
	onOpenProject,
	onRemove,
	removePending = false,
	favoritePending = false,
	canUseHoverPreview = false,
	showHoverDetails = true,
	hoverDetailsContainer,
}: SlidesPresetCardProps) {
	const lt = useLocaleText()
	const { t, i18n } = useTranslation("crew/create")
	const { t: tSuper } = useTranslation("super")
	const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isThumbnailLoaded, setIsThumbnailLoaded] = useState(false)
	const [isCollageLoaded, setIsCollageLoaded] = useState(false)

	const label = lt(template.label) ?? lt(template.value) ?? ""
	const featuredTag = getFeaturedSlidesTemplateTag(template)
	const featuredLabel = getSlidesTemplateTagDisplayName(featuredTag, i18n.language, {
		zh_CN: "精选",
		en_US: "Featured",
	})
	const showUsageCount = hasSlidesTemplateUsageCount(template)
	const usageCount = Math.max(0, template.usage_count ?? 0)
	const formattedUsageCount = formatNumber(usageCount)
	const favoriteLabel = template.is_favorite
		? tSuper("mySlidesTemplates.unfavorite")
		: tSuper("mySlidesTemplates.favorite")
	const testIdSuffix = getTemplateTestIdSuffix(template)
	const canPreview = Boolean(
		template.preview_image_urls?.length ||
		template.collage_url ||
		template.preview_url ||
		template.thumbnail_url,
	)
	const shouldShowHoverDetails =
		showHoverDetails &&
		canUseHoverPreview &&
		Boolean(template.collage_url || template.description)

	useEffect(() => {
		return () => {
			clearPreviewPreloadTimer()
		}
	}, [])

	function handleClick() {
		onClick?.(template)
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.target !== event.currentTarget) return
		if (event.key !== "Enter" && event.key !== " ") return

		event.preventDefault()
		handleClick()
	}

	function handleUseClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		handleClick()
	}

	function handlePreviewClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onPreviewClick?.(template)
	}

	function handleFavoriteClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onFavoriteToggle?.(template)
	}

	function handleOpenProjectClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onOpenProject?.(template)
	}

	function handleRemoveClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onRemove?.(template)
	}

	function handlePreviewIntentStart() {
		if (!canUseHoverPreview || !canPreview || preloadTimerRef.current) return

		preloadTimerRef.current = setTimeout(() => {
			preloadTimerRef.current = null
			onPreviewPreload?.(template)
		}, PREVIEW_PRELOAD_DELAY_MS)
	}

	function handleMouseLeave() {
		clearPreviewPreloadTimer()
	}

	function handleBlur(event: FocusEvent<HTMLDivElement>) {
		const nextTarget = event.relatedTarget
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return

		clearPreviewPreloadTimer()
	}

	function clearPreviewPreloadTimer() {
		if (!preloadTimerRef.current) return

		clearTimeout(preloadTimerRef.current)
		preloadTimerRef.current = null
	}

	const cardContent = (
		<div
			role="button"
			tabIndex={0}
			data-testid="slides-preset-card"
			data-template-id={testIdSuffix}
			className={cn(
				"group relative flex size-full cursor-pointer flex-col gap-2 rounded-xl p-2 outline-none transition-colors duration-200",
				"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				canUseHoverPreview && "hover:bg-sidebar-accent",
				isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
			)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			onMouseEnter={canUseHoverPreview ? handlePreviewIntentStart : undefined}
			onMouseLeave={canUseHoverPreview ? handleMouseLeave : undefined}
			onFocus={canUseHoverPreview ? handlePreviewIntentStart : undefined}
			onBlur={canUseHoverPreview ? handleBlur : undefined}
		>
			<div
				className={cn(
					"relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm transition-all duration-200",
					canUseHoverPreview && "group-hover:border-primary/30 group-hover:shadow-md",
				)}
			>
				<div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
					{onOpenProject && template.project ? (
						<MagicTooltip
							title={tSuper("mySlidesTemplates.openProject")}
							placement="top"
						>
							<Button
								type="button"
								size="icon"
								variant="secondary"
								className={cn(
									"size-9 bg-background/95 text-foreground shadow-md backdrop-blur transition-[opacity,transform] active:scale-[0.96] sm:size-8",
									canUseHoverPreview &&
										!template.is_favorite &&
										"opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
								)}
								aria-label={tSuper("mySlidesTemplates.openProject")}
								onClick={handleOpenProjectClick}
								data-testid="slides-preset-card-open-project-button"
							>
								<FolderOpen className="size-4" />
							</Button>
						</MagicTooltip>
					) : null}
					{onFavoriteToggle ? (
						<MagicTooltip title={favoriteLabel} placement="top">
							<Button
								type="button"
								size="icon"
								variant="secondary"
								className={cn(
									"size-9 bg-background/95 text-muted-foreground shadow-md backdrop-blur transition-[color,opacity,transform] active:scale-[0.96] sm:size-8",
									canUseHoverPreview &&
										!template.is_favorite &&
										"opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
									template.is_favorite && "text-rose-500",
								)}
								aria-label={favoriteLabel}
								aria-pressed={template.is_favorite}
								disabled={favoritePending}
								data-testid="slides-preset-card-favorite-button"
								onClick={handleFavoriteClick}
							>
								<SlidesTemplateFavoriteIcon
									isFavorite={Boolean(template.is_favorite)}
									className="size-4"
								/>
							</Button>
						</MagicTooltip>
					) : null}
					{onRemove ? (
						<MagicTooltip title={tSuper("mySlidesTemplates.remove")} placement="top">
							<Button
								type="button"
								size="icon"
								variant="secondary"
								className={cn(
									"size-9 bg-background/95 text-destructive shadow-md backdrop-blur transition-[opacity,transform] active:scale-[0.96] sm:size-8",
									canUseHoverPreview &&
										"opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
								)}
								aria-label={tSuper("mySlidesTemplates.remove")}
								disabled={removePending}
								data-testid="slides-preset-card-remove-button"
								onClick={handleRemoveClick}
							>
								<Trash2 className="size-4" />
							</Button>
						</MagicTooltip>
					) : null}
				</div>
				{template.thumbnail_url ? (
					<>
						{!isThumbnailLoaded && (
							<div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-muted/30">
								<ImageIcon className="h-6 w-6 text-muted-foreground/30" />
							</div>
						)}
						<img
							crossOrigin="anonymous"
							src={template.thumbnail_url}
							alt={label}
							className={cn(
								"pointer-events-none size-full object-cover transition-all duration-300 ease-out",
								canUseHoverPreview && "group-hover:scale-[1.02]",
								isThumbnailLoaded ? "opacity-100" : "opacity-0",
							)}
							loading="lazy"
							onLoad={() => setIsThumbnailLoaded(true)}
							data-testid="set-is-thumbnail-loaded"
						/>
					</>
				) : (
					<div
						className={cn(
							"flex size-full items-center justify-center bg-muted/30 px-3 text-center text-sm text-muted-foreground transition-transform duration-300 ease-out",
							canUseHoverPreview && "group-hover:scale-[1.02]",
						)}
					>
						{label}
					</div>
				)}
				{showUsageCount ? (
					<>
						<div
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-black/[0.58] via-black/[0.18] to-transparent transition-opacity duration-200",
								shouldShowHoverDetails && "group-hover:opacity-0",
							)}
							data-testid="slides-preset-card-usage-backdrop"
						/>
						<span
							className={cn(
								"pointer-events-none absolute bottom-2 right-2 z-30 inline-flex items-center gap-1 text-xs font-medium leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.72)] transition-opacity duration-200",
								shouldShowHoverDetails && "group-hover:opacity-0",
							)}
							data-testid="slides-preset-card-usage-count"
							data-usage-count={usageCount}
						>
							<MousePointerClick className="size-3 shrink-0" aria-hidden="true" />
							{t("playbook.edit.presets.form.usageCount", {
								count: formattedUsageCount,
							})}
						</span>
					</>
				) : null}
				<div
					className={cn(
						"absolute inset-0 z-20 flex items-center justify-center gap-2.5 bg-black/0 opacity-0 transition-all duration-200 group-focus-within:bg-black/30 group-focus-within:opacity-100",
						canUseHoverPreview && "group-hover:bg-black/30 group-hover:opacity-100",
						isSelected && "bg-black/30 opacity-100",
					)}
				>
					<div
						className={cn(
							"flex translate-y-2 items-center gap-2.5 opacity-0 transition-all duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100",
							canUseHoverPreview &&
								"group-hover:translate-y-0 group-hover:opacity-100",
							isSelected && "translate-y-0 opacity-100",
							!canUseHoverPreview && isSelected && "absolute right-2 top-2",
						)}
						data-testid="slides-preset-card-action-group"
					>
						<Button
							type="button"
							size="sm"
							variant="default"
							data-testid="slides-preset-card-use-button"
							aria-pressed={isSelected}
							className="h-7 gap-1 rounded-full px-2 text-xs font-medium shadow-lg transition-transform duration-200 hover:scale-105"
							onClick={handleUseClick}
						>
							<Check className="size-3.5" />
							{t(
								isSelected
									? "playbook.edit.presets.form.selected"
									: "playbook.edit.presets.form.select",
							)}
						</Button>
						{canPreview && canUseHoverPreview && (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								data-testid="slides-preset-card-preview-button"
								className="inline-flex h-7 gap-1 rounded-full bg-background/95 px-2 text-xs font-medium shadow-lg transition-transform duration-200 hover:scale-105"
								onClick={handlePreviewClick}
							>
								<Eye className="size-3.5" />
								{t("playbook.edit.presets.form.preview")}
							</Button>
						)}
					</div>
				</div>
				{canPreview && !canUseHoverPreview ? (
					<Button
						type="button"
						size="icon"
						variant="secondary"
						className="absolute bottom-2 left-2 z-30 size-9 rounded-full bg-background/95 text-foreground shadow-lg backdrop-blur sm:size-8"
						data-testid="slides-preset-card-touch-preview-button"
						aria-label={t("playbook.edit.presets.form.preview")}
						onClick={handlePreviewClick}
					>
						<Eye className="size-4" />
					</Button>
				) : null}
			</div>
			<div
				className={cn(
					"flex min-w-0 items-center justify-center gap-1.5 text-sm font-medium leading-5 text-foreground/90 transition-colors duration-200",
					canUseHoverPreview && "group-hover:text-foreground",
				)}
			>
				{featuredTag ? (
					<FeaturedTagIcon
						label={featuredLabel}
						testId="slides-preset-card-featured-badge"
					/>
				) : null}
				<span className="min-w-0 truncate">{label}</span>
			</div>
		</div>
	)

	if (shouldShowHoverDetails) {
		const description = template.description ? lt(template.description) : ""
		const subText = template.sub_text ? lt(template.sub_text) : ""

		return (
			<HoverCard openDelay={HOVER_DETAILS_OPEN_DELAY_MS} closeDelay={100}>
				<HoverCardTrigger asChild>{cardContent}</HoverCardTrigger>
				<HoverCardContent
					container={hoverDetailsContainer}
					side="right"
					align="start"
					sideOffset={16}
					style={{ zIndex: "calc(var(--z-index-popup, 1000) + 1)" }}
					className={cn(
						"pointer-events-none w-[480px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border/50 bg-card p-0 shadow-2xl backdrop-blur-xl",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
					)}
				>
					<div className="flex flex-col">
						{template.collage_url && (
							<div className="relative min-h-[270px] overflow-hidden bg-black/5 shadow-inner">
								{!isCollageLoaded && (
									<div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-muted/20">
										<ImageIcon className="h-8 w-8 text-muted-foreground/20" />
									</div>
								)}
								<img
									crossOrigin="anonymous"
									src={template.collage_url}
									alt={`${label} collage preview`}
									className={cn(
										"relative z-10 w-full object-cover transition-opacity duration-300",
										isCollageLoaded ? "opacity-100" : "opacity-0",
									)}
									loading="lazy"
									onLoad={() => setIsCollageLoaded(true)}
									data-testid="set-is-collage-loaded"
								/>
								<div className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-foreground/5" />
							</div>
						)}
						<div className="flex flex-col gap-1.5 px-4 py-3.5">
							<div className="flex items-center justify-between gap-3">
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<h3 className="min-w-0 truncate text-sm font-semibold text-foreground/90">
										{label}
									</h3>
									{featuredTag ? (
										<FeaturedTagBadge
											label={featuredLabel}
											testId="slides-preset-hover-featured-badge"
										/>
									) : null}
									{subText && (
										<span className="shrink-0 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-secondary-foreground/80">
											{subText}
										</span>
									)}
								</div>
								{showUsageCount && (
									<span
										className="inline-flex shrink-0 items-center gap-1 text-xs font-medium leading-none text-muted-foreground"
										data-testid="slides-preset-hover-usage-count"
									>
										<MousePointerClick
											className="size-3 shrink-0"
											aria-hidden="true"
										/>
										{t("playbook.edit.presets.form.usageCount", {
											count: formattedUsageCount,
										})}
									</span>
								)}
							</div>
							{description && (
								<p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground/75">
									{description}
								</p>
							)}
						</div>
					</div>
				</HoverCardContent>
			</HoverCard>
		)
	}

	return cardContent
}

function getTemplateTestIdSuffix(template: OptionItem) {
	const value = localeTextToDisplayString(template.value)
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
}

export default SlidesPresetCard
