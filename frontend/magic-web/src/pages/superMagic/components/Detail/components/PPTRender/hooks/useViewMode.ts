import { useState } from "react"

export const enum ViewMode {
	Outline = "outline",
	PPT = "ppt",
}

function useViewMode() {
	const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PPT)
	return {
		viewMode,
		setViewMode,
	}
}

export default useViewMode
