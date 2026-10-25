import { useEffect, useMemo, useState } from "react"
import type { RecycleBinItem } from "./recycle-bin-domain"
import { filterItemsByTab } from "./recycle-bin-domain"

interface UseRecycleBinSelectionParams {
	items: RecycleBinItem[]
	activeTabId?: string
	autoSelectLoaded?: boolean
	resetKey?: string
}

export function useRecycleBinSelection({
	items,
	activeTabId,
	autoSelectLoaded = true,
	resetKey,
}: UseRecycleBinSelectionParams) {
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [isSelectAllActive, setIsSelectAllActive] = useState(false)

	const visibleItems = useMemo(
		() => filterItemsByTab({ items, tabId: activeTabId }),
		[activeTabId, items],
	)
	const visibleItemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems])

	useEffect(() => {
		setIsSelectAllActive(false)
		setSelectedIds([])
	}, [activeTabId, resetKey])

	useEffect(() => {
		setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
	}, [items])

	useEffect(() => {
		if (!isSelectAllActive) return
		setSelectedIds(visibleItemIds)
	}, [isSelectAllActive, visibleItemIds])

	const visibleSelectedCount = visibleItemIds.filter((id) => selectedIds.includes(id)).length
	const isAllSelected =
		visibleItemIds.length > 0 && visibleSelectedCount === visibleItemIds.length
	const isPartiallySelected = visibleSelectedCount > 0 && !isAllSelected
	const hasSelection = visibleSelectedCount > 0
	const hasMixedSelectionTypes = useMemo(() => {
		if (selectedIds.length <= 1) return false
		const selectedItems = items.filter((item) => selectedIds.includes(item.id))
		if (selectedItems.length <= 1) return false
		const resourceType = selectedItems[0]?.resourceType
		return selectedItems.some((item) => item.resourceType !== resourceType)
	}, [items, selectedIds])

	function handleToggleSelectAll(checked: boolean) {
		if (!checked) {
			setIsSelectAllActive(false)
			setSelectedIds([])
			return
		}

		setIsSelectAllActive(autoSelectLoaded)
		setSelectedIds(visibleItemIds)
	}

	function handleToggleItem({ id, checked }: { id: string; checked: boolean }) {
		setIsSelectAllActive(false)
		if (checked) {
			setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
			return
		}

		setSelectedIds((prev) => prev.filter((x) => x !== id))
	}

	function clearSelection() {
		setIsSelectAllActive(false)
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
