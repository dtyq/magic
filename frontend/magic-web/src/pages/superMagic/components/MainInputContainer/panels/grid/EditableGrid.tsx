import { EditableGridCard } from "./EditableGridCard"
import type { OptionItem } from "../types"

interface EditableGridProps {
	items: OptionItem[]
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: OptionItem) => void
	onDelete: (value: string) => void
}

export function EditableGrid({
	items,
	selectedKeys,
	onSelect,
	onEdit,
	onDelete,
}: EditableGridProps) {
	return (
		<div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
			{items.map((item) => (
				<EditableGridCard
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
