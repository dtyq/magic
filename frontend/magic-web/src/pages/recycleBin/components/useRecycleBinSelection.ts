import { useEffect, useMemo, useState } from "react"
import type { RecycleBinItem } from "./recycle-bin-domain"
import { filterItemsByTab } from "./recycle-bin-domain"

interface UseRecycleBinSelectionParams {
	items: RecycleBinItem[]
	activeTabId?: string
}

export function useRecycleBinSelection({ items, activeTabId }: UseRecycleBinSelectionParams) {
	const [selectedIds, setSelectedIds] = useState<string[]>([])

	const visibleItems = useMemo(
		() => filterItemsByTab({ items, tabId: activeTabId }),
		[activeTabId, items],
	)

	useEffect(() => {
		setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
	}, [items])

	const isAllSelected = visibleItems.length > 0 && selectedIds.length === visibleItems.length
	const isPartiallySelected = selectedIds.length > 0 && !isAllSelected
	const hasSelection = selectedIds.length > 0
	const hasMixedSelectionTypes = useMemo(() => {
		if (selectedIds.length <= 1) return false
		const selectedItems = items.filter((item) => selectedIds.includes(item.id))
		if (selectedItems.length <= 1) return false
		const resourceType = selectedItems[0]?.resourceType
		return selectedItems.some((item) => item.resourceType !== resourceType)
	}, [items, selectedIds])

	function handleToggleSelectAll(checked: boolean) {
		if (!checked) {
			setSelectedIds([])
			return
		}

		setSelectedIds(visibleItems.map((item) => item.id))
	}

	function handleToggleItem({ id, checked }: { id: string; checked: boolean }) {
		if (checked) {
			setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
			return
		}

		setSelectedIds((prev) => prev.filter((x) => x !== id))
	}

	function clearSelection() {
		setSelectedIds([])
	}

	return {
		selectedIds,
		setSelectedIds,
		visibleItems,
		isAllSelected,
		isPartiallySelected,
		hasSelection,
		hasMixedSelectionTypes,
		handleToggleSelectAll,
		handleToggleItem,
		clearSelection,
	}
}
