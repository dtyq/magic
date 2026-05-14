import { useCallback, useMemo, useState } from "react"
import type { RecycleBinItemData } from "../components/RecycleBinItem"

export function useMobileRecycleBinSelection(filteredItems: RecycleBinItemData[]) {
	const [selectedIds, setSelectedIds] = useState<string[]>([])

	const selectedCount = selectedIds.length

	const handleSelectionChange = useCallback((id: string, selected: boolean) => {
		setSelectedIds((prev) =>
			selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
		)
	}, [])

	const handleSelectAll = useCallback(() => {
		setSelectedIds(filteredItems.map((item) => item.id))
	}, [filteredItems])

	const handleDeselectAll = useCallback(() => {
		setSelectedIds([])
	}, [])

	const isAllSelected = useMemo(
		() => selectedCount === filteredItems.length && filteredItems.length > 0,
		[selectedCount, filteredItems.length],
	)

	return {
		selectedIds,
		setSelectedIds,
		selectedCount,
		isAllSelected,
		handleSelectionChange,
		handleSelectAll,
		handleDeselectAll,
	}
}
