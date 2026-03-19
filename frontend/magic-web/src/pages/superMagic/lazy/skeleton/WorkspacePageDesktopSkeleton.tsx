import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { MagicSpin } from "@/components/base"

function WorkspaceHeaderSkeleton() {
	return (
		<div
			className="flex h-11 w-full flex-none items-center justify-between px-3"
			data-testid="workspace-page-desktop-skeleton-header"
		>
			<div className="flex items-center gap-2">
				<Skeleton className="h-7 w-52 rounded-lg" />
				<Skeleton className="size-7 rounded-md" />
				<Skeleton className="size-7 rounded-md" />
			</div>
			<div className="flex items-center gap-2">
				<Skeleton className="h-7 w-20 rounded-md" />
				<Skeleton className="size-7 rounded-full" />
				<Skeleton className="h-7 w-24 rounded-md" />
			</div>
		</div>
	)
}

function WorkspaceBodySkeleton() {
	return (
		<div
			className="flex h-full min-h-0 w-full flex-col overflow-auto px-4"
			data-testid="main-workspace-container"
		>
			<div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 pb-10 pt-24">
				<Skeleton className="h-10 w-80 rounded-full" />

				<div className="flex w-full flex-col items-center gap-3">
					<Skeleton className="h-8 w-64 rounded-md" />
					<Skeleton className="h-12 w-[420px] max-w-full rounded-md" />
				</div>

				<div className="flex w-full items-center gap-2">
					<Skeleton className="h-9 flex-1 rounded-full" />
					<Skeleton className="size-9 rounded-full" />
				</div>

				<div className="w-full space-y-3">
					<div className="rounded-2xl border border-border bg-sidebar p-2">
						<div className="min-h-[150px] space-y-3 rounded-xl border border-border bg-background p-3">
							<Skeleton className="h-5 w-24 rounded-sm" />
							<Skeleton className="h-5 w-full rounded-sm" />
							<Skeleton className="h-5 w-3/4 rounded-sm" />
						</div>
					</div>

					<div
						className="rounded-2xl bg-card px-4 py-8"
						data-testid="workspace-page-desktop-skeleton-loading"
					>
						<MagicSpin spinning size="large" className="min-h-[260px]" />
					</div>
				</div>
			</div>
		</div>
	)
}

function WorkspacePageDesktopSkeleton() {
	return (
		<div
			className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card"
			data-testid="workspace-page-desktop-skeleton"
		>
			<WorkspaceHeaderSkeleton />
			<WorkspaceBodySkeleton />
		</div>
	)
}

export default WorkspacePageDesktopSkeleton
