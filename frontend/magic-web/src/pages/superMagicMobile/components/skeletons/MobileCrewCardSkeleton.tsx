import { Skeleton } from "@/components/shadcn-ui/skeleton"

/**
 * 2-column grid crew card skeleton aligned with MyCrewCardMobile layout (avatar breakout + card body).
 * Matches outer h-full + inner flex-1 and fixed role/description slot heights.
 */
function MobileCrewCardSkeleton() {
	return (
		<div
			className="relative flex h-full w-full min-w-0 flex-col pt-8"
			data-testid="mobile-crew-card-skeleton"
		>
			<div className="relative flex flex-1 flex-col rounded-2xl bg-card px-3 pb-3 pt-10 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.08)]">
				<Skeleton className="absolute left-1/2 top-0 z-10 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full" />
				<div className="mb-2 flex w-full flex-col items-center gap-1.5">
					<Skeleton className="h-4 w-[70%] rounded-md" />
					<div className="flex h-5 w-full items-center justify-center">
						<Skeleton className="h-5 w-[45%] rounded-full" />
					</div>
				</div>
				<div className="mb-3 flex min-h-[2.25rem] flex-col items-center justify-center gap-1 px-1">
					<Skeleton className="h-3 w-full rounded-md" />
					<Skeleton className="h-3 w-[85%] rounded-md" />
				</div>
				<Skeleton className="mt-auto h-9 w-full rounded-xl" />
			</div>
		</div>
	)
}

export default MobileCrewCardSkeleton
