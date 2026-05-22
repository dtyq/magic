import { useCallback } from "react"

import type { MagicClawItem } from "@/apis"
import {
	buildMobileFeedbackPrefill,
	useMobileFeedbackSheet,
} from "@/layouts/BaseLayoutMobile/components/MobileSettings/feedback-prefill"
import { getMagiClawRowId } from "@/pages/superMagic/pages/MagiClawPage/useMagiClawMobilePage"

interface UseClawFeedbackSheetParams {
	magicClaw: MagicClawItem | null | undefined
	clawDisplayName: string
}

/**
 * Claw playground entry: open feedback sheet with claw ID prefill (龙虾ID).
 */
export function useClawFeedbackSheet(params: UseClawFeedbackSheetParams) {
	const { magicClaw, clawDisplayName } = params

	const buildPrefill = useCallback(() => {
		if (!magicClaw) return undefined

		const clawId = getMagiClawRowId(magicClaw)
		const clawName = clawDisplayName.trim() || magicClaw.name.trim() || clawId

		return buildMobileFeedbackPrefill({
			scenario: "claw",
			context: { clawId, clawName },
		})
	}, [clawDisplayName, magicClaw])

	const canOpen = useCallback(() => Boolean(magicClaw), [magicClaw])

	const { feedbackSheetOpen, feedbackPrefill, openFeedbackSheet, closeFeedbackSheet } =
		useMobileFeedbackSheet({ buildPrefill, canOpen })

	return {
		feedbackSheetOpen,
		feedbackPrefill,
		openClawFeedback: openFeedbackSheet,
		closeClawFeedback: closeFeedbackSheet,
	}
}
