import { Skeleton } from "@/components/shadcn-ui/skeleton"

/**
 * Default skill panel body: control bars + template grid + list row skeletons
 */
function SkillPanelDefaultLayoutSkeleton() {
	return (
		<div className="flex w-full flex-col gap-3 overflow-clip rounded-lg p-2">
			{/* Top control bar */}
			<div className="flex w-full items-center justify-between">
				{/* Left section: Style + Badge */}
				<div className="flex shrink-0 items-center gap-1.5">
					<Skeleton className="h-6 w-20" />
				</div>

				{/* Right section: Pages, Size, Language selectors */}
				<div className="flex shrink-0 items-center gap-5">
					{/* Pages selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>

					{/* Size selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>
				</div>
			</div>

			{/* Template cards grid */}
			<div className="flex w-full flex-wrap items-start gap-2">
				{Array.from({ length: 4 }).map((_, index) => (
					<div
						key={index}
						className="flex w-[210px] shrink-0 flex-col gap-1.5 overflow-clip rounded-md p-1"
					>
						{/* Card image area */}
						<div className="flex h-28 w-full flex-col items-center justify-center gap-1 overflow-clip rounded-md border border-border bg-background">
							<Skeleton className="size-12 rounded-lg" />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
				))}
			</div>

			{/* Top control bar */}
			<div className="flex w-full items-center justify-between">
				{/* Left section: Style + Badge */}
				<div className="flex shrink-0 items-center gap-1.5">
					<Skeleton className="h-6 w-20" />
				</div>
			</div>

			{/* Template cards grid */}
			<div className="flex w-full flex-wrap items-start">
				{Array.from({ length: 3 }).map((_, index) => (
					<div
						key={index}
						className="flex w-[33.3%] shrink-0 flex-col gap-1.5 overflow-clip rounded-md p-1"
					>
						{/* Card image area */}
						<div className="flex h-20 w-full items-center justify-between gap-3 overflow-clip rounded-md border border-border bg-background p-4">
							<Skeleton className="size-12 flex-shrink-0 rounded-lg" />
							<div className="flex w-full flex-col gap-2">
								<Skeleton className="h-4 w-[90%]" />
								<Skeleton className="h-4 w-[30%]" />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export { SkillPanelDefaultLayoutSkeleton }
