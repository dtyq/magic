import { useEffect, useMemo, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useRequest } from "ahooks"
import { RecycleBinApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	createRecycleBinTabCounts,
	RECYCLE_BIN_RESOURCE_TYPE_TO_TAB_ID,
	type RecycleBinTab,
	useRecycleBinTabLabel,
} from "../tab-config"
import { RecycleBinList } from "./RecycleBinList"
import { RecycleBinModals } from "./RecycleBinModals"
import { RecycleBinToolbar } from "./RecycleBinToolbar"
import {
	getResourceTypeByTabId,
	mapRecycleBinItem as mapRecycleBinItemFromDomain,
	type RecycleBinItem,
} from "./recycle-bin-domain"
import { useRecycleBinActions } from "./useRecycleBinActions"
import { useRecycleBinSelection } from "./useRecycleBinSelection"
import { useRecycleBinSearch } from "./useRecycleBinSearch"
import { RecycleBinSearchForm } from "./RecycleBinSearchForm"
import { buildRecycleBinGroups, type RecycleBinFileView } from "./recycle-bin-file-view"

import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"

const RECYCLE_BIN_PAGE_SIZE = 50
export function RecycleBinContent({
	activeTab,
	onTabCountChange,
	onMutationComplete,
	requireDeleteConfirmation = false,
	projectId,
	onPreview,
	onPreviewRemoved,
}: RecycleBinContentProps) {
	const { t } = useTranslation("super")
	const previewRequests = useRef(new Map<string, AbortController>())
	const previewIntent = useRef(0)
	useEffect(
		() => () => {
			previewRequests.current.forEach((controller) => controller.abort())
			previewRequests.current.clear()
		},
		[projectId],
	)
	const openPreview = useMemoizedFn(async (item: RecycleBinItem) => {
		if (
			!onPreview ||
			item.category !== "files" ||
			item.fileKind === "folder" ||
			projectId === ""
		)
			return
		const identityKey = getFileReferenceIdentityKey()
		if (!identityKey) return
		const intent = ++previewIntent.current
		previewRequests.current.get(item.id)?.abort()
		const controller = new AbortController()
		previewRequests.current.set(item.id, controller)
		try {
			const data = await RecycleBinApi.previewFile(item.id, projectId, controller.signal)
			if (controller.signal.aborted || getFileReferenceIdentityKey() !== identityKey) return
			const file: FileItem = {
				...data,
				file_url: data.url,
				recycleBin: { id: data.recycle_bin_id, identityKey, projectId },
				display_config: {
					previewPolicy: {
						standalone: true,
						readonly: true,
						editingPresence: false,
						allowShare: false,
						allowVersionHistory: false,
						syncWithAttachments: false,
						persistTab: false,
						restoreAsActive: false,
					},
				},
			}
			onPreview(file, intent === previewIntent.current)
		} catch {
			if (!controller.signal.aborted) magicToast.error(t("recycleBin.preview.unavailable"))
		} finally {
			if (previewRequests.current.get(item.id) === controller)
				previewRequests.current.delete(item.id)
		}
	})
	const handleRecordsChanged = useMemoizedFn(
		({ recordIds }: { kind: "restore" | "permanent-delete"; recordIds: string[] }) => {
			for (const id of recordIds) {
				previewRequests.current.get(id)?.abort()
				previewRequests.current.delete(id)
			}
			onPreviewRemoved?.(recordIds)
		},
	)
	const getTabLabel = useRecycleBinTabLabel("pc")
	const [searchValue, setSearchValue] = useState("")
	const [globalItems, setGlobalItems] = useState<RecycleBinItem[]>([])
	const [fileView, setFileView] = useState<RecycleBinFileView>("list")
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
	const isProject = projectId !== undefined
	const projectQuery = useRecycleBinSearch({ projectId, keyword: searchValue, view: fileView })
	const items = isProject ? projectQuery.items : globalItems
	const setItems = isProject ? projectQuery.setItems : setGlobalItems
	const groups = useMemo(
		() => (isProject ? buildRecycleBinGroups(items, fileView) : []),
		[items, isProject, fileView],
	)
	const shownItems = useMemo(
		() =>
			isProject && fileView === "location"
				? groups
						.filter((group) => expandedGroups.has(group.key))
						.flatMap((group) => group.items)
				: items,
		[isProject, fileView, groups, expandedGroups, items],
	)
	const expandFirstGroup = useMemoizedFn(() => {
		if (isProject && fileView === "location")
			setExpandedGroups(new Set(groups.slice(0, 1).map((group) => group.key)))
	})
	useEffect(expandFirstGroup, [projectQuery.resultVersion, expandFirstGroup])
	const [hasError, setHasError] = useState(false)
	const [total, setTotal] = useState(0)
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoadingMore, setIsLoadingMore] = useState(false)

	const activeTabId = activeTab?.id
	const trimmedSearchValue = searchValue.trim()
	const queryParams = useMemo(() => {
		const resourceType = getResourceTypeByTabId(activeTabId)
		return {
			...(resourceType ? { resource_type: resourceType } : {}),
			keyword: trimmedSearchValue ? trimmedSearchValue : undefined,
			order: "desc" as const,
			page: 1,
			page_size: RECYCLE_BIN_PAGE_SIZE,
		}
	}, [activeTabId, trimmedSearchValue])

	const refreshTabCounts = useMemoizedFn(async () => {
		if (isProject || !onTabCountChange) return
		const data = await RecycleBinApi.getRecycleBinCounts({
			keyword: queryParams.keyword,
		})
		const nextCounts = createRecycleBinTabCounts()
		data.forEach((item) => {
			const tabId = RECYCLE_BIN_RESOURCE_TYPE_TO_TAB_ID[item.resource_type]
			if (tabId) nextCounts[tabId] = item.count ?? 0
		})
		nextCounts.all = data.reduce((sum, item) => sum + (item.count ?? 0), 0)
		Object.entries(nextCounts).forEach(([tabId, count]) => {
			onTabCountChange(tabId, count)
		})
	})

	const { run, loading } = useRequest(RecycleBinApi.getRecycleBinList, {
		manual: true,
		onBefore: () => {
			setHasError(false)
		},
		onSuccess: (data) => {
			const nextItems = data.list.map((item) => mapRecycleBinItemFromDomain(item, t))
			setGlobalItems(nextItems)
			setTotal(data.total ?? nextItems.length)
			setCurrentPage(1)
			refreshTabCounts().catch((error) => console.error(error))
		},
		onError: () => {
			setHasError(true)
		},
	})

	useEffect(() => {
		if (!isProject) run(queryParams)
	}, [queryParams, run, isProject])

	useEffect(() => {
		refreshTabCounts().catch((error) => console.error(error))
	}, [refreshTabCounts, queryParams.keyword])

	const loadMore = useMemoizedFn(async () => {
		if (isLoadingMore || currentPage * RECYCLE_BIN_PAGE_SIZE >= total) return
		const nextPage = currentPage + 1
		setIsLoadingMore(true)
		try {
			const data = await RecycleBinApi.getRecycleBinList({
				...queryParams,
				page: nextPage,
			})
			const nextItems = data.list.map((item) => mapRecycleBinItemFromDomain(item, t))
			setGlobalItems((prev) => {
				const existingIds = new Set(prev.map((item) => item.id))
				const mergedItems = [
					...prev,
					...nextItems.filter((item) => !existingIds.has(item.id)),
				]
				return mergedItems
			})
			setTotal(data.total ?? total)
			setCurrentPage(nextPage)
		} catch {
			magicToast.error(t("operationFailed"))
		} finally {
			setIsLoadingMore(false)
		}
	})

	const selection = useRecycleBinSelection({
		items: shownItems,
		activeTabId,
		autoSelectLoaded: !isProject,
		resetKey: isProject ? projectQuery.scopeKey : undefined,
	})
	const refresh = useMemoizedFn(() => {
		if (isProject) {
			selection.clearSelection()
			projectQuery.refresh()
			return
		}
		run(queryParams)
		refreshTabCounts().catch((error) => console.error(error))
	})
	const actions = useRecycleBinActions({
		onRecordsChanged: handleRecordsChanged,
		onMutationComplete,
		items,
		setItems,
		selectedIds: selection.selectedIds,
		hasMixedSelectionTypes: selection.hasMixedSelectionTypes,
		onRefresh: refresh,
	})
	const busy = Boolean(
		actions.restoreTarget ||
		actions.deleteTarget ||
		actions.pendingNameConflictRestore ||
		actions.isActionPending,
	)
	const projectActionsDisabled = busy || projectQuery.status !== "ready"

	const hasItems = selection.visibleItems.length > 0
	const shouldShowEmpty = !loading && !hasError && !hasItems
	const title = isProject
		? projectQuery.total === null
			? ""
			: t("recycleBin.project.total", { count: projectQuery.total })
		: activeTab
			? getTabLabel(activeTab.id, activeTab.count)
			: ""

	return (
		<div
			className="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5"
			data-testid="recycle-bin-content"
		>
			<RecycleBinToolbar
				onRefresh={refresh}
				refreshing={
					loading ||
					isLoadingMore ||
					projectQuery.status === "loading" ||
					projectQuery.status === "searching" ||
					projectQuery.loadingMore
				}
				refreshDisabled={busy}
				fileView={isProject ? fileView : undefined}
				onFileViewChange={(next) => {
					if (next === "location" || fileView === "location") selection.clearSelection()
					setFileView(next)
				}}
				onSearchSubmit={() => void projectQuery.runSearch()}
				searchDisabled={isProject && (busy || !projectQuery.limits)}
				actionsDisabled={isProject && projectActionsDisabled}
				selectedCount={selection.selectedIds.length}
				queryForm={
					isProject && (
						<RecycleBinSearchForm
							query={projectQuery}
							byLocation={fileView === "location"}
							disabled={busy}
							onExit={() => {
								setSearchValue("")
								setFileView("list")
								selection.clearSelection()
							}}
						/>
					)
				}
				title={title}
				searchValue={searchValue}
				hasSelection={selection.hasSelection}
				isAllSelected={selection.isAllSelected}
				isPartiallySelected={selection.isPartiallySelected}
				onToggleSelectAll={selection.handleToggleSelectAll}
				onCancelSelection={selection.clearSelection}
				onRestoreSelection={actions.handleRestoreSelected}
				onDeleteSelection={actions.handleDeleteSelected}
				onSearchChange={setSearchValue}
				onSearchReset={() => setSearchValue("")}
			/>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
				<RecycleBinList
					onPreview={onPreview ? openPreview : undefined}
					project={
						isProject
							? {
									view: fileView,
									groups,
									expanded: expandedGroups,
									query: projectQuery,
									disabled: projectActionsDisabled,
									scopeMissing: !projectId,
									onToggleGroup: (key) => {
										selection.clearSelection()
										setExpandedGroups((previous) => {
											const next = new Set(previous)
											if (next.has(key)) next.delete(key)
											else next.add(key)
											return next
										})
									},
								}
							: undefined
					}
					items={selection.visibleItems}
					selectedIds={selection.selectedIds}
					loading={loading}
					loadingMore={isLoadingMore}
					hasMore={currentPage * RECYCLE_BIN_PAGE_SIZE < total}
					hasError={hasError}
					shouldShowEmpty={shouldShowEmpty}
					onLoadMore={loadMore}
					onToggleItem={selection.handleToggleItem}
					onRetry={() => run(queryParams)}
					onOpenRestore={actions.openRestoreModal}
					onOpenDelete={(item) => actions.setDeleteTarget({ kind: "item", item })}
					t={t}
				/>
			</div>

			<RecycleBinModals
				projectFileMode={isProject}
				isActionPending={actions.isActionPending}
				requireDeleteConfirmation={requireDeleteConfirmation}
				items={items}
				restoreTarget={actions.restoreTarget}
				restoreCheckResult={actions.restoreCheckResult}
				pendingNameConflictRestore={actions.pendingNameConflictRestore}
				deleteTarget={actions.deleteTarget}
				moveProjectModalOpen={actions.moveProjectModalOpen}
				selectPathModalOpen={actions.selectPathModalOpen}
				selectPathTarget={actions.selectPathTarget}
				selectPathSelectedWorkspace={actions.selectPathSelectedWorkspace}
				selectPathSelectedProject={actions.selectPathSelectedProject}
				workspaces={actions.workspaces}
				isMoveProjectLoading={actions.isMoveProjectLoadingCombined}
				isPermanentDeleteLoading={actions.isPermanentDeleteLoading}
				isResolvingAllNameConflicts={actions.isResolvingAllNameConflicts}
				onRestoreOpenChange={actions.handleRestoreModalOpenChange}
				onDeleteOpenChange={actions.handleDeleteModalOpenChange}
				onConfirmRestore={actions.handleConfirmRestore}
				onNameConflictRestoreCancel={actions.handleNameConflictRestoreCancel}
				onNameConflictRestoreReplace={actions.handleNameConflictRestoreReplace}
				onNameConflictRestoreSkip={actions.handleNameConflictRestoreSkip}
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
	onPreview?: (file: FileItem, activate: boolean) => void
	onPreviewRemoved?: (recordIds: string[]) => void
	/** undefined 保留全局入口；项目入口缺失 ID 时传空串并阻止全局回退。 */
	projectId?: string
	onMutationComplete?: () => void
	requireDeleteConfirmation?: boolean
	activeTab: RecycleBinTab | undefined
	onTabCountChange?: (tabId: string, count: number) => void
}
