import type { AssetItem, AssetMediaType } from "@/apis"
import { useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import { useOptionalCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import { useSeedanceComplianceAvailable } from "../../seedanceComplianceAvailability"
import type { CanvasAssetComplianceState } from "../../../public/magic-types"
import { assetDetailStore } from "../../../runtime/resources/asset/AssetDetailStore"
import { resolveAssetComplianceTaskManager } from "../../../runtime/resources/asset/assetCompliancePollingHost"
import {
	toastAssetComplianceFailureState,
	toastAssetComplianceStarted,
	toastAssetComplianceUnavailable,
} from "./assetComplianceToasts"

const COMPLIANCE_MEDIA_TYPES = new Set<AssetMediaType>(["IMAGE", "VIDEO", "AUDIO"])

export function canStartAssetLibraryCompliance(asset: AssetItem): boolean {
	if (asset.compliance_status === "PASS") return false
	if (!asset.asset_media_type || !COMPLIANCE_MEDIA_TYPES.has(asset.asset_media_type)) {
		return false
	}
	// The list endpoint may omit file_key.  Keep the action visible and hydrate
	// the full source only after the user explicitly requests verification.
	return true
}

export function useAssetLibraryComplianceAction(options: {
	onComplianceStarted?: (assetId: string) => void
	onComplianceSettled?: (assetId: string, state: CanvasAssetComplianceState) => void
}) {
	const canvas = useOptionalCanvas()
	const { methods } = useMagic()
	const seedanceComplianceAvailable = useSeedanceComplianceAvailable()
	const { t } = useCanvasDesignI18n()
	const startingAssetIdsRef = useRef(new Set<string>())
	const complianceTaskManager = useMemo(() => resolveAssetComplianceTaskManager(canvas), [canvas])

	const syncCanvasAfterCompliance = useCallback(
		(assetId: string) => {
			if (!canvas || canvas.isDestroyed) return
			void canvas.assetResourceManager
				.refreshResources([assetId], { forceRefresh: true })
				.then(() => {
					canvas.refreshMediaComplianceFailedTags()
				})
				.catch(() => undefined)
		},
		[canvas],
	)

	const handleComplianceSettled = useCallback(
		(listAssetId: string, state: CanvasAssetComplianceState) => {
			// Existing-asset compliance is keyed by the original asset ID.  The
			// response must not create or refresh a second frontend asset entry.
			syncCanvasAfterCompliance(listAssetId)
			options.onComplianceSettled?.(listAssetId, state)
			toastAssetComplianceFailureState(t, state)
		},
		[options, syncCanvasAfterCompliance, t],
	)

	const startCompliance = useCallback(
		async (asset: AssetItem) => {
			if (!seedanceComplianceAvailable || !canStartAssetLibraryCompliance(asset)) return

			const listAssetId = asset.asset_id.trim()
			if (!listAssetId) {
				toastAssetComplianceUnavailable(t)
				return
			}

			if (asset.compliance_status === "PROCESSING") {
				// The watcher performs the first status read immediately. Avoid a
				// duplicate single-item request before registering that watcher.
				complianceTaskManager.watchLibraryComplianceChecks([listAssetId], (settled) =>
					handleComplianceSettled(listAssetId, settled),
				)
				return
			}

			if (!methods?.startExistingAssetCompliance || !methods.ensureAssetAgreementSigned) {
				toastAssetComplianceUnavailable(t)
				return
			}
			if (startingAssetIdsRef.current.has(listAssetId)) return

			startingAssetIdsRef.current.add(listAssetId)
			try {
				const signed = await methods.ensureAssetAgreementSigned()
				if (!signed) return
				const sourceAsset = asset.file_key?.trim()
					? asset
					: await assetDetailStore.getWithFileKey(listAssetId)

				const pollAssetId = await complianceTaskManager.startLibraryAssetCompliance(
					{
						assetId: listAssetId,
						fileKey: sourceAsset.file_key,
						name: sourceAsset.name,
						startExistingAssetCompliance: methods.startExistingAssetCompliance,
					},
					(settled) => handleComplianceSettled(listAssetId, settled),
				)
				if (!pollAssetId) {
					toastAssetComplianceUnavailable(t)
					return
				}

				options.onComplianceStarted?.(listAssetId)
				toastAssetComplianceStarted(t)
			} catch (error) {
				toast.error(
					error instanceof Error && error.message
						? error.message
						: t("seedanceCompliance.unavailable", {
								defaultValue: "当前媒体无法发起合规校验",
							}),
				)
			} finally {
				startingAssetIdsRef.current.delete(listAssetId)
			}
		},
		[
			complianceTaskManager,
			handleComplianceSettled,
			methods,
			options,
			seedanceComplianceAvailable,
			t,
		],
	)

	return {
		startCompliance,
		canStartAssetLibraryCompliance,
		seedanceComplianceAvailable,
	}
}
