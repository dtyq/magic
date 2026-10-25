import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	commitCanvasProjectPathRepair,
	planCanvasProjectsBeforeFileOperation,
	type CanvasProjectPathRepairOptions,
	type CanvasProjectPathRepairResult,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair"

export type CanvasFileOperationGuardResult =
	| {
			ok: true
			repairPlan: CanvasProjectPathRepairResult | null
	  }
	| {
			ok: false
			reason: "cancelled"
			repairResult?: CanvasProjectPathRepairResult
	  }

export interface CanvasFileOperationGuardOptions {
	repairOptions?: CanvasProjectPathRepairOptions
	requiresConfirmation?: boolean
	confirm?: (repairPlan: CanvasProjectPathRepairResult | null) => Promise<boolean>
	/** Runs after risk confirmation and before path repair persistence. */
	beforeCommit?: () => Promise<boolean>
}

/**
 * Coordinates canvas-specific preflight work without making file-operation hooks
 * depend on the path-repair transaction details.
 */
export function useCanvasFileOperationGuard() {
	const { t } = useTranslation("super")

	const runPreflight = useCallback(
		async ({
			repairOptions,
			requiresConfirmation = false,
			confirm,
			beforeCommit,
		}: CanvasFileOperationGuardOptions): Promise<CanvasFileOperationGuardResult> => {
			const repairPlan = repairOptions
				? await planCanvasProjectsBeforeFileOperation(repairOptions)
				: null

			if (requiresConfirmation || repairPlan?.hasFailures) {
				const shouldContinue = confirm ? await confirm(repairPlan) : false
				if (!shouldContinue) return { ok: false, reason: "cancelled" }
			}

			if (beforeCommit && !(await beforeCommit())) {
				return { ok: false, reason: "cancelled" }
			}

			return { ok: true, repairPlan }
		},
		[],
	)

	const commitRepair = useCallback(
		async (repairPlan: CanvasProjectPathRepairResult | null) => {
			if (!repairPlan) return null
			try {
				const repairResult = await commitCanvasProjectPathRepair(repairPlan)
				if (repairResult.hasSaveFailures) {
					console.error("画布路径修复保存失败:", repairResult.saveFailures)
					magicToast.error(t("topicFiles.canvasOperationRisk.pathRepairSaveFailed"))
				}
				return repairResult
			} catch (error) {
				console.error("画布路径修复提交失败:", error)
				magicToast.error(t("topicFiles.canvasOperationRisk.pathRepairSaveFailed"))
				return null
			}
		},
		[t],
	)

	return {
		runCanvasFileOperationPreflight: runPreflight,
		commitCanvasFileOperationRepair: commitRepair,
	}
}
