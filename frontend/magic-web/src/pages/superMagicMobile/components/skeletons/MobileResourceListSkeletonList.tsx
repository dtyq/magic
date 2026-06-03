import MobileResourceListRowSkeleton from "./MobileResourceListRowSkeleton"

interface MobileResourceListSkeletonListProps {
	/** Number of placeholder rows to render for the initial loading state. */
	count?: number
	testId?: string
}

const DEFAULT_ROW_COUNT = 5

/**
 * Renders a vertical stack of list row skeletons for first-screen loading on mobile shell pages.
 */
function MobileResourceListSkeletonList({
	count = DEFAULT_ROW_COUNT,
	testId = "mobile-resource-list-skeleton-list",
}: MobileResourceListSkeletonListProps) {
	return (
		<div className="flex flex-col gap-1" data-testid={testId}>
			{Array.from({ length: count }).map((_, index) => (
				<MobileResourceListRowSkeleton key={index} />
			))}
		</div>
	)
}

export default MobileResourceListSkeletonList
