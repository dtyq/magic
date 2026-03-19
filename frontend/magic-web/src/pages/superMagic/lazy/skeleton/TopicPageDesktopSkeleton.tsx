import {
	DEFAULT_MAX_WIDTH,
	DEFAULT_MIN_WIDTH,
	DEFAULT_WIDTH,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
} from "../../constants/resizablePanel"
import useResizablePanel from "../../hooks/useResizablePanel"
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

function TopicSidebarSkeleton() {
	return (
		<div className="flex h-full flex-col gap-2" data-testid="workspace-sidebar-wrapper">
			<div className="rounded-lg border border-border bg-background p-2">
				<div className="flex items-center gap-2">
					<Skeleton className="size-8 rounded-lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<Skeleton className="h-4 w-4/5 rounded-sm" />
						<Skeleton className="h-3 w-3/5 rounded-sm" />
					</div>
					<Skeleton className="size-5 rounded-sm" />
					<Skeleton className="size-5 rounded-sm" />
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

function TopicConversationSkeleton() {
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
}: {
	showMessagePanel?: boolean
}) {
	const { width: projectSiderWidth } = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
		maxWidth: DEFAULT_MAX_WIDTH.PROJECT_SIDER,
		defaultWidth: DEFAULT_WIDTH.PROJECT_SIDER,
		storageKey: PROJECT_SIDER_WIDTH_STORAGE_KEY,
		direction: "left",
	})

	const { width: messagePanelWidth } = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
		maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
		storageKey: MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	})

	return (
		<div className="flex h-full w-full min-w-0" data-testid="main-workspace-container">
			<div className="shrink-0" style={{ width: projectSiderWidth }}>
				<TopicSidebarSkeleton />
			</div>

			{/* <ResizeHandleSkeleton /> */}

			<div className="flex h-full min-w-0 flex-1 overflow-hidden">
				{/* <div className="h-full min-w-0 flex-1 overflow-hidden">
					<TopicDetailSkeleton />
				</div> */}

				{showMessagePanel && (
					<>
						{/* <ResizeHandleSkeleton /> */}
						<div
							className="mx-auto h-full w-full min-w-0 shrink-0"
						// style={{ width: messagePanelWidth }}
						>
							<TopicConversationSkeleton />
						</div>
					</>
				)}
			</div>
		</div>
	)
}

function TopicPageDesktopSkeleton() {
	return <TopicPageDesktopSkeletonBase />
}

export default TopicPageDesktopSkeleton
