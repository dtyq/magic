import { cn } from "@/lib/utils"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface TemplateCardProps {
	template: OptionItem
	isSelected?: boolean
	onClick?: (template: OptionItem) => void
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
	const lt = useLocaleText()
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
							alt={lt(template.label) ?? template.value}
							className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
							loading="lazy"
						/>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<span className="text-sm text-muted-foreground">
							{lt(template.label) ?? template.value}
						</span>
					</div>
				)}
			</div>
			<div className="flex w-full items-center justify-center gap-1">
				{template.icon_url && (
					<div className="relative size-4 shrink-0 overflow-hidden">
						<img
							src={template.icon_url}
							alt="AI"
							className="size-full object-contain"
						/>
					</div>
				)}
				<div className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-sm leading-5 text-foreground">
					{lt(template.label) ?? template.value}
				</div>
			</div>
		</div>
	)
}

export default TemplateCard
