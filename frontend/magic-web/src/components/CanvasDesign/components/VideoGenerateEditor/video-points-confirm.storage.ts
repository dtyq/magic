const VIDEO_POINTS_CONFIRM_SKIP_STORAGE_KEY = "MAGIC:canvas-design/video-points-confirm-skip"

export function getShouldSkipVideoPointsConfirm(): boolean {
	if (typeof window === "undefined") return false

	try {
		return localStorage.getItem(VIDEO_POINTS_CONFIRM_SKIP_STORAGE_KEY) === "1"
	} catch {
		return false
	}
}

export function setShouldSkipVideoPointsConfirm(shouldSkip: boolean): void {
	if (typeof window === "undefined") return

	try {
		if (!shouldSkip) {
			localStorage.removeItem(VIDEO_POINTS_CONFIRM_SKIP_STORAGE_KEY)
			return
		}
		localStorage.setItem(VIDEO_POINTS_CONFIRM_SKIP_STORAGE_KEY, "1")
	} catch {
		//
	}
}
