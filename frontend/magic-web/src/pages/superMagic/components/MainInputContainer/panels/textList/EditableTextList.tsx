import { useTranslation } from "react-i18next"
import { Ellipsis, PencilLine, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useLocaleText } from "../hooks/useLocaleText"
import type { IdentifiedOptionItem } from "../types"

interface EditableTextListProps {
	items: IdentifiedOptionItem[]
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: IdentifiedOptionItem) => void
	onDelete: (value: string) => void
}

interface EditableTextListItemProps {
	item: IdentifiedOptionItem
	isSelected: boolean
	onSelect: (value: string, checked: boolean) => void
	onEdit: () => void
	onDelete: () => void
}

function EditableTextListItem({
	item,
	isSelected,
	onSelect,
	onEdit,
	onDelete,
}: EditableTextListItemProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const itemValue = item.value
	const label = lt(item.label) ?? itemValue

	const menuItems = [
		{
			key: "edit",
			label: t("playbook.edit.inspiration.actions.edit"),
			icon: <PencilLine className="size-4" />,
			onClick: onEdit,
		},
		{
			key: "delete",
			label: t("playbook.edit.inspiration.actions.delete"),
			icon: <Trash2 className="size-4" />,
			danger: true,
			onClick: onDelete,
		},
	]

	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-md px-4 py-2 text-sm shadow-xs transition-colors",
				isSelected ? "bg-secondary/80" : "bg-secondary",
			)}
			data-testid={`editable-text-list-item-${itemValue}`}
		>
			<Checkbox
				checked={isSelected}
				onCheckedChange={(checked) => onSelect(itemValue, !!checked)}
				data-testid={`editable-text-list-item-checkbox-${itemValue}`}
			/>
			<span className="min-w-0 flex-1 truncate text-left leading-5 text-secondary-foreground">
				{label}
			</span>
			<MagicDropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
				<span>
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0"
						data-testid={`editable-text-list-item-menu-${itemValue}`}
					>
						<Ellipsis className="size-4" />
					</Button>
				</span>
			</MagicDropdown>
		</div>
	)
}

export function EditableTextList({
	items,
	selectedKeys,
	onSelect,
	onEdit,
	onDelete,
}: EditableTextListProps) {
	return (
		<div className="flex w-full flex-col gap-2">
			{items.map((item) => {
				const itemValue = item.value
				return (
					<EditableTextListItem
						key={itemValue}
						item={item}
						isSelected={selectedKeys.has(itemValue)}
						onSelect={onSelect}
						onEdit={() => onEdit(item)}
						onDelete={() => onDelete(itemValue)}
					/>
				)
			})}
		</div>
	)
}
