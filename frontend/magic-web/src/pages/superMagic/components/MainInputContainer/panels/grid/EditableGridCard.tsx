import { useTranslation } from "react-i18next"
import { PencilLine, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface EditableGridCardProps {
	item: OptionItem
	isSelected: boolean
	onSelect: (value: string, checked: boolean) => void
	onEdit: () => void
	onDelete: () => void
}

export function EditableGridCard({
	item,
	isSelected,
	onSelect,
	onEdit,
	onDelete,
}: EditableGridCardProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const label = lt(item.label) ?? item.value

	return (
		<div
			className={cn(
				"group relative flex w-full flex-col gap-1.5 overflow-hidden rounded-lg p-1 transition-all",
				isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
			)}
			data-testid={`editable-grid-card-${item.value}`}
		>
			{/* Image area */}
			<div className="relative flex h-28 w-full flex-col overflow-hidden rounded-lg border border-border bg-background">
				{item.thumbnail_url ? (
					<div className="relative min-h-0 flex-1">
						<img
							src={item.thumbnail_url}
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

				{/* Hover overlay with Edit + Delete */}
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
						className="shadow-xs h-9 flex-1 gap-2"
						onClick={onEdit}
						data-testid={`editable-grid-card-edit-${item.value}`}
					>
						<PencilLine className="size-4" />
						{t("playbook.edit.inspiration.actions.edit")}
					</Button>
					<Button
						variant="destructive"
						size="icon"
						className="shadow-xs size-9 shrink-0"
						onClick={onDelete}
						data-testid={`editable-grid-card-delete-${item.value}`}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			{/* Label row */}
			<div className="flex w-full items-center justify-center gap-1 px-1">
				{item.icon_url && (
					<div className="relative size-4 shrink-0 overflow-hidden">
						<img src={item.icon_url} alt="icon" className="size-full object-contain" />
					</div>
				)}
				<p className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-sm leading-5 text-foreground">
					{label}
				</p>
			</div>

			{/* Checkbox top-left */}
			<div className="absolute left-2.5 top-2.5">
				<Checkbox
					checked={isSelected}
					onCheckedChange={(checked) => onSelect(item.value, !!checked)}
					data-testid={`editable-grid-card-checkbox-${item.value}`}
				/>
			</div>
		</div>
	)
}
