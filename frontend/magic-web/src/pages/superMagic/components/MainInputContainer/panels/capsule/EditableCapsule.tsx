import { useTranslation } from "react-i18next"
import { Ellipsis, PencilLine, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useLocaleText } from "../hooks/useLocaleText"
import type { OptionItem } from "../types"

interface EditableCapsuleProps {
	items: OptionItem[]
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: OptionItem) => void
	onDelete: (value: string) => void
}

interface EditableCapsuleItemProps {
	item: OptionItem
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
	const label = lt(item.label) ?? item.value

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
			data-testid={`editable-capsule-item-${item.value}`}
		>
			<Checkbox
				checked={isSelected}
				onCheckedChange={(checked) => onSelect(item.value, !!checked)}
				data-testid={`editable-capsule-item-checkbox-${item.value}`}
			/>
			<div
				className={cn(
					"shadow-xs flex h-9 items-center gap-2 rounded-full border border-border px-4 py-2 transition-[border-color]",
					isSelected && "border-2 border-primary",
				)}
			>
				{item.icon_url && <LucideLazyIcon icon={item.icon_url} size={16} />}
				<span className="text-sm font-medium leading-5">{label}</span>
			</div>
			<MagicDropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
				<span>
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0"
						data-testid={`editable-capsule-item-menu-${item.value}`}
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
			{items.map((item) => (
				<EditableCapsuleItem
					key={item.value}
					item={item}
					isSelected={selectedKeys.has(item.value)}
					onSelect={onSelect}
					onEdit={() => onEdit(item)}
					onDelete={() => onDelete(item.value)}
				/>
			))}
		</div>
	)
}
