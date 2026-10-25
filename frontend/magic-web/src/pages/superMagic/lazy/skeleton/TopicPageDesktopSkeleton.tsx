import { useState } from "react"
import { useParams } from "react-router"
import { TopicLayoutStore } from "../../pages/TopicPage/stores/TopicLayoutStore"
import {
	readOpenFromStorage,
	readTopicHistoryWidth,
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
} from "../../pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { projectStore } from "../../stores/core"
import { isAudioProjectMode } from "@/services/audioRecordings"
import { isReadOnlyProject } from "../../utils/permission"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { MagicSpin } from "@/components/base"
import MessageEditorSkeleton from "../../components/MainInputContainer/components/skeleton/MessageEditorSkeleton"

// function ResizeHandleSkeleton() {
// 	return (
// 		<div className="relative h-full w-2 shrink-0">
// 			<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70" />
// 		</div>
// 	)
// }

function TopicSidebarSkeleton({ compactHeader }: { compactHeader: boolean }) {
	return (
		<div className="flex h-full flex-col gap-2" data-testid="workspace-sidebar-wrapper">
			<div className="rounded-lg border border-border bg-background p-2">
				<div className="flex items-center gap-2">
					<Skeleton
						className={
							compactHeader ? "size-4 shrink-0 rounded-sm" : "size-8 rounded-lg"
						}
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<Skeleton className="h-4 w-4/5 rounded-sm" />
						<Skeleton className="h-3 w-3/5 rounded-sm" />
					</div>
					<Skeleton className="size-5 rounded-sm" />
					<Skeleton className="size-5 rounded-sm" />
					{compactHeader && <Skeleton className="size-5 rounded-sm" />}
				</div>
				<div className="mt-2 flex items-center justify-between border-t border-border pt-2">
					<Skeleton className="h-4 w-24 rounded-sm" />
					<Skeleton className="h-5 w-20 rounded-sm" />
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background p-2">
				<div className="space-y-2">
					<Skeleton className="h-7 rounded-md" />
					<Skeleton className="h-7 rounded-md" />
					<Skeleton className="h-7 rounded-md" />
				</div>
				<div className="mt-3">
					<MagicSpin spinning className="min-h-[220px]" />
				</div>
			</div>
		</div>
	)
}

/** Conversation column placeholder; the AI canvas project skeleton reuses it beside its canvas. */
export function TopicConversationSkeleton() {
	return (
		<div
			className="relative flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-lg"
			data-testid="topic-page-desktop-skeleton-message-loading"
		>
			<div className="flex h-11 items-center justify-between px-3">
				<div className="flex items-center gap-2">
					<Skeleton className="size-6 rounded-md" />
					<Skeleton className="h-4 w-28 rounded-sm" />
				</div>
				<Skeleton className="size-7 rounded-md" />
			</div>

			<div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center px-2 pb-2">
				<div className="flex-1 overflow-hidden py-3">
					<MagicSpin spinning className="h-full min-h-[220px]" />
				</div>

				<MessageEditorSkeleton />
			</div>
		</div>
	)
}

export function TopicPageDesktopSkeletonBase({
	showMessagePanel = true,
	enableSidebarCollapse = true,
}: {
	showMessagePanel?: boolean
	enableSidebarCollapse?: boolean
}) {
	const [layout] = useState(() => new TopicLayoutStore())
	const { projectId } = useParams()
	const project =
		projectStore.selectedProject?.id === projectId ? projectStore.selectedProject : null
	const useSidebarPreferences =
		enableSidebarCollapse &&
		!isAudioProjectMode(project?.project_mode) &&
		(!showMessagePanel || !isReadOnlyProject(project?.user_role))
	const collapsed = useSidebarPreferences && layout.isProjectSiderCollapsed
	const projectSiderWidth = collapsed ? 0 : layout.projectSiderWidthPx
	const historyStorageKey = TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.topicPage
	const historyWidth = readOpenFromStorage(historyStorageKey)
		? readTopicHistoryWidth(historyStorageKey)
		: 0

	return (
		<div className="flex h-full w-full min-w-0" data-testid="main-workspace-container">
			<div className="shrink-0 overflow-hidden" style={{ width: projectSiderWidth }}>
				{!collapsed && <TopicSidebarSkeleton compactHeader={useSidebarPreferences} />}
			</div>

			{/* <ResizeHandleSkeleton /> */}

			<div className="flex h-full min-w-0 flex-1 overflow-hidden">
				{/* <div className="h-full min-w-0 flex-1 overflow-hidden">
					<TopicDetailSkeleton />
				</div> */}

				{showMessagePanel && (
					<>
						{/* <ResizeHandleSkeleton /> */}
						<div className="mx-auto h-full w-full min-w-0 shrink-0">
							<TopicConversationSkeleton />
						</div>
					</>
				)}
			</div>
			{useSidebarPreferences && showMessagePanel && historyWidth > 0 && (
				<div
					className="h-full shrink-0 overflow-hidden rounded border border-border bg-background"
					style={{ width: historyWidth }}
				>
					<Skeleton className="mx-auto mt-3 h-4 w-4 rounded-sm" />
				</div>
			)}
		</div>
	)
}

function TopicPageDesktopSkeleton({
	enableSidebarCollapse = true,
}: {
	enableSidebarCollapse?: boolean
}) {
	return <TopicPageDesktopSkeletonBase enableSidebarCollapse={enableSidebarCollapse} />
}

export default TopicPageDesktopSkeleton
