import { Skeleton } from "@/components/shadcn-ui/skeleton"

const SKELETON_CARD_COUNT = 6

/** Card-list skeleton for the CrewMarket mobile page (loading state). */
function CrewMarketMobileSkeleton() {
	return (
		<div className="flex flex-col gap-3" data-testid="crew-market-mobile-skeleton">
			{Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
				<div
					key={i}
					className="flex flex-col gap-3 rounded-2xl bg-card p-4"
					style={{ boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.07)" }}
				>
					<div className="flex items-start gap-3">
						<Skeleton className="size-12 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<div className="flex items-center gap-2">
								<Skeleton className="h-5 w-1/3" />
								<Skeleton className="ml-auto h-[18px] w-1/5 rounded-full" />
							</div>
							<Skeleton className="h-3 w-2/5" />
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-5/6" />
					</div>
					<Skeleton className="h-10 w-full rounded-xl" />
				</div>
			))}
		</div>
	)
}

export default CrewMarketMobileSkeleton
