import { useState } from "react"
import { useMemoizedFn } from "ahooks"

import type { MobileSettingsFeedbackPrefill } from "../components/feedbackShared"
import type { MobileFeedbackPrefillBuilder } from "./types"

interface UseMobileFeedbackSheetOptions {
	/** Builds prefill when the sheet opens; omit for empty create form. */
	buildPrefill?: MobileFeedbackPrefillBuilder
	/** Guard before open — return false to no-op (e.g. missing context). */
	canOpen?: () => boolean
}

/**
 * Generic hook: sheet visibility + optional prefill builder for any mobile feedback entry point.
 */
export function useMobileFeedbackSheet(options: UseMobileFeedbackSheetOptions = {}) {
	const { buildPrefill, canOpen } = options
	const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false)
	const [feedbackPrefill, setFeedbackPrefill] = useState<MobileSettingsFeedbackPrefill>()

	const openFeedbackSheet = useMemoizedFn(() => {
		if (canOpen && !canOpen()) return
		setFeedbackPrefill(buildPrefill?.())
		setFeedbackSheetOpen(true)
	})

	const closeFeedbackSheet = useMemoizedFn(() => {
		setFeedbackSheetOpen(false)
	})

	return {
		feedbackSheetOpen,
		feedbackPrefill,
		openFeedbackSheet,
		closeFeedbackSheet,
	}
}
