import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"

const sidebarSections = [3, 4, 3, 2] as const

export function DashboardLayoutSkeleton() {
	return (
		<div
			aria-busy="true"
			aria-label="Loading"
			data-testid="dashboard-layout-loading"
			className="flex h-svh min-h-0 w-full overflow-hidden bg-background text-foreground"
		>
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
				<div className="flex min-h-0 w-full flex-col overflow-hidden">
					<div className="flex flex-col gap-2 p-2">
						<div className="flex items-center gap-2">
							<Skeleton className="size-10 rounded-lg" />
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-3 w-14" />
							</div>
						</div>
					</div>

					<nav className="dashboard-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
						{sidebarSections.map((itemCount, sectionIndex) => (
							<div className="flex w-full min-w-0 flex-col p-2" key={sectionIndex}>
								<div className="flex h-8 shrink-0 items-center rounded-md px-2">
									<Skeleton className="h-3 w-16" />
								</div>
								<div className="flex w-full min-w-0 flex-col gap-2">
									{Array.from({ length: itemCount }).map((_, itemIndex) => (
										<div
											className="flex h-8 items-center gap-2 rounded-md px-2"
											key={itemIndex}
										>
											<Skeleton className="size-4 rounded" />
											<Skeleton className="h-4 w-24" />
										</div>
									))}
								</div>
							</div>
						))}
					</nav>

					<div className="border-t border-sidebar-border p-2">
						<div className="flex h-8 items-center gap-2 rounded-md px-2">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-4 w-20" />
						</div>
					</div>
				</div>
			</aside>

			<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col lg:pl-64">
				<header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
					<Skeleton className="size-8 rounded-md" />
					<div className="mx-2 h-6 w-px bg-border/50" aria-hidden="true" />
					<Skeleton className="h-8 w-36 rounded-md lg:w-56" />
					<div className="ml-auto flex items-center gap-2">
						<Skeleton className="h-9 w-28 rounded-md" />
						<Skeleton className="h-9 w-32 rounded-md" />
						<Skeleton className="size-9 rounded-full" />
					</div>
				</header>

				<main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
					<div className="@container/main min-w-0 px-4 py-4 lg:px-6">
						<DashboardPageContentSkeleton />
					</div>
				</main>
			</div>
		</div>
	)
}

function DashboardPageContentSkeleton() {
	return (
		<div className="space-y-6 py-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-3">
					<Skeleton className="h-7 w-32" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-9 w-20 rounded-md" />
					<Skeleton className="h-9 w-28 rounded-md" />
				</div>
			</div>

			<div className="h-px bg-border" />

			<div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_repeat(3,120px)]">
				<div className="space-y-2">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-9 w-full rounded-md" />
				</div>
				{Array.from({ length: 3 }).map((_, index) => (
					<div className="space-y-2" key={index}>
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-9 w-full rounded-md" />
					</div>
				))}
			</div>

			<div className="overflow-hidden rounded-lg border border-border/50 bg-card">
				<div className="min-w-[980px]">
					<div className="grid grid-cols-[220px_1.3fr_repeat(4,1fr)] border-b">
						{Array.from({ length: 6 }).map((_, index) => (
							<div className="px-4 py-3" key={index}>
								<Skeleton className="h-4 w-20" />
							</div>
						))}
					</div>
					{Array.from({ length: 7 }).map((_, rowIndex) => (
						<div
							className="grid grid-cols-[220px_1.3fr_repeat(4,1fr)] border-b last:border-b-0"
							key={rowIndex}
						>
							{Array.from({ length: 6 }).map((_, columnIndex) => (
								<div className="px-4 py-3" key={columnIndex}>
									<Skeleton
										className={columnIndex === 0 ? "h-5 w-36" : "h-5 w-20"}
									/>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
