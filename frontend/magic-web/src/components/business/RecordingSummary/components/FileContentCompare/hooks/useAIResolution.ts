import { useState, useCallback } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import type { ConflictInfo, ChangeInfo, ChangeRecommendation } from "../utils/diff"
import type { ConflictResolution, ConflictResolutionWithoutCustom } from "../types"

interface UseAIResolutionParams {
	/** List of conflicts to resolve */
	conflicts: ConflictInfo[]
	/** List of changes to resolve */
	changes: ChangeInfo[]
	/** Callback to select a conflict resolution */
	onConflictSelect: (conflictId: string, selection: ConflictResolutionWithoutCustom) => void
	/** Callback to set custom conflict content */
	onConflictCustom: (conflictId: string, customContent: string) => void
	/** Callback to select a change resolution */
	onChangeSelect: (changeId: string, selection: ChangeRecommendation) => void
}

/** AI recommendations for conflicts and changes */
interface AIRecommendations {
	/** Map of conflict ID to AI resolution info */
	conflicts: Map<
		string,
		{ resolution: ConflictResolution; reason: string; customContent?: string }
	>
	/** Map of change ID to AI resolution info */
	changes: Map<string, { resolution: ChangeRecommendation; reason: string }>
}

/**
 * AI Resolution Hook
 * Handles calling AI to automatically resolve conflicts and changes
 */
export function useAIResolution(params: UseAIResolutionParams) {
	const { conflicts, changes } = params
	const { t } = useTranslation("super")
	const [loading, setLoading] = useState(false)
	const [aiRecommendations, setAIRecommendations] = useState<AIRecommendations>({
		conflicts: new Map(),
		changes: new Map(),
	})

	/**
	 * Call AI to resolve all conflicts and changes
	 */
	const handleAIResolve = useCallback(async () => {
		if (conflicts.length === 0 && changes.length === 0) {
			return
		}

		setLoading(true)

		try {
			setAIRecommendations({
				conflicts: new Map(),
				changes: new Map(),
			})
			magicToast.error(t("recordingSummary.fileChangeModal.aiResolveError"))
		} catch (error) {
			console.error("AI resolution failed:", error)
			magicToast.error(t("recordingSummary.fileChangeModal.aiResolveError"))
		} finally {
			setLoading(false)
		}
	}, [conflicts.length, changes.length, t])

	return {
		/** Whether AI resolution is in progress */
		aiLoading: loading,
		/** Trigger AI resolution */
		handleAIResolve,
		/** AI recommendations for conflicts and changes */
		aiRecommendations,
	}
}
