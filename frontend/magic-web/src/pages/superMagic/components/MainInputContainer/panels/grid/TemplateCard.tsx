import { cn } from "@/lib/utils"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"
import { isImageIconSource } from "../utils"

interface TemplateCardProps {
	template: OptionItem
	isSelected?: boolean
	onClick?: (template: OptionItem) => void
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
	const lt = useLocaleText()
	const label = lt(template.label) ?? template.value
	const isImageIcon = isImageIconSource(template.icon_url)
	return (
		<div
			className={cn(
				"group relative flex w-full cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg p-1 transition-all",
				"hover:bg-sidebar-accent",
				isSelected && "bg-blue-600/20",
			)}
			onClick={() => onClick?.(template)}
		>
			<div className="flex h-28 w-full flex-col overflow-hidden rounded-lg border border-border bg-background">
				{template.thumbnail_url ? (
					<div className="relative min-h-0 min-w-0 flex-1">
						<img
							src={template.thumbnail_url}
							alt={label}
							className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
							loading="lazy"
						/>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<span className="text-sm text-muted-foreground">{label}</span>
					</div>
				)}
			</div>
			<div className="flex w-full items-center justify-center gap-1">
				{template.icon_url && (
					<div className="relative size-4 shrink-0 overflow-hidden">
						{isImageIcon ? (
							<img
								src={template.icon_url}
								alt={label}
								className="size-full object-contain"
								loading="lazy"
							/>
						) : (
							<LucideLazyIcon icon={template.icon_url} size={16} />
						)}
					</div>
				)}
				<div className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-sm leading-5 text-foreground">
					{label}
				</div>
			</div>
		</div>
	)
}

export default TemplateCard
