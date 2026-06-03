import MobileCrewCardSkeleton from "./MobileCrewCardSkeleton"

interface MobileCrewCardSkeletonGridProps {
	/** Number of card placeholders in the 2-column grid. */
	count?: number
	testId?: string
}

const DEFAULT_CARD_COUNT = 6

/**
 * Renders a 2-column grid of crew card skeletons for My Crew first-screen loading.
 */
function MobileCrewCardSkeletonGrid({
	count = DEFAULT_CARD_COUNT,
	testId = "mobile-crew-card-skeleton-grid",
}: MobileCrewCardSkeletonGridProps) {
	return (
		<div className="grid grid-cols-2 items-stretch gap-3" data-testid={testId}>
			{Array.from({ length: count }).map((_, index) => (
				<MobileCrewCardSkeleton key={index} />
			))}
		</div>
	)
}

export default MobileCrewCardSkeletonGrid
