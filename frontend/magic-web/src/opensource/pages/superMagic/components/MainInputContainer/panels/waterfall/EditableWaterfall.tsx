import { useMemo } from "react"
import { EditableWaterfallCard } from "./EditableWaterfallCard"
import { useWaterfallColumns } from "./useWaterfallColumns"
import type { OptionItem } from "../types"
import { localeTextToDisplayString } from "../utils"

interface EditableWaterfallProps {
	items: OptionItem[]
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: OptionItem) => void
	onDelete: (value: string) => void
	maxColumns?: number
}

export function EditableWaterfall({
	items,
	selectedKeys,
	onSelect,
	onEdit,
	onDelete,
	maxColumns = 3,
}: EditableWaterfallProps) {
	const { containerRef, columns } = useWaterfallColumns(maxColumns)

	const columnItems = useMemo(() => {
		const cols: OptionItem[][] = Array.from({ length: columns }, () => [])
		items.forEach((item, index) => cols[index % columns].push(item))
		return cols
	}, [items, columns])

	return (
		<div ref={containerRef} className="flex w-full items-start gap-2">
			{columnItems.map((colItems, colIndex) => (
				<div key={colIndex} className="flex flex-1 flex-col gap-2">
					{colItems.map((item, itemIndex) => {
						const itemValue = localeTextToDisplayString(item.value)

						return (
							<EditableWaterfallCard
								key={itemValue || `${colIndex}-${itemIndex}`}
								item={item}
								isSelected={selectedKeys.has(itemValue)}
								onSelect={onSelect}
								onEdit={() => onEdit(item)}
								onDelete={() => onDelete(itemValue)}
							/>
						)
					})}
				</div>
			))}
		</div>
	)
}
