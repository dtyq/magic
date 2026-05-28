import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { InfiniteScroll } from "antd-mobile"
import { X, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import CrossProjectFileOperationModal from "@/pages/superMagic/components/SelectPathModal/components/CrossProjectFileOperationModal"
import MoveProjectModal from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MoveProjectModal"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import RecycleBinItem from "./RecycleBinItem"
import RecycleBinOrphanWarnSheet from "./RecycleBinOrphanWarnSheet"
import MobileTrashRestorePickerSheet from "./MobileTrashRestorePickerSheet"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { useMobileRecycleBinList } from "../hooks/useMobileRecycleBinList"
import { useMobileRecycleBinSelection } from "../hooks/useMobileRecycleBinSelection"
import { useMobileRecycleBinRestoreFlow } from "../hooks/useMobileRecycleBinRestoreFlow"
import TrashSelectionBar from "./TrashSelectionBar"

interface RecycleBinContentProps {
	activeTab?: string
	searchValue?: string
	order?: "desc" | "asc"
	onTabCountChange?: (tabId: string, count: number) => void
	onSelectionStateChange?: (hasSelection: boolean) => void
	onEmptyStateChange?: (shouldStretch: boolean) => void
	/** 外部触发刷新的信号计数器，值每次变化时组件重新加载第 1 页数据 */
	refreshSignal?: number
}

function RecycleBinContent(props: RecycleBinContentProps) {
	const {
		activeTab = "all",
		searchValue = "",
		order = "desc",
		onTabCountChange,
		onSelectionStateChange,
		onEmptyStateChange,
		refreshSignal,
	} = props
	const { t } = useTranslation("super")

	const {
		items,
		setItems,
		filteredItems,
		loading,
		hasError,
		queryParams,
		run,
		debouncedSearchValue,
		hasMore,
		loadMore,
	} = useMobileRecycleBinList({
		activeTab,
		searchValue,
		order,
		onTabCountChange,
	})

	const {
		selectedIds,
		setSelectedIds,
		selectedCount,
		handleSelectionChange,
		handleSelectAll,
		handleDeselectAll,
	} = useMobileRecycleBinSelection(filteredItems)

	const isAllSelected = selectedCount === filteredItems.length && filteredItems.length > 0
	const selectionBarMount =
		typeof document !== "undefined"
			? document.getElementById("mobile-recycle-bin-selection-mount")
			: null

	useEffect(() => {
		onSelectionStateChange?.(selectedCount > 0)
	}, [selectedCount, onSelectionStateChange])

	useEffect(() => {
		setSelectedIds((prev) => prev.filter((id) => items.some((i) => i.id === id)))
	}, [items, setSelectedIds])

	/** refreshSignal 每次变化时重新加载第 1 页，被 MobileRecycleBinPanel 的下拉刷新触发。*/
	const prevRefreshSignalRef = useRef(refreshSignal)
	useEffect(() => {
		if (prevRefreshSignalRef.current !== refreshSignal) {
			prevRefreshSignalRef.current = refreshSignal
			run(queryParams)
		}
	}, [refreshSignal, run, queryParams])

	const restoreFlow = useMobileRecycleBinRestoreFlow({
		items,
		setItems,
		selectedIds,
		setSelectedIds,
		queryParams,
		run,
	})

	useEffect(() => {
		if (
			!restoreFlow.selectPathModalOpen &&
			!restoreFlow.moveProjectModalOpen &&
			!restoreFlow.restorePickerOpen
		)
			return
		SuperMagicService.workspace
			.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			})
			.catch((error) => console.error(error))
	}, [
		restoreFlow.selectPathModalOpen,
		restoreFlow.moveProjectModalOpen,
		restoreFlow.restorePickerOpen,
	])

	useEffect(() => {
		if (restoreFlow.selectPathTarget?.type !== "topic" || !restoreFlow.selectPathWorkspaceId)
			return
		projectStore
			.loadProjectsForWorkspace(restoreFlow.selectPathWorkspaceId)
			.catch((error) => console.error(error))
	}, [restoreFlow.selectPathTarget?.type, restoreFlow.selectPathWorkspaceId])

	// Keep project list in sync when restore picker advances to the project step.
	useEffect(() => {
		if (!restoreFlow.restorePickerOpen || !restoreFlow.restorePickerWorkspaceId) return
		projectStore
			.loadProjectsForWorkspace(restoreFlow.restorePickerWorkspaceId)
			.catch((error) => console.error(error))
	}, [restoreFlow.restorePickerOpen, restoreFlow.restorePickerWorkspaceId])

	const hasItems = filteredItems.length > 0
	const isSearchActive = debouncedSearchValue.length > 0
	const shouldStretchEmptyState =
		!loading && ((items.length === 0 && isSearchActive) || items.length === 0 || !hasItems)

	useEffect(() => {
		onEmptyStateChange?.(shouldStretchEmptyState)
		return () => onEmptyStateChange?.(false)
	}, [onEmptyStateChange, shouldStretchEmptyState])

	if (loading && items.length === 0) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-12"
				data-testid="mobile-recycle-bin-content"
			>
				<Spinner className="text-muted-foreground" />
				<span className="text-sm text-muted-foreground">{t("common.loading")}</span>
			</div>
		)
	}

	if (hasError && items.length === 0) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-12"
				data-testid="mobile-recycle-bin-content"
			>
				<div className="text-sm text-muted-foreground">
					{t("recycleBin.error.loadFailed")}
				</div>
				<Button variant="outline" size="sm" onClick={() => run(queryParams)}>
					{t("recycleBin.error.retry")}
				</Button>
			</div>
		)
	}

	if (!loading && items.length === 0 && isSearchActive) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center"
				data-testid="mobile-recycle-bin-content"
			>
				<DataEmptyState
					variant="search"
					className="flex-1"
					testId="mobile-recycle-bin-search-empty"
				/>
			</div>
		)
	}

	if (!loading && items.length === 0) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center"
				data-testid="mobile-recycle-bin-content"
			>
				<DataEmptyState
					variant="trash"
					className="flex-1"
					testId="mobile-recycle-bin-empty"
				/>
			</div>
		)
	}

	if (!hasItems) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center"
				data-testid="mobile-recycle-bin-content"
			>
				<DataEmptyState
					variant="search"
					className="flex-1"
					testId="mobile-recycle-bin-tab-empty"
				/>
			</div>
		)
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="mobile-recycle-bin-content">
			<div className="flex flex-col gap-1 pb-1">
				{filteredItems.map((item) => (
					<RecycleBinItem
						key={item.id}
						item={{
							...item,
							selected: selectedIds.includes(item.id),
						}}
						onSelectionChange={handleSelectionChange}
					/>
				))}

				{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
				<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
			</div>

			{selectedCount > 0 && selectionBarMount
				? createPortal(
						<TrashSelectionBar
							visibleTotal={filteredItems.length}
							isAllSelected={isAllSelected}
							onToggleAll={() =>
								isAllSelected ? handleDeselectAll() : handleSelectAll()
							}
							onRestore={() => void restoreFlow.requestRestoreSelection()}
							onPurge={restoreFlow.requestPermanentDelete}
						/>,
						selectionBarMount,
					)
				: null}

			{/* 彻底删除确认 Sheet */}
			<Sheet
				open={restoreFlow.purgeConfirmOpen}
				onOpenChange={(open) => !open && restoreFlow.closePurgeConfirm()}
			>
				<SheetContent
					side="bottom"
					showClose={false}
					aria-describedby={undefined}
					className="flex h-auto flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
					style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				>
					<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
						<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
					</div>

					<div className="mobile-popup-action-header relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
						<button
							type="button"
							onClick={restoreFlow.closePurgeConfirm}
							className="absolute left-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("mobile.recycleBin.purge.cancelAria")}
						>
							<X className="size-[22px] text-foreground" />
						</button>
						<SheetTitle className="max-w-[247px] truncate text-center text-[18px] font-semibold leading-none text-foreground">
							{restoreFlow.purgeConfirmTitle}
						</SheetTitle>
						<button
							type="button"
							onClick={() => void restoreFlow.confirmPermanentDelete()}
							className="absolute right-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-destructive shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("mobile.recycleBin.purge.confirmAria")}
						>
							<Check className="size-[22px] text-white" />
						</button>
					</div>

					<div className="flex flex-col items-center px-4 pb-12 pt-2">
						<p className="text-center text-[16px] leading-6 text-foreground">
							{restoreFlow.purgeConfirmMessage}
						</p>
					</div>
				</SheetContent>
			</Sheet>

			{/* 恢复确认 Sheet */}
			<Sheet
				open={restoreFlow.restoreConfirmOpen}
				onOpenChange={(open) => !open && restoreFlow.closeRestoreConfirm()}
			>
				<SheetContent
					side="bottom"
					showClose={false}
					aria-describedby={undefined}
					className="flex h-auto flex-col gap-0 overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
					style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				>
					<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
						<div className="h-1 w-20 rounded-full bg-muted-foreground/40" aria-hidden />
					</div>

					<div className="mobile-popup-action-header relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
						<button
							type="button"
							onClick={restoreFlow.closeRestoreConfirm}
							className="absolute left-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("mobile.recycleBin.restoreConfirm.cancelAria")}
						>
							<X className="size-[22px] text-foreground" />
						</button>
						<SheetTitle className="max-w-[247px] truncate text-center text-[18px] font-semibold leading-none text-foreground">
							{restoreFlow.restoreConfirmTitle}
						</SheetTitle>
						<button
							type="button"
							onClick={() => void restoreFlow.confirmRestore()}
							className="absolute right-[10px] top-1/2 flex size-12 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-primary shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("mobile.recycleBin.restoreConfirm.confirmAria")}
						>
							<Check className="size-[22px] text-primary-foreground" />
						</button>
					</div>

					<div className="flex flex-col items-center px-4 pb-12 pt-2">
						<p className="text-center text-[16px] leading-6 text-foreground">
							{restoreFlow.restoreConfirmMessage}
						</p>
					</div>
				</SheetContent>
			</Sheet>

			<RecycleBinOrphanWarnSheet
				open={restoreFlow.orphanMixedOpen}
				orphanItems={restoreFlow.orphanMixedItems}
				restorableCount={restoreFlow.orphanMixedRestorableCount}
				onCancel={restoreFlow.closeOrphanMixed}
				onRestoreOthers={() => void restoreFlow.handleOrphanRestoreDirectOnly()}
			/>

			<MobileTrashRestorePickerSheet
				open={restoreFlow.restorePickerOpen}
				itemTitle={restoreFlow.restorePickerItemTitle}
				resourceType={restoreFlow.restorePickerResourceType}
				workspaces={workspaceStore.workspaces}
				projects={restoreFlow.restorePickerProjects}
				isProjectsLoading={
					Boolean(restoreFlow.restorePickerWorkspaceId) &&
					projectStore.isLoadingWorkspace(restoreFlow.restorePickerWorkspaceId)
				}
				onWorkspaceSelect={restoreFlow.handleRestorePickerWorkspaceSelect}
				onClose={restoreFlow.handleRestorePickerClose}
				onConfirm={(payload) => void restoreFlow.handleRestorePickerConfirm(payload)}
			/>

			<MoveProjectModal
				workspaces={workspaceStore.workspaces}
				selectedWorkspace={workspaceStore.selectedWorkspace ?? undefined}
				isMoveProjectLoading={restoreFlow.isMoveProjectLoading}
				fetchWorkspaces={(params) => SuperMagicService.workspace.fetchWorkspaces(params)}
				open={restoreFlow.moveProjectModalOpen}
				onClose={restoreFlow.handleMoveProjectClose}
				onConfirm={restoreFlow.handleMoveProject}
			/>

			{restoreFlow.selectPathTarget && (
				<CrossProjectFileOperationModal
					visible={restoreFlow.selectPathModalOpen}
					title={t("recycleBin.selectPath.title")}
					operationType="move"
					selectedWorkspace={restoreFlow.selectPathSelectedWorkspace}
					selectedProject={restoreFlow.selectPathSelectedProject}
					workspaces={workspaceStore.workspaces}
					fileIds={[]}
					sourceAttachments={[]}
					selectProjectOnly={restoreFlow.selectPathTarget.type === "topic"}
					onClose={restoreFlow.handleSelectPathClose}
					onSubmit={(data) => void restoreFlow.handleSelectPathSubmit(data)}
				/>
			)}
		</div>
	)
}

export default observer(RecycleBinContent)
