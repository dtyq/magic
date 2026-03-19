import { cn } from "@/lib/utils"
import { Loader2, Zap } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface WaterfallCardProps {
	template: OptionItem
	isSelected?: boolean
	onClick?: (template: OptionItem) => void
}

/**
 * Waterfall card component for template display
 * Implements Figma design: node-id=5606-26295
 * Hover state: gradient overlay with title, description, and action button
 */
function WaterfallCard({ template, isSelected, onClick }: WaterfallCardProps) {
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const hasImage = !!template.thumbnail_url

	// Calculate aspect ratio from template dimensions to prevent layout shift
	const aspectRatio =
		template.aspect_ratio ||
		(template.width && template.height ? template.width / template.height : undefined)

	const resolvedLabel = lt(template.label)
	const resolvedDescription = lt(template.description)
	const resolvedSubText = lt(template.sub_text)
	const hasHoverContent = !!(resolvedLabel || resolvedDescription || resolvedSubText)

	return (
		<div
			className={cn(
				"group relative flex w-full cursor-pointer flex-col gap-0 overflow-hidden rounded-md border border-border bg-background p-1 transition-all",
				"hover:shadow-md",
				isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
			)}
			onClick={() => onClick?.(template)}
		>
			{/* Image container with fixed aspect ratio to prevent layout shift */}
			<div className="relative flex w-full flex-col items-start justify-center overflow-hidden rounded-sm">
				{hasImage ? (
					<div
						className="relative w-full overflow-hidden"
						style={{
							aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
						}}
					>
						<img
							src={template.thumbnail_url}
							alt={resolvedLabel ?? template.value}
							className="pointer-events-none size-full object-cover"
							loading="lazy"
						/>

						{/* Hover overlay: gradient + content, visible on group hover */}
						{hasHoverContent && (
							<div
								className={cn(
									"absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5",
									"bg-gradient-to-b from-transparent to-background/90",
									"px-3 pb-3 pt-16",
									"opacity-0 transition-opacity duration-200",
									"group-hover:opacity-100",
								)}
							>
								{resolvedLabel && (
									<p className="w-full truncate text-sm font-medium leading-5 text-foreground">
										{resolvedLabel}
									</p>
								)}
								{resolvedDescription && (
									<p className="line-clamp-3 w-full text-xs font-normal leading-4 text-foreground">
										{resolvedDescription}
									</p>
								)}
								<div className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 shadow-xs">
									<Zap className="size-4 text-primary-foreground" />
									<p className="whitespace-nowrap text-sm font-medium leading-5 text-primary-foreground">
										{t("waterfallCard.tryNow")}
									</p>
								</div>
							</div>
						)}
					</div>
				) : (
					<div
						className="flex w-full flex-col items-center justify-center gap-2 rounded-sm bg-sidebar"
						style={{
							aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
							minHeight: aspectRatio ? undefined : "201px",
						}}
					>
						<Loader2 className="size-9 animate-spin text-muted-foreground" />
						<p className="text-sm font-medium leading-5 text-foreground">
							{t("waterfallCard.loadingImage")}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default WaterfallCard
