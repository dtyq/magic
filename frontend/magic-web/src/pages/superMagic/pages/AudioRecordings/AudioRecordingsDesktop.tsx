import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { Check, Loader2 } from "lucide-react"
import { useDebounce } from "ahooks"
import { observer } from "mobx-react-lite"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AudioProjectListItem } from "@/types/audioProject"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import AudioRecordingCard from "./components/AudioRecordingCard"
import { AudioRecordingDeleteDialog } from "./components/AudioRecordingDeleteDialog"
import { AudioRecordingRenameDialog } from "./components/AudioRecordingRenameDialog"
import AudioRecordingsFilters, {
	resolveDatePresetRange,
	type AudioRecordingsDatePreset,
} from "./components/AudioRecordingsFilters"
import { AudioRecordingsStore } from "./stores/audio-recordings-store"
import { resolveRecordingDisplayName } from "./utils/audio-recordings-utils"

const SEARCH_DEBOUNCE_MS = 300

interface AudioRecordingsDesktopProps {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

/** Desktop list panel: header, filters, cards, and infinite scroll for audio recordings */
function AudioRecordingsDesktop({ scrollViewportRef }: AudioRecordingsDesktopProps) {
	const { t } = useTranslation("audioRecordings")
	const navigate = useNavigate()
	const storeRef = useRef(new AudioRecordingsStore())
	const store = storeRef.current

	const [searchKeyword, setSearchKeyword] = useState("")
	const [isSearchComposing, setIsSearchComposing] = useState(false)
	const [datePreset, setDatePreset] = useState<AudioRecordingsDatePreset>("all")
	const [renameTarget, setRenameTarget] = useState<AudioProjectListItem | null>(null)
	const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null)
	const debouncedKeyword = useDebounce(searchKeyword, { wait: SEARCH_DEBOUNCE_MS })

	const handleAutoLoadMore = useCallback(() => {
		void store.loadMore()
	}, [store])

	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: store.loading || store.loadingMore || !store.hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	useEffect(() => {
		store.registerPollerCallbacks()
		return () => {
			store.disposePoller()
			store.reset()
		}
	}, [store])

	useEffect(() => {
		if (isSearchComposing) return
		void store.fetchList({ page: 1, keyword: debouncedKeyword.trim() })
	}, [
		store,
		debouncedKeyword,
		isSearchComposing,
		store.summaryFilter,
		store.createdAtStart,
		store.createdAtEnd,
		store.sortBy,
		store.sortOrder,
	])

	function handleSummaryFilterChange(value: typeof store.summaryFilter) {
		store.setSummaryFilter(value)
	}

	function handleDatePresetChange(value: AudioRecordingsDatePreset) {
		setDatePreset(value)
		const range = resolveDatePresetRange(value)
		store.setDateRange(range.start, range.end)
	}

	function handleOpenDetail(item: AudioProjectListItem) {
		navigate({
			name: RouteName.AudioRecordingDetail,
			params: { projectId: item.id },
			state: {
				projectName: resolveRecordingDisplayName(item.project_name, item.created_at),
				cardStatus: item.card_status,
				audioFileId: item.audio_file_id,
			},
		})
	}

	/** Re-fetch page 1 with current filters so users can pick up APP-side status changes */
	function handleRefresh() {
		void store.fetchList({ page: 1, keyword: debouncedKeyword.trim() })
	}

	function handleRenameRequest(item: AudioProjectListItem) {
		setRenameTarget(item)
	}

	function handleDeleteRequest(item: AudioProjectListItem) {
		setDeleteTargetIds([item.id])
	}

	async function handleRenameConfirm(projectId: string, name: string) {
		const success = await store.renameProject(projectId, name)
		if (success) {
			toast.success(t("actions.renameSuccess"))
			setRenameTarget(null)
			return
		}

		toast.error(t("actions.renameFailed"))
	}

	async function handleDeleteConfirm(projectIds: string[]) {
		const success = await store.batchDeleteProjects(projectIds)
		if (success) {
			toast.success(t("actions.deleteSuccess"))
			setDeleteTargetIds(null)
			return
		}

		toast.error(t("actions.deleteFailed"))
	}

	async function handleSummarize(item: AudioProjectListItem) {
		const result = await store.submitSummary(item)
		if (result.ok) return

		if (result.reason === "missingParams") {
			toast.error(t("summary.missingParams"))
			return
		}
		if (result.reason === "missingModel") {
			toast.error(t("summary.missingModel"))
			return
		}
		if (result.reason === "api") {
			toast.error(t("summary.submitFailed"))
		}
	}

	const isRefreshing = store.loading && !store.loadingMore
	const emptyMessage = debouncedKeyword.trim() ? t("empty.search") : t("empty.description")

	return (
		<div
			className="mt-5 flex w-full min-w-0 flex-col gap-5 sm:gap-6"
			data-testid="audio-recordings-desktop"
		>
			<div className="flex min-w-0 flex-col gap-2">
				<h1 className="break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold leading-tight text-transparent sm:text-3xl lg:text-4xl">
					{t("pageTitle")}
				</h1>
				<p className="hidden max-w-2xl break-words text-sm text-muted-foreground">
					{t("subtitle")}
				</p>
			</div>

			<AudioRecordingsFilters
				listCount={store.list.length}
				summaryFilter={store.summaryFilter}
				datePreset={datePreset}
				sortBy={store.sortBy}
				sortOrder={store.sortOrder}
				searchKeyword={searchKeyword}
				isRefreshing={isRefreshing}
				onSummaryFilterChange={handleSummaryFilterChange}
				onDatePresetChange={handleDatePresetChange}
				onSortByChange={(value) => store.setSort(value, store.sortOrder)}
				onSortOrderChange={(value) => store.setSort(store.sortBy, value)}
				onSearchKeywordChange={setSearchKeyword}
				onSearchCompositionStart={() => setIsSearchComposing(true)}
				onSearchCompositionEnd={() => setIsSearchComposing(false)}
				onRefresh={handleRefresh}
			/>

			{store.showInitialSkeleton ? (
				<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					{t("loading")}
				</div>
			) : null}

			{!store.showInitialSkeleton && store.isEmpty ? (
				<div
					className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center"
					data-testid="audio-recordings-empty"
				>
					<p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
					<p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
				</div>
			) : null}

			{!store.showInitialSkeleton && store.list.length > 0 ? (
				<div
					className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
					data-testid="audio-recordings-card-list"
				>
					{store.list.map((item) => (
						<AudioRecordingCard
							key={item.id}
							item={item}
							onOpen={handleOpenDetail}
							onSummarize={(entry) => void handleSummarize(entry)}
							onRename={handleRenameRequest}
							onDelete={handleDeleteRequest}
							isSubmitting={store.isSubmittingSummary(item.id)}
						/>
					))}
				</div>
			) : null}

			{store.loadingMore ? (
				<div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					{t("loadingMore")}
				</div>
			) : null}

			{!store.hasMore && store.list.length > 0 && !store.loading ? (
				<div
					className="flex items-center justify-center gap-1 py-2 opacity-30"
					data-testid="audio-recordings-no-more"
				>
					<Check className="size-4" />
					<span className="text-xs">{t("end")}</span>
				</div>
			) : null}

			<div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />

			<AudioRecordingRenameDialog
				open={renameTarget != null}
				item={renameTarget}
				isSubmitting={renameTarget != null && store.isSubmittingAction(renameTarget.id)}
				onOpenChange={(open) => {
					if (!open) setRenameTarget(null)
				}}
				onConfirm={handleRenameConfirm}
			/>

			<AudioRecordingDeleteDialog
				projectIds={deleteTargetIds}
				onClose={() => setDeleteTargetIds(null)}
				onConfirm={handleDeleteConfirm}
			/>
		</div>
	)
}

export default observer(AudioRecordingsDesktop)
