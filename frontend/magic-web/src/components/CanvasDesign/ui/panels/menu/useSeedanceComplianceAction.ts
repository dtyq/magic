import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import {
	toastAssetComplianceFailureState,
	toastAssetComplianceState,
} from "../../toolbar/asset-library/assetComplianceToasts"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import { useSeedanceComplianceAvailable } from "../../seedanceComplianceAvailability"
import type {
	CanvasAssetComplianceState,
	CanvasAssetComplianceStatus,
} from "../../../public/magic-types"
import type { Canvas } from "../../../runtime/core/Canvas"
import { getActiveContent } from "../../../runtime/document/elementContent"
import { ElementTypeEnum, type LayerElement } from "../../../runtime/document/types"
import {
	getCanvasResourceFileName,
	parseAssetResourcePath,
	resolveCanvasStorageResourceReference,
} from "../../../runtime/shared/path/canvasResourcePath"

interface ComplianceContent {
	contentId: string
	src?: string
	assetId?: string
	complianceStatus?: CanvasAssetComplianceStatus
	complianceFailedReason?: string | null
	complianceCheckId?: string
}

export interface SeedanceComplianceTarget {
	elementId: string
	contentId: string
	path: string
	name: string
	assetId?: string
	complianceStatus?: CanvasAssetComplianceStatus
	complianceFailedReason?: string | null
	complianceCheckId?: string
}

function readComplianceContent(
	canvas: {
		getEffectiveContent?: <T extends { contentId: string }>(elementId: string) => T | undefined
	},
	element: LayerElement,
): ComplianceContent | undefined {
	const effectiveContent =
		typeof canvas.getEffectiveContent === "function"
			? canvas.getEffectiveContent<ComplianceContent>(element.id)
			: undefined
	return effectiveContent ?? (getActiveContent(element) as ComplianceContent | undefined)
}

export function resolveSeedanceComplianceTarget(
	canvas: {
		elementManager: { getElementData: (elementId: string) => LayerElement | undefined }
		getEffectiveContent?: <T extends { contentId: string }>(elementId: string) => T | undefined
	},
	resolveResourceReference: Parameters<typeof resolveCanvasStorageResourceReference>[1],
	elementId: string,
): SeedanceComplianceTarget | undefined {
	const element = canvas.elementManager.getElementData(elementId)
	if (
		!element ||
		(element.type !== ElementTypeEnum.Image && element.type !== ElementTypeEnum.Video)
	) {
		return undefined
	}

	const content = readComplianceContent(canvas, element)
	if (!content) return undefined

	const assetId = content.assetId?.trim() || undefined
	if (assetId) {
		// An asset-backed element may retain an asset:// source or a legacy
		// workspace source. Its assetId is authoritative for compliance routing.
		const path = content.src?.trim() || `asset://${assetId}`
		return {
			elementId: element.id,
			contentId: content.contentId,
			path,
			name: element.name || getCanvasResourceFileName(path) || assetId,
			assetId,
			complianceStatus: content.complianceStatus,
			complianceFailedReason: content.complianceFailedReason,
			complianceCheckId: content.complianceCheckId?.trim() || undefined,
		}
	}

	const path = content.src
	if (!path) return undefined

	if (parseAssetResourcePath(path)) return undefined

	const resolution = resolveCanvasStorageResourceReference(path, resolveResourceReference)
	if (
		resolution.status !== "resolved" ||
		resolution.resourceKind !== "workspace-file" ||
		!resolution.workspacePath
	) {
		return undefined
	}

	const fileName = getCanvasResourceFileName(resolution.workspacePath)
	return {
		elementId: element.id,
		contentId: content.contentId,
		path,
		name: element.name || fileName.replace(/\.[^.]+$/, "") || fileName,
		assetId: undefined,
		complianceStatus: content.complianceStatus,
		complianceFailedReason: content.complianceFailedReason,
		complianceCheckId: content.complianceCheckId?.trim() || undefined,
	}
}

function needsNewComplianceCheck(target: SeedanceComplianceTarget): boolean {
	if (target.complianceStatus === "PASS") return false
	if (target.complianceStatus === "PROCESSING") return false
	return true
}

function getKnownComplianceStatus(
	canvas: Pick<Canvas, "assetCompliancePollingManager" | "assetResourceManager">,
	target: SeedanceComplianceTarget,
): CanvasAssetComplianceStatus | undefined {
	if (target.assetId) {
		return (
			canvas.assetCompliancePollingManager.getState(target.assetId)?.status ??
			canvas.assetResourceManager.getCachedResource(target.assetId)?.complianceStatus ??
			undefined
		)
	}
	return target.complianceStatus
}

function hidesComplianceMenu(status: CanvasAssetComplianceStatus | undefined): boolean {
	return status === "PASS" || status === "PROCESSING"
}

function toPersistTarget(target: SeedanceComplianceTarget) {
	return {
		elementId: target.elementId,
		contentId: target.contentId,
		sourcePath: target.path,
	}
}

export function useSeedanceComplianceAction() {
	const { canvas } = useCanvas()
	const { methods } = useMagic()
	const seedanceComplianceAvailable = useSeedanceComplianceAvailable()
	const { t } = useCanvasDesignI18n()
	const startingRef = useRef(false)
	const pendingAssetDetailsRef = useRef(new Set<string>())
	const unresolvedAssetDetailsRef = useRef(new Set<string>())
	const [assetDetailEpoch, setAssetDetailEpoch] = useState(0)

	const resolveTarget = useCallback(
		(elementId: string) => {
			if (!canvas || !methods?.resolveResourceReference) return undefined
			return resolveSeedanceComplianceTarget(
				canvas,
				methods.resolveResourceReference,
				elementId,
			)
		},
		[canvas, methods],
	)

	const toastFailureState = useCallback(
		(state: Pick<CanvasAssetComplianceState, "status" | "failedReason">) => {
			toastAssetComplianceFailureState(t, state)
		},
		[t],
	)

	const toastState = useCallback(
		(state: Pick<CanvasAssetComplianceState, "status" | "failedReason">) => {
			toastAssetComplianceState(t, state)
		},
		[t],
	)

	const ensureAssetDetail = useCallback(
		(assetId: string) => {
			if (!canvas) return
			if (
				pendingAssetDetailsRef.current.has(assetId) ||
				unresolvedAssetDetailsRef.current.has(assetId) ||
				canvas.assetResourceManager.getCachedResource(assetId) ||
				canvas.assetCompliancePollingManager.getState(assetId)
			) {
				return
			}
			pendingAssetDetailsRef.current.add(assetId)
			void canvas.assetResourceManager.getResource(assetId).then(
				() => {
					pendingAssetDetailsRef.current.delete(assetId)
					setAssetDetailEpoch((epoch) => epoch + 1)
				},
				() => {
					pendingAssetDetailsRef.current.delete(assetId)
					unresolvedAssetDetailsRef.current.add(assetId)
					setAssetDetailEpoch((epoch) => epoch + 1)
				},
			)
		},
		[canvas],
	)

	const canCheckCompliance = useCallback(
		(elementId: string) => {
			void assetDetailEpoch
			if (!seedanceComplianceAvailable) return false
			const target = resolveTarget(elementId)
			if (!target || !canvas) return false
			if (target.assetId) {
				const hasKnownDetail = Boolean(
					canvas.assetResourceManager.getCachedResource(target.assetId) ||
					canvas.assetCompliancePollingManager.getState(target.assetId) ||
					unresolvedAssetDetailsRef.current.has(target.assetId),
				)
				if (!hasKnownDetail) {
					ensureAssetDetail(target.assetId)
					return false
				}
			}
			if (hidesComplianceMenu(getKnownComplianceStatus(canvas, target))) return false
			if (target.assetId) {
				return Boolean(
					methods?.getAssetComplianceStatus &&
					methods?.startExistingAssetCompliance &&
					methods.ensureAssetAgreementSigned,
				)
			}
			if (!needsNewComplianceCheck(target)) {
				return Boolean(methods?.getAssetComplianceStatus)
			}
			return Boolean(
				canvas.permissionManager.can("document.write") &&
				methods?.startWorkspaceMediaCompliance &&
				methods.ensureAssetAgreementSigned &&
				methods.getAssetComplianceStatus,
			)
		},
		[
			assetDetailEpoch,
			canvas,
			ensureAssetDetail,
			methods,
			resolveTarget,
			seedanceComplianceAvailable,
		],
	)

	const checkCompliance = useCallback(
		async (elementId: string) => {
			const unavailable = () => {
				toast.error(
					t("seedanceCompliance.unavailable", {
						defaultValue: "当前媒体无法发起合规校验",
					}),
				)
			}

			try {
				if (!seedanceComplianceAvailable) {
					unavailable()
					return
				}
				const target = resolveTarget(elementId)
				if (!target || !canvas) {
					unavailable()
					return
				}

				const taskManager = canvas.assetComplianceTaskManager
				const persistTarget = toPersistTarget(target)

				if (target.assetId) {
					const state = await methods?.getAssetComplianceStatus?.(target.assetId)
					if (!state) {
						unavailable()
						return
					}
					if (state.status === "PROCESSING") {
						toastState(state)
						taskManager.watchCheck(target.assetId, { onSettled: toastFailureState })
						return
					}
					if (state.status === "PASS") {
						toastState(state)
						return
					}
					const startExistingAssetCompliance = methods?.startExistingAssetCompliance
					const ensureAssetAgreementSigned = methods?.ensureAssetAgreementSigned
					if (!startExistingAssetCompliance || !ensureAssetAgreementSigned) {
						unavailable()
						return
					}
					if (startingRef.current) return

					startingRef.current = true
					try {
						const signed = await ensureAssetAgreementSigned()
						if (!signed) return

						const latest = resolveTarget(elementId)
						if (
							!latest ||
							latest.contentId !== target.contentId ||
							latest.path !== target.path ||
							latest.assetId !== target.assetId
						) {
							unavailable()
							return
						}

						const pollAssetId = await taskManager.startLibraryAssetCompliance(
							{
								assetId: target.assetId,
								name: latest.name,
								startExistingAssetCompliance,
							},
							toastFailureState,
						)
						if (!pollAssetId) {
							unavailable()
							return
						}
						toastState({ status: "PROCESSING", failedReason: null })
					} finally {
						startingRef.current = false
					}
					return
				}

				if (target.complianceStatus === "PASS") {
					return
				}

				if (target.complianceStatus === "PROCESSING" && target.complianceCheckId) {
					toastState({ status: "PROCESSING", failedReason: null })
					taskManager.watchCheck(target.complianceCheckId, {
						persistTargets: [persistTarget],
						onSettled: toastFailureState,
					})
					return
				}

				if (
					!canvas.permissionManager.can("document.write") ||
					!methods?.startWorkspaceMediaCompliance ||
					!methods.ensureAssetAgreementSigned
				) {
					unavailable()
					return
				}
				if (startingRef.current) return

				startingRef.current = true
				try {
					const signed = await methods.ensureAssetAgreementSigned()
					if (!signed) return

					const latest = resolveTarget(elementId)
					if (
						!latest ||
						latest.contentId !== target.contentId ||
						latest.path !== target.path ||
						latest.assetId
					) {
						unavailable()
						return
					}

					const assetId = await taskManager.startWorkspaceFileCompliance(
						{
							path: latest.path,
							name: latest.name,
							persistTarget: toPersistTarget(latest),
							startWorkspaceMediaCompliance: methods.startWorkspaceMediaCompliance,
						},
						{ onSettled: toastFailureState },
					)
					if (!assetId) {
						unavailable()
						return
					}
				} finally {
					startingRef.current = false
				}
			} catch (error) {
				toast.error(
					error instanceof Error && error.message
						? error.message
						: t("seedanceCompliance.unavailable", {
								defaultValue: "当前媒体无法发起合规校验",
							}),
				)
			}
		},
		[
			canvas,
			methods,
			resolveTarget,
			seedanceComplianceAvailable,
			t,
			toastFailureState,
			toastState,
		],
	)

	return { canCheckCompliance, checkCompliance }
}
