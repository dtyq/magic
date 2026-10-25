import { Award, Check, Eye, FolderOpen, Image as ImageIcon } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import {
	getFeaturedSlidesTemplateTag,
	getSlidesTemplateTagDisplayName,
} from "@/pages/superMagic/components/MainInputContainer/panels/slides-preset/templateMeta"
import SlidesTemplateFavoriteIcon from "@/pages/superMagic/components/MainInputContainer/panels/slides-preset/SlidesTemplateFavoriteIcon"
import SlidesTemplateGlowBorder from "./SlidesTemplateGlowBorder"
import SlidesTemplateColorPalette from "./SlidesTemplateColorPalette"
import { applyResolvedTemplateColors } from "./templateColors"
import { useResolvedTemplateColors } from "./useResolvedTemplateColors"

interface SlidesTemplateCoverTileProps {
	canPreview: boolean
	favoritePending?: boolean
	imageUrl?: string
	imageLoading?: "eager" | "lazy"
	isKeyboardAccessible?: boolean
	isExpanded: boolean
	isSelected: boolean
	onFindSimilarColors?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onPreviewClick: () => void
	onPreviewIntent?: (template: OptionItem) => void
	onSelect: (template: OptionItem) => void
	template: OptionItem
}
export default function SlidesTemplateCoverTile({
	canPreview,
	favoritePending = false,
	imageUrl,
	imageLoading = "lazy",
	isKeyboardAccessible = true,
	isExpanded,
	isSelected,
	onFindSimilarColors,
	onFavoriteToggle,
	onOpenProject,
	onPreviewClick,
	onPreviewIntent,
	onSelect,
	template,
}: SlidesTemplateCoverTileProps) {
	const { t, i18n } = useTranslation("crew/create")
	const { t: tSuper } = useTranslation("super")
	const lt = useLocaleText()
	const label = lt(template.label) ?? lt(template.value) ?? ""
	const featuredTag = getFeaturedSlidesTemplateTag(template)
	const featuredLabel = getSlidesTemplateTagDisplayName(featuredTag, i18n.language, {
		zh_CN: "精选",
		en_US: "Featured",
	})
	const coverUrl = imageUrl
	const favoriteLabel = template.is_favorite
		? tSuper("mySlidesTemplates.unfavorite")
		: tSuper("mySlidesTemplates.favorite")
	const showGlowBorder = isSelected || isExpanded
	const [hasRequestedInteractiveColors, setHasRequestedInteractiveColors] = useState(false)
	const previewIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const colors = useResolvedTemplateColors({
		colors: template.colors,
		enabled: showGlowBorder || hasRequestedInteractiveColors,
		imageUrl: coverUrl,
		priority: "interactive",
	})

	useEffect(() => clearPreviewIntentTimer, [])

	function handlePreviewIntentStart() {
		setHasRequestedInteractiveColors(true)
		if (!onPreviewIntent || previewIntentTimerRef.current) return

		previewIntentTimerRef.current = setTimeout(() => {
			previewIntentTimerRef.current = null
			onPreviewIntent(template)
		}, 300)
	}

	function clearPreviewIntentTimer() {
		if (!previewIntentTimerRef.current) return
		clearTimeout(previewIntentTimerRef.current)
		previewIntentTimerRef.current = null
	}

	function handleSelect() {
		onSelect(applyResolvedTemplateColors(template, colors))
	}

	function handlePreview() {
		if (!canPreview) return
		clearPreviewIntentTimer()
		onPreviewClick()
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.target !== event.currentTarget) return
		if (event.key !== "Enter" && event.key !== " ") return

		event.preventDefault()
		handlePreview()
	}

	function handlePreviewClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		clearPreviewIntentTimer()
		onPreviewClick()
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

	return (
		<div
			role={isKeyboardAccessible ? "button" : undefined}
			tabIndex={isKeyboardAccessible ? 0 : -1}
			aria-hidden={isKeyboardAccessible ? undefined : true}
			data-testid="slides-template-cover-tile"
			className={cn(
				"group relative size-full overflow-hidden rounded-lg bg-zinc-900 opacity-[0.86] shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none ring-1 ring-inset ring-white/[0.08] transition-[opacity,transform,box-shadow,ring-color] motion-reduce:transition-none",
				"focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
				"hover:z-10 hover:opacity-100 hover:shadow-[0_14px_36px_rgba(0,0,0,0.32)] hover:ring-white/[0.18]",
				!isSelected && !isExpanded && "duration-200 ease-out hover:scale-[1.006]",
				isSelected &&
					"z-20 opacity-100 shadow-[0_20px_48px_rgba(0,0,0,0.42)] ring-1 ring-inset ring-white/[0.24]",
				!isSelected &&
					isExpanded &&
					"z-30 opacity-100 shadow-[0_18px_44px_rgba(0,0,0,0.38)] ring-1 ring-inset ring-white/[0.2] duration-200 ease-out",
			)}
			onPointerEnter={handlePreviewIntentStart}
			onPointerLeave={clearPreviewIntentTimer}
			onFocusCapture={handlePreviewIntentStart}
			onBlurCapture={clearPreviewIntentTimer}
			onClick={handlePreview}
			onKeyDown={handleKeyDown}
		>
			{showGlowBorder ? (
				<SlidesTemplateGlowBorder emphasized={isSelected} radius={7} />
			) : null}
			{colors.length > 0 ? (
				<SlidesTemplateColorPalette
					className={cn(
						"absolute right-2.5 top-2.5 z-20 transition-opacity duration-200",
						showGlowBorder
							? "opacity-100"
							: "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
					)}
					colors={colors}
					compact
					onClick={
						onFindSimilarColors
							? () =>
									onFindSimilarColors(
										applyResolvedTemplateColors(template, colors),
									)
							: undefined
					}
					tabIndex={isKeyboardAccessible ? 0 : -1}
				/>
			) : null}
			{coverUrl ? (
				<img
					key={coverUrl}
					crossOrigin="anonymous"
					src={coverUrl}
					alt={label}
					className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
					loading={imageLoading}
					decoding="async"
					draggable={false}
				/>
			) : (
				<div className="flex size-full items-center justify-center bg-zinc-800 px-4 text-center text-sm text-white/70">
					<ImageIcon className="mr-2 size-4 shrink-0 text-white/35" />
					<span className="line-clamp-2">{label}</span>
				</div>
			)}

			{featuredTag ? (
				<span
					role="img"
					aria-label={featuredLabel}
					title={featuredLabel}
					className="pointer-events-none absolute left-2.5 top-2.5 isolate z-20 inline-flex h-6 items-center gap-1 rounded-full border border-amber-100/65 bg-gradient-to-r from-amber-300 via-amber-300 to-amber-400 px-2 text-[11px] font-semibold leading-none text-zinc-950 shadow-[0_2px_8px_rgba(120,53,15,0.34)] ring-1 ring-inset ring-white/25 before:absolute before:-inset-2 before:-z-10 before:rounded-full before:bg-amber-300/50 before:blur-md"
					data-testid="slides-template-cover-featured-badge"
				>
					<Award className="size-3.5" aria-hidden="true" />
					<span>{featuredLabel}</span>
				</span>
			) : null}

			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/[0.68] via-black/[0.22] to-transparent opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
			<div className="absolute inset-x-0 bottom-0 flex min-w-0 translate-y-1.5 items-center justify-between gap-2 px-2.5 py-2 opacity-0 transition-[opacity,transform] duration-200 ease-out group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
				<span className="min-w-0 truncate text-xs font-medium leading-5 text-white/95 drop-shadow">
					{label}
				</span>
				<div
					className="flex shrink-0 origin-bottom-right items-center gap-1.5 [transform:scale(var(--slides-template-canvas-action-scale,1))]"
					data-testid="slides-template-cover-actions"
				>
					{onOpenProject && template.project ? (
						<MagicTooltip
							title={tSuper("mySlidesTemplates.openProject")}
							placement="top"
						>
							<Button
								type="button"
								size="icon"
								variant="secondary"
								className="size-7 rounded-full bg-white/[0.92] text-zinc-950 shadow-md backdrop-blur hover:bg-white"
								aria-label={tSuper("mySlidesTemplates.openProject")}
								tabIndex={isKeyboardAccessible ? 0 : -1}
								onClick={handleOpenProjectClick}
								data-testid="slides-template-cover-open-project-button"
							>
								<FolderOpen className="size-3.5" />
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
									"size-7 rounded-full bg-white/[0.92] text-zinc-950 shadow-md backdrop-blur transition-[color,transform] hover:bg-white active:scale-[0.96] motion-reduce:transition-none",
									template.is_favorite && "text-rose-600",
								)}
								aria-label={favoriteLabel}
								aria-pressed={template.is_favorite}
								disabled={favoritePending}
								tabIndex={isKeyboardAccessible ? 0 : -1}
								onClick={handleFavoriteClick}
								data-testid="slides-template-cover-favorite-button"
							>
								<SlidesTemplateFavoriteIcon
									isFavorite={Boolean(template.is_favorite)}
									className="size-3.5"
								/>
							</Button>
						</MagicTooltip>
					) : null}
					<MagicTooltip title={t("playbook.edit.presets.form.select")} placement="top">
						<Button
							type="button"
							size="icon"
							variant="secondary"
							className="size-7 rounded-full bg-white/[0.92] text-zinc-950 shadow-md backdrop-blur hover:bg-white"
							aria-label={t("playbook.edit.presets.form.select")}
							tabIndex={isKeyboardAccessible ? 0 : -1}
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								handleSelect()
							}}
							data-testid="slides-template-cover-select-button"
						>
							<Check className="size-3.5" />
						</Button>
					</MagicTooltip>
					{canPreview ? (
						<MagicTooltip
							title={t("playbook.edit.presets.form.preview")}
							placement="top"
						>
							<Button
								type="button"
								size="icon"
								variant="secondary"
								className={cn(
									"size-7 rounded-full bg-white/[0.92] text-zinc-950 shadow-md backdrop-blur hover:bg-white",
									isExpanded &&
										"bg-primary text-primary-foreground hover:bg-primary",
								)}
								aria-label={t("playbook.edit.presets.form.preview")}
								tabIndex={isKeyboardAccessible ? 0 : -1}
								onClick={handlePreviewClick}
								data-testid="slides-template-cover-preview-button"
							>
								<Eye className="size-3.5" />
							</Button>
						</MagicTooltip>
					) : null}
				</div>
			</div>
		</div>
	)
}
