import { useEffect, useRef, useState } from "react"
import { SearchableMultiSelect } from "@magic-admin-v2/components/searchable-multi-select"
import type { SearchableMultiSelectOption } from "@magic-admin-v2/components/searchable-multi-select"
import { MarketCategoryBadges } from "@magic-admin-v2/features/platform-official-marketplace/components/market-table-cells"
import {
	areSameCategoryIds,
	normalizeCategoryIds,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"

type MarketCategorySelectCellProps = {
	ariaLabel: string
	canEdit: boolean
	categoryIds: string[]
	categoryLabels: string[]
	categoryOptions: SearchableMultiSelectOption[]
	clearLabel: string
	emptyLabel: string
	isLoading: boolean
	isSaving: boolean
	disabled?: boolean
	noMatchingLabel: string
	onSave: (categoryIds: string[]) => void | Promise<void>
	searchPlaceholder: string
	selectedCountLabel: (count: number) => string
}

/** Keeps category selection state inside the table cell until the popover closes. */
export function MarketCategorySelectCell({
	ariaLabel,
	canEdit,
	categoryIds,
	categoryLabels,
	categoryOptions,
	clearLabel,
	emptyLabel,
	isLoading,
	isSaving,
	disabled,
	noMatchingLabel,
	onSave,
	searchPlaceholder,
	selectedCountLabel,
}: MarketCategorySelectCellProps) {
	const [open, setOpen] = useState(false)
	const [draftCategoryIds, setDraftCategoryIds] = useState(() =>
		normalizeCategoryIds(categoryIds),
	)
	const draftCategoryIdsRef = useRef(draftCategoryIds)

	useEffect(() => {
		if (open) return

		const nextCategoryIds = normalizeCategoryIds(categoryIds)
		if (areSameCategoryIds(draftCategoryIdsRef.current, nextCategoryIds)) return

		draftCategoryIdsRef.current = nextCategoryIds
		setDraftCategoryIds(nextCategoryIds)
	}, [categoryIds, open])

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			const nextCategoryIds = normalizeCategoryIds(categoryIds)
			draftCategoryIdsRef.current = nextCategoryIds
			setDraftCategoryIds(nextCategoryIds)
			setOpen(true)
			return
		}

		setOpen(false)
		void onSave(draftCategoryIdsRef.current)
	}

	function handleChange(nextCategoryIds: string[]) {
		const normalizedCategoryIds = normalizeCategoryIds(nextCategoryIds)
		draftCategoryIdsRef.current = normalizedCategoryIds
		setDraftCategoryIds(normalizedCategoryIds)
	}

	if (!categoryOptions.length && !isLoading) {
		return <MarketCategoryBadges labels={categoryLabels} />
	}

	return (
		<SearchableMultiSelect
			ariaLabel={ariaLabel}
			className="w-[220px]"
			clearButtonTestId="platform-official-marketplace-multi-select-clear-button"
			clearLabel={clearLabel}
			contentTestId="platform-official-marketplace-multi-select-content"
			disabled={disabled ?? (!canEdit || isSaving || isLoading)}
			emptyLabel={emptyLabel}
			emptyTestId="platform-official-marketplace-multi-select-empty"
			isLoading={isSaving || isLoading}
			loadingTestId="platform-official-marketplace-multi-select-loading"
			maxVisibleItems={1}
			noMatchingLabel={noMatchingLabel}
			onChange={handleChange}
			onOpenChange={handleOpenChange}
			open={open}
			optionTestId="platform-official-marketplace-multi-select-option"
			options={categoryOptions}
			searchClearButtonTestId="platform-official-marketplace-multi-select-search-clear-button"
			searchInputTestId="platform-official-marketplace-multi-select-search-input"
			searchPlaceholder={searchPlaceholder}
			selectedCountLabel={selectedCountLabel}
			triggerTestId="platform-official-marketplace-multi-select-trigger"
			value={draftCategoryIds}
		/>
	)
}
