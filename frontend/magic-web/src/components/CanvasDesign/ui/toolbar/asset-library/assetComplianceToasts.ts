import { toast } from "sonner"
import type { CanvasAssetComplianceState } from "../../../public/magic-types"
import type { TFunction } from "../../../public/i18n-types"

export type SeedanceCompliancePreflightBlockReason =
	| "agreement-cancelled"
	| "agreement-error"
	| "source-changed"
	| "compliance-failed"
	| "compliance-unavailable"
	| "compliance-timeout"

export function toastAssetComplianceFailureState(
	t: TFunction,
	state: Pick<CanvasAssetComplianceState, "status" | "failedReason">,
): void {
	if (state.status !== "FAILED") return
	const reason = state.failedReason?.trim()
	toast.error(
		reason
			? t("seedanceCompliance.failedWithReason", {
					defaultValue: "合规校验未通过：{{reason}}",
					reason,
				})
			: t("seedanceCompliance.failed", {
					defaultValue: "合规校验未通过",
				}),
	)
}

export function toastAssetComplianceState(
	t: TFunction,
	state: Pick<CanvasAssetComplianceState, "status" | "failedReason">,
): void {
	if (state.status === "PASS") return
	if (state.status === "FAILED") {
		toastAssetComplianceFailureState(t, state)
		return
	}
	if (state.status === "UNVERIFIED") {
		toast.info(
			t("seedanceCompliance.unverified", {
				defaultValue: "该素材尚未开始合规校验",
			}),
		)
		return
	}
	toast.info(
		t("seedanceCompliance.processing", {
			defaultValue: "合规校验进行中",
		}),
	)
}

export function toastAssetComplianceStarted(t: TFunction): void {
	toast.success(
		t("seedanceCompliance.started", {
			defaultValue: "Seedance 2.0 合规校验已开始",
		}),
	)
}

export function toastAssetComplianceUnavailable(t: TFunction): void {
	toast.error(
		t("seedanceCompliance.unavailable", {
			defaultValue: "当前媒体无法发起合规校验",
		}),
	)
}

/** Show the same failure language for the submit-time strict compliance gate. */
export function toastSeedanceCompliancePreflightBlocked(
	t: TFunction,
	result: {
		reason: SeedanceCompliancePreflightBlockReason
		failedReason?: string | null
	},
): void {
	if (result.reason === "agreement-cancelled") return
	if (result.reason === "compliance-failed") {
		toastAssetComplianceFailureState(t, {
			status: "FAILED",
			failedReason: result.failedReason ?? null,
		})
		return
	}
	toastAssetComplianceUnavailable(t)
}
