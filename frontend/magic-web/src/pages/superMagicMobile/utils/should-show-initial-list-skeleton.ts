/**
 * Returns true when a list should show full-screen initial skeleton (first load with no cached rows).
 */
export function shouldShowInitialListSkeleton(isLoading: boolean, itemCount: number) {
	return isLoading && itemCount === 0
}
