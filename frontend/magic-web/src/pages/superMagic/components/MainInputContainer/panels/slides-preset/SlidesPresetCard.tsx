import {
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react"
import { Eye, Image as ImageIcon, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/shadcn-ui/hover-card"
import { Button } from "@/components/shadcn-ui/button"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/utils"
import type { OptionItem } from "../types"
import { useLocaleText } from "../hooks/useLocaleText"
import { localeTextToDisplayString } from "../utils"

interface SlidesPresetCardProps {
	template: OptionItem
	isSelected?: boolean
	onClick?: (template: OptionItem) => void
	onPreviewClick?: (template: OptionItem) => void
	onPreviewPreload?: (template: OptionItem) => void
}

const PREVIEW_PRELOAD_DELAY_MS = 1000

function SlidesPresetCard({
	template,
	isSelected = false,
	onClick,
	onPreviewClick,
	onPreviewPreload,
}: SlidesPresetCardProps) {
	const lt = useLocaleText()
	const { t } = useTranslation("crew/create")
	const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isThumbnailLoaded, setIsThumbnailLoaded] = useState(false)
	const [isCollageLoaded, setIsCollageLoaded] = useState(false)

	const label = lt(template.label) ?? lt(template.value) ?? ""
	const testIdSuffix = getTemplateTestIdSuffix(template)
	const canPreview = Boolean(template.preview_url)

	useEffect(() => {
		return () => {
			clearPreviewPreloadTimer()
		}
	}, [])

	function handleClick() {
		magicToast.success(t("playbook.edit.presets.form.selectedTemplate", { name: label }))
		onClick?.(template)
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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

	function handlePreviewIntentStart() {
		if (!canPreview || preloadTimerRef.current) return

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
				"hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
			)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			onMouseEnter={handlePreviewIntentStart}
			onMouseLeave={handleMouseLeave}
			onFocus={handlePreviewIntentStart}
			onBlur={handleBlur}
		>
			<div
				className={cn(
					"relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm transition-all duration-200",
					"group-hover:border-primary/30 group-hover:shadow-md",
				)}
			>
				{template.thumbnail_url ? (
					<>
						{!isThumbnailLoaded && (
							<div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-muted/30">
								<ImageIcon className="h-6 w-6 text-muted-foreground/30" />
							</div>
						)}
						<img
							src={template.thumbnail_url}
							alt={label}
							className={cn(
								"pointer-events-none size-full object-cover transition-all duration-300 ease-out group-hover:scale-[1.02]",
								isThumbnailLoaded ? "opacity-100" : "opacity-0",
							)}
							loading="lazy"
							onLoad={() => setIsThumbnailLoaded(true)}
						/>
					</>
				) : (
					<div className="flex size-full items-center justify-center bg-muted/30 px-3 text-center text-sm text-muted-foreground transition-transform duration-300 ease-out group-hover:scale-[1.02]">
						{label}
					</div>
				)}
				<div className="absolute inset-0 z-20 flex items-center justify-center gap-2.5 bg-black/0 opacity-0 transition-all duration-200 group-focus-within:bg-black/30 group-focus-within:opacity-100 group-hover:bg-black/30 group-hover:opacity-100">
					<Button
						type="button"
						size="sm"
						variant="default"
						data-testid="slides-preset-card-use-button"
						className="h-7 translate-y-2 gap-1 rounded-full px-2 text-xs font-medium opacity-0 shadow-lg transition-all duration-300 hover:scale-105 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
						onClick={handleUseClick}
					>
						<Check className="size-3.5" />
						{t("playbook.edit.presets.form.select")}
					</Button>
					{canPreview && (
						<Button
							type="button"
							size="sm"
							variant="secondary"
							data-testid="slides-preset-card-preview-button"
							className="h-7 translate-y-2 gap-1 rounded-full bg-background/95 px-2 text-xs font-medium opacity-0 shadow-lg transition-all duration-300 hover:scale-105 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
							onClick={handlePreviewClick}
						>
							<Eye className="size-3.5" />
							{t("playbook.edit.presets.form.preview")}
						</Button>
					)}
				</div>
			</div>
			<div className="truncate text-center text-sm font-medium leading-5 text-foreground/90 transition-colors duration-200 group-hover:text-foreground">
				{label}
			</div>
		</div>
	)

	if (template.collage_url || template.description) {
		const description = template.description ? lt(template.description) : ""
		const subText = template.sub_text ? lt(template.sub_text) : ""

		return (
			<HoverCard openDelay={150} closeDelay={100}>
				<HoverCardTrigger asChild>{cardContent}</HoverCardTrigger>
				<HoverCardContent
					side="right"
					align="start"
					sideOffset={16}
					className={cn(
						"pointer-events-none z-[100] w-[420px] overflow-hidden rounded-xl border border-border/50 bg-card p-0 shadow-2xl backdrop-blur-xl",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
					)}
				>
					<div className="flex flex-col">
						{template.collage_url && (
							<div className="relative min-h-[236px] overflow-hidden bg-black/5 shadow-inner">
								{!isCollageLoaded && (
									<div className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-muted/20">
										<ImageIcon className="h-8 w-8 text-muted-foreground/20" />
									</div>
								)}
								<img
									src={template.collage_url}
									alt={`${label} collage preview`}
									className={cn(
										"relative z-10 w-full object-cover transition-opacity duration-300",
										isCollageLoaded ? "opacity-100" : "opacity-0",
									)}
									loading="lazy"
									onLoad={() => setIsCollageLoaded(true)}
								/>
								<div className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-foreground/5" />
							</div>
						)}
						<div className="flex flex-col gap-1.5 px-4 py-3.5">
							<div className="flex items-start justify-between gap-3">
								<h3 className="line-clamp-1 flex-1 text-sm font-semibold text-foreground/90">
									{label}
								</h3>
								{subText && (
									<span className="shrink-0 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-secondary-foreground/80">
										{subText}
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
