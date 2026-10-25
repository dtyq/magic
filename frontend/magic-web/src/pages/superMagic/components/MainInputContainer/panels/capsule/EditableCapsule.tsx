import { useTranslation } from "react-i18next"
import { Ellipsis, PencilLine, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useLocaleText } from "../hooks/useLocaleText"
import type { IdentifiedOptionItem } from "../types"
import { isImageIconSource } from "../utils"

interface EditableCapsuleProps {
	items: IdentifiedOptionItem[]
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: IdentifiedOptionItem) => void
	onDelete: (value: string) => void
}

interface EditableCapsuleItemProps {
	item: IdentifiedOptionItem
	isSelected: boolean
	onSelect: (value: string, checked: boolean) => void
	onEdit: () => void
	onDelete: () => void
}

function EditableCapsuleItem({
	item,
	isSelected,
	onSelect,
	onEdit,
	onDelete,
}: EditableCapsuleItemProps) {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const itemValue = item.value
	const label = lt(item.label) ?? itemValue
	const isImageIcon = isImageIconSource(item.icon_url)

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
			className="flex items-center gap-1.5"
			data-testid={`editable-capsule-item-${itemValue}`}
		>
			<Checkbox
				checked={isSelected}
				onCheckedChange={(checked) => onSelect(itemValue, !!checked)}
				data-testid={`editable-capsule-item-checkbox-${itemValue}`}
			/>
			<div
				className={cn(
					"flex h-9 items-center gap-2 rounded-full border border-border px-4 py-2 shadow-xs transition-[border-color]",
					isSelected && "border-2 border-primary",
				)}
			>
				{item.icon_url &&
					(isImageIcon ? (
						<img
							src={item.icon_url}
							alt={label}
							width={16}
							height={16}
							className="shrink-0 object-contain"
							loading="lazy"
							data-testid="editable-capsule-image"
						/>
					) : (
						<LucideLazyIcon icon={item.icon_url} size={16} />
					))}
				<span className="text-sm font-medium leading-5">{label}</span>
			</div>
			<MagicDropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
				<span>
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0"
						data-testid={`editable-capsule-item-menu-${itemValue}`}
					>
						<Ellipsis className="size-4" />
					</Button>
				</span>
			</MagicDropdown>
		</div>
	)
}

export function EditableCapsule({
	items,
	selectedKeys,
	onSelect,
	onEdit,
	onDelete,
}: EditableCapsuleProps) {
	return (
		<div className="flex w-full flex-wrap content-start items-start gap-2">
			{items.map((item) => {
				const itemValue = item.value
				return (
					<EditableCapsuleItem
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
