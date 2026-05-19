import { useEffect, useState } from "react"
import type { SelfMediaView } from "../types"

/**
 * Tracks which views have been mounted at least once.
 * Prevents unmounting already-mounted views to preserve their state.
 */
export function useShellMountedViews(view: SelfMediaView) {
	const [mountedViews, setMountedViews] = useState(() => ({
		feed: view === "feed",
		detail: view === "detail",
		scroll: view === "scroll",
		edit: view === "edit",
	}))

	useEffect(() => {
		setMountedViews((prev) => (prev[view] ? prev : { ...prev, [view]: true }))
	}, [view])

	return {
		shouldRenderFeed: mountedViews.feed || view === "feed",
		shouldRenderDetail: mountedViews.detail || view === "detail",
		shouldRenderScroll: mountedViews.scroll || view === "scroll",
		shouldRenderEdit: mountedViews.edit || view === "edit",
	}
}
