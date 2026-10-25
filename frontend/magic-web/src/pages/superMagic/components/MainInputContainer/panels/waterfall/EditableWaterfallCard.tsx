import { useTranslation } from "react-i18next"
import { PencilLine, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import { useLocaleText } from "../hooks/useLocaleText"
import type { IdentifiedOptionItem } from "../types"

interface EditableWaterfallCardProps {
	item: IdentifiedOptionItem
	isSelected: boolean
	onSelect: (value: string, checked: boolean) => void
	onEdit: () => void
	onDelete: () => void
}

export function EditableWaterfallCard({
	item,
	isSelected,
	onSelect,
	onEdit,
	onDelete,
}: EditableWaterfallCardProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const itemValue = item.value
	const label = lt(item.label) ?? itemValue
	const description = lt(item.description) ?? ""

	const aspectRatio =
		item.aspect_ratio || (item.width && item.height ? item.width / item.height : undefined)

	return (
		<div
			className={cn(
				"group relative flex w-full flex-col gap-0 overflow-hidden rounded-md border border-border bg-background p-1 transition-all",
				isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
			)}
			data-testid={`editable-waterfall-card-${itemValue}`}
		>
			<div className="relative flex w-full flex-col items-start justify-center overflow-hidden rounded-sm">
				{item.thumbnail_url ? (
					<div
						className="relative w-full overflow-hidden"
						style={{ aspectRatio: aspectRatio ? String(aspectRatio) : undefined }}
					>
						<img
							src={item.thumbnail_url}
							alt={label}
							className="pointer-events-none size-full object-cover"
							loading="lazy"
							data-testid="editable-waterfall-card-image"
						/>
						{/* Label/description on thumbnail (overlay content) */}
						<div
							className={cn(
								"absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5",
								"bg-gradient-to-b from-transparent to-background/90",
								"px-3 pb-3 pt-16",
								"opacity-0 transition-opacity duration-200",
								"group-hover:opacity-100",
							)}
						>
							{label && (
								<p className="w-full truncate text-sm font-medium leading-5 text-foreground">
									{label}
								</p>
							)}
							{description && (
								<p className="line-clamp-3 w-full text-xs font-normal leading-4 text-foreground">
									{description}
								</p>
							)}
						</div>
					</div>
				) : (
					<div
						className="flex w-full flex-col items-center justify-center gap-2 rounded-sm bg-sidebar"
						style={{
							aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
							minHeight: aspectRatio ? undefined : "201px",
						}}
					>
						<span className="text-sm font-medium leading-5 text-foreground">
							{label}
						</span>
					</div>
				)}

				{/* Hover overlay with Edit + Delete (always visible on hover, ref: EditableGridCard) */}
				<div
					className={cn(
						"absolute inset-x-0 bottom-0 flex items-center gap-2",
						"bg-gradient-to-b from-transparent to-background/90",
						"px-3 pb-3 pt-16",
						"opacity-0 transition-opacity duration-200",
						"group-hover:opacity-100",
					)}
				>
					<Button
						size="sm"
						className="h-9 flex-1 gap-2 shadow-xs"
						onClick={onEdit}
						data-testid={`editable-waterfall-card-edit-${itemValue}`}
					>
						<PencilLine className="size-4" />
						{t("playbook.edit.inspiration.actions.edit")}
					</Button>
					<Button
						variant="destructive"
						size="icon"
						className="size-9 shrink-0 shadow-xs"
						onClick={onDelete}
						data-testid={`editable-waterfall-card-delete-${itemValue}`}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			{/* Checkbox top-left */}
			<div className="absolute left-2.5 top-2.5">
				<Checkbox
					checked={isSelected}
					onCheckedChange={(checked) => onSelect(itemValue, !!checked)}
					data-testid={`editable-waterfall-card-checkbox-${itemValue}`}
				/>
			</div>
		</div>
	)
}
