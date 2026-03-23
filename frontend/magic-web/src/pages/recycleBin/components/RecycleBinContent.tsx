import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import { RecycleBinApi } from "@/apis"
import { RecycleBinList } from "./RecycleBinList"
import { RecycleBinModals } from "./RecycleBinModals"
import { RecycleBinToolbar } from "./RecycleBinToolbar"
import {
	mapRecycleBinItem as mapRecycleBinItemFromDomain,
	updateTabCounts as updateTabCountsFromDomain,
	type RecycleBinItem,
} from "./recycle-bin-domain"
import { useRecycleBinActions } from "./useRecycleBinActions"
import { useRecycleBinSelection } from "./useRecycleBinSelection"

export function RecycleBinContent({ activeTab, onTabCountChange }: RecycleBinContentProps) {
	const { t } = useTranslation("super")
	const [searchValue, setSearchValue] = useState("")
	const [items, setItems] = useState<RecycleBinItem[]>([])
	const [hasError, setHasError] = useState(false)

	const trimmedSearchValue = searchValue.trim()
	const queryParams = useMemo(
		() => ({
			keyword: trimmedSearchValue ? trimmedSearchValue : undefined,
			order: "desc" as const,
			page: 1,
			page_size: 100,
		}),
		[trimmedSearchValue],
	)

	const { run, loading } = useRequest(RecycleBinApi.getRecycleBinList, {
		manual: true,
		onBefore: () => {
			setHasError(false)
		},
		onSuccess: (data) => {
			const nextItems = data.list.map((item) => mapRecycleBinItemFromDomain(item, t))
			setItems(nextItems)
			updateTabCountsFromDomain({
				items: nextItems,
				onTabCountChange,
			})
		},
		onError: () => {
			setHasError(true)
		},
	})

	useEffect(() => {
		run(queryParams)
	}, [queryParams, run])

	const selection = useRecycleBinSelection({
		items,
		activeTabId: activeTab?.id,
	})
	const actions = useRecycleBinActions({
		items,
		setItems,
		selectedIds: selection.selectedIds,
		hasMixedSelectionTypes: selection.hasMixedSelectionTypes,
		onTabCountChange,
		onRefresh: () => run(queryParams),
	})

	const hasItems = selection.visibleItems.length > 0
	const shouldShowEmpty = !loading && !hasError && !hasItems
	const title = activeTab ? t(activeTab.labelKey, { count: activeTab.count }) : ""

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3.5" data-testid="recycle-bin-content">
			<RecycleBinToolbar
				title={title}
				searchValue={searchValue}
				hasSelection={selection.hasSelection}
				isAllSelected={selection.isAllSelected}
				isPartiallySelected={selection.isPartiallySelected}
				hasMixedSelectionTypes={selection.hasMixedSelectionTypes}
				onToggleSelectAll={selection.handleToggleSelectAll}
				onCancelSelection={selection.clearSelection}
				onRestoreSelection={actions.handleRestoreSelected}
				onDeleteSelection={actions.handleDeleteSelected}
				onSearchChange={setSearchValue}
				onSearchReset={() => setSearchValue("")}
				t={t}
			/>

			<div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
				<RecycleBinList
					items={selection.visibleItems}
					selectedIds={selection.selectedIds}
					loading={loading}
					hasError={hasError}
					shouldShowEmpty={shouldShowEmpty}
					onToggleItem={selection.handleToggleItem}
					onRetry={() => run(queryParams)}
					onOpenRestore={actions.openRestoreModal}
					onOpenDelete={(item) => actions.setDeleteTarget({ kind: "item", item })}
					t={t}
				/>
			</div>

			<RecycleBinModals
				items={items}
				restoreTarget={actions.restoreTarget}
				restoreCheckResult={actions.restoreCheckResult}
				deleteTarget={actions.deleteTarget}
				moveProjectModalOpen={actions.moveProjectModalOpen}
				selectPathModalOpen={actions.selectPathModalOpen}
				selectPathTarget={actions.selectPathTarget}
				selectPathSelectedWorkspace={actions.selectPathSelectedWorkspace}
				selectPathSelectedProject={actions.selectPathSelectedProject}
				workspaces={actions.workspaces}
				isMoveProjectLoading={actions.isMoveProjectLoadingCombined}
				isPermanentDeleteLoading={actions.isPermanentDeleteLoading}
				onRestoreOpenChange={actions.handleRestoreModalOpenChange}
				onDeleteOpenChange={actions.handleDeleteModalOpenChange}
				onConfirmRestore={actions.handleConfirmRestore}
				onConfirmDelete={actions.handleConfirmDelete}
				onMoveProjectClose={actions.handleMoveProjectClose}
				onMoveProjectConfirm={actions.handleMoveProject}
				onSelectPathClose={actions.handleSelectPathClose}
				onSelectPathSubmit={actions.handleSelectPathSubmit}
				t={t}
			/>
		</div>
	)
}

interface RecycleBinContentProps {
	activeTab: RecycleBinTab | undefined
	onTabCountChange?: (tabId: string, count: number) => void
}

interface RecycleBinTab {
	id: string
	labelKey: string
	count: number
}
