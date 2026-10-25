import type { AssetItem } from "@/apis"
import type { Canvas } from "../../core/Canvas"
import { getContentById, getDownstreamContent } from "../../document/elementContent"
import {
	ElementTypeEnum,
	type ImageElement,
	type ImageElementContent,
	type LayerElement,
} from "../../document/types"
import { resolveConnectedMediaCandidates } from "../../interaction/connection/connectedMediaInputs"
import type {
	CanvasAssetComplianceStatus,
	CanvasAssetComplianceState,
	CanvasDesignMethods,
	GenerateVideoRequest,
	GenerateVideoInputs,
} from "../../../public/magic-types"
import {
	areCanvasResourceReferencesSame,
	getCanvasResourceFileName,
	isRemoteOrSpecialPath,
	parseAssetResourcePath,
} from "../../shared/path/canvasResourcePath"
import { assetDetailStore } from "./AssetDetailStore"
import {
	normalizeAssetComplianceStatus,
	resolveMediaComplianceFailedReason,
	resolveMediaComplianceStatus,
} from "./assetComplianceState"

/**
 * Network calls made by the preflight must not hold a generation submission
 * forever.  This is only a guard for status/detail/start requests; the user
 * agreement dialog is intentionally not subject to this timeout.
 */
export const DEFAULT_SEEDANCE_COMPLIANCE_PREFLIGHT_TIMEOUT_MS = 5000
export const DEFAULT_SEEDANCE_COMPLIANCE_WAIT_TIMEOUT_MS = 5 * 60 * 1000

export type SeedanceImageComplianceBlockedReason =
	| "agreement-cancelled"
	| "agreement-error"
	| "source-changed"
	| "compliance-failed"
	| "compliance-unavailable"
	| "compliance-timeout"

export type SeedanceImageCompliancePreflightResult =
	| { proceed: true }
	| {
			proceed: false
			reason: SeedanceImageComplianceBlockedReason
			assetId?: string
			failedReason?: string | null
			status?: CanvasAssetComplianceStatus
	  }

export interface SeedanceImageCompliancePreflightOptions {
	canvas: Canvas
	sourceVideoElementId: string
	request: GenerateVideoRequest
	modelName?: string
	timeoutMs?: number
	/** Maximum time spent waiting for already-started compliance tasks. */
	waitTimeoutMs?: number
	/** Optional editor-state check for inputs that live outside the persisted video element. */
	isRequestStillCurrent?: () => boolean
}

interface ImageAssetReference {
	uri: string
	assetId?: string
	complianceStatus?: CanvasAssetComplianceStatus
	/** Connected workspace images need a durable Canvas target before they have an asset ID. */
	elementId?: string
	contentId?: string
	sourcePath?: string
	name?: string
}

type BoundImageAssetReference = ImageAssetReference & { assetId: string }

type WorkspaceImageAssetReference = ImageAssetReference & {
	elementId: string
	contentId: string
	sourcePath: string
}

interface PreparedLibraryAsset {
	assetId: string
	fileKey: string
	name?: string
}

interface PreparedWorkspaceAsset {
	reference: WorkspaceImageAssetReference
	name: string
}

interface ComplianceResolution {
	status: CanvasAssetComplianceStatus
	detail?: AssetItem
}

interface SeedanceSourceSnapshot {
	elementId: string
	fingerprint: string
}

const pendingAgreementByCanvas = new WeakMap<Canvas, Promise<boolean>>()

/** Match the Seedance family while excluding names such as Seedream. */
export function isSeedanceModelName(modelName?: string): boolean {
	if (typeof modelName !== "string") return false
	const normalized = modelName.trim().toLowerCase()
	if (!normalized) return false

	// A version may be attached directly (seedance2.5) or separated by any
	// punctuation/whitespace (seedance-2-5, seedance_v2).  Requiring a token
	// boundary prevents accidental matches such as "notseedance" or "seedream".
	return /(?:^|[^a-z0-9])seedance(?:v?(?=[0-9])|(?=$|[^a-z0-9]))/i.test(normalized)
}

/** Extract only image-bearing request inputs; prompt mentions are not inputs. */
export function collectSeedanceImageUris(
	request: Pick<GenerateVideoRequest, "inputs" | "generation_type" | "composition">,
): string[] {
	if (
		request.generation_type?.trim().toLowerCase() === "canvas_composition" ||
		request.composition
	) {
		return []
	}

	const inputs = request.inputs as GenerateVideoInputs | undefined
	if (!inputs) return []

	const uris: string[] = []
	const appendUri = (value: unknown) => {
		const uri =
			typeof value === "string"
				? value
				: value && typeof value === "object" && "uri" in value
					? (value as { uri?: unknown }).uri
					: undefined
		if (typeof uri !== "string" || !uri.trim()) return
		uris.push(uri.trim())
	}

	if (Array.isArray(inputs.frames)) inputs.frames.forEach(appendUri)
	if (Array.isArray(inputs.reference_images)) inputs.reference_images.forEach(appendUri)
	return uris
}

export function shouldRunSeedanceImageCompliancePreflight(options: {
	canvas: Canvas
	request: GenerateVideoRequest
	modelName?: string
}): boolean {
	return (
		options.canvas.isSeedanceComplianceEnabled() &&
		isSeedanceModelName(options.modelName) &&
		collectSeedanceImageUris(options.request).length > 0
	)
}

function addImageAssetReference(
	byAssetId: Map<string, ImageAssetReference>,
	uri: string,
	assetId: string,
	complianceStatus?: CanvasAssetComplianceStatus,
	metadata?: Pick<ImageAssetReference, "elementId" | "contentId" | "sourcePath" | "name">,
): void {
	const normalizedAssetId = assetId.trim()
	if (!normalizedAssetId) return

	const existing = byAssetId.get(normalizedAssetId)
	if (existing) {
		if (
			complianceStatus &&
			(!existing.complianceStatus ||
				(existing.complianceStatus === "UNVERIFIED" && complianceStatus !== "UNVERIFIED"))
		) {
			existing.complianceStatus = complianceStatus
		}
		if (metadata && !existing.elementId && !existing.contentId) {
			Object.assign(existing, metadata)
		}
		return
	}

	byAssetId.set(normalizedAssetId, {
		uri,
		assetId: normalizedAssetId,
		...(complianceStatus ? { complianceStatus } : {}),
		...(metadata ?? {}),
	})
}

function addUnboundImageReference(
	byTarget: Map<string, WorkspaceImageAssetReference>,
	reference: WorkspaceImageAssetReference,
): void {
	const targetKey = `${reference.elementId}\u0000${reference.contentId}`
	const existing = byTarget.get(targetKey)
	if (existing) {
		if (
			reference.complianceStatus &&
			(!existing.complianceStatus ||
				(existing.complianceStatus === "UNVERIFIED" &&
					reference.complianceStatus !== "UNVERIFIED"))
		) {
			existing.complianceStatus = reference.complianceStatus
		}
		return
	}

	byTarget.set(targetKey, reference)
}

function getImageContent(
	element: LayerElement,
	contentId?: string,
): ImageElementContent | undefined {
	if (element.type !== ElementTypeEnum.Image) return undefined
	const imageElement = element as ImageElement
	return contentId
		? getContentById<ImageElementContent>(imageElement, contentId)
		: getDownstreamContent<ImageElementContent>(imageElement)
}

function getImageReferenceName(element: LayerElement, sourcePath: string): string {
	const fileName = getCanvasResourceFileName(sourcePath)
	const baseName = fileName.replace(/\.[^.]+$/, "")
	return element.name?.trim() || baseName || fileName || "image"
}

/**
 * Resolve IDs from the actual request URI and from connected source images.
 * Unbound connected workspace images retain their Canvas target so the caller
 * can create and bind an asset before submitting the video request. File names,
 * URLs and workspace paths are deliberately never treated as IDs.
 */
export function resolveSeedanceImageAssetReferences(
	canvas: Canvas,
	sourceVideoElementId: string,
	uris: readonly string[],
): ImageAssetReference[] {
	const byAssetId = new Map<string, ImageAssetReference>()
	const unboundByTarget = new Map<string, WorkspaceImageAssetReference>()
	const unresolvedUris = new Set<string>()

	for (const uri of uris) {
		const directAssetId = parseAssetResourcePath(uri)
		if (directAssetId) {
			addImageAssetReference(byAssetId, uri, directAssetId)
			continue
		}
		unresolvedUris.add(uri)
	}

	if (unresolvedUris.size === 0) return Array.from(byAssetId.values())

	let connectedCandidates: ReturnType<typeof resolveConnectedMediaCandidates> = []
	try {
		connectedCandidates = resolveConnectedMediaCandidates(canvas, sourceVideoElementId)
	} catch {
		// A stale/partially loaded connection graph must not block video submit.
		return Array.from(byAssetId.values())
	}

	const resolveResourceReference =
		canvas.magicConfigManager.config?.methods?.resolveResourceReference
	for (const uri of unresolvedUris) {
		for (const candidate of connectedCandidates) {
			if (candidate.kind !== "image" || !candidate.path) continue
			if (!areCanvasResourceReferencesSame(uri, candidate.path, resolveResourceReference)) {
				continue
			}

			const sourceElement =
				canvas.elementManager.getElementData(candidate.sourceElementId) ?? candidate.element
			if (!sourceElement) continue
			const content = getImageContent(sourceElement, candidate.sourceContentId)
			const assetId =
				typeof content?.assetId === "string" ? content.assetId.trim() : undefined
			const sourcePath = content?.src?.trim() || candidate.path.trim()
			const targetMetadata =
				content?.contentId && sourcePath
					? {
							elementId: candidate.sourceElementId,
							contentId: content.contentId,
							sourcePath,
							name: getImageReferenceName(sourceElement, sourcePath),
						}
					: undefined
			if (assetId) {
				addImageAssetReference(
					byAssetId,
					uri,
					assetId,
					content?.complianceStatus,
					targetMetadata,
				)
				continue
			}

			if (!targetMetadata) continue
			addUnboundImageReference(unboundByTarget, {
				uri,
				...targetMetadata,
				complianceStatus: content?.complianceStatus,
			})
		}
	}

	return [...byAssetId.values(), ...unboundByTarget.values()]
}

/**
 * Capture the source video's durable identity before any agreement/network
 * wait.  The fingerprint intentionally includes content IDs and media
 * resource identities, but not transient generation status fields.
 */
function captureSeedanceSourceSnapshot(
	canvas: Canvas,
	sourceVideoElementId: string,
): SeedanceSourceSnapshot | undefined {
	const element = canvas.elementManager.getElementData(sourceVideoElementId)
	if (!element || element.type !== ElementTypeEnum.Video) return undefined

	const fingerprint = JSON.stringify({
		type: element.type,
		activeContentId: element.activeContentId,
		mainContentId: element.mainContentId,
		contents: (Array.isArray(element.contents) ? element.contents : []).map((content) => ({
			contentId: content.contentId,
			src: content.src ?? null,
			assetId: content.assetId ?? null,
		})),
	})
	return { elementId: sourceVideoElementId, fingerprint }
}

function isSeedanceSourceSnapshotCurrent(
	canvas: Canvas,
	snapshot: SeedanceSourceSnapshot | undefined,
): boolean {
	if (!snapshot) return true
	try {
		const current = captureSeedanceSourceSnapshot(canvas, snapshot.elementId)
		return current?.fingerprint === snapshot.fingerprint
	} catch {
		// A source snapshot that cannot be re-read is not enough evidence to
		// release a strict compliance gate after an asynchronous wait.
		return false
	}
}

/**
 * Compare the request URI-to-asset mapping after an asynchronous wait. A set
 * comparison alone is insufficient when two connected images are swapped, so
 * each URI is matched using the same namespace-aware identity resolver used by
 * the initial lookup.
 */
function haveSameSeedanceImageReferences(
	canvas: Canvas,
	requestUris: readonly string[],
	initial: readonly ImageAssetReference[],
	current: readonly ImageAssetReference[],
	expectedWorkspaceBindings: ReadonlyMap<string, string> = new Map(),
): boolean {
	const resolveResourceReference =
		canvas.magicConfigManager.config?.methods?.resolveResourceReference

	for (const [targetKey, expectedAssetId] of expectedWorkspaceBindings) {
		const currentReference = current.find(
			(reference) =>
				getImageReferenceTargetKey(reference) === targetKey &&
				reference.assetId === expectedAssetId,
		)
		if (!currentReference) return false
	}

	return requestUris.every((uri) => {
		const initialReference = initial.find((reference) =>
			areCanvasResourceReferencesSame(uri, reference.uri, resolveResourceReference),
		)
		const currentReference = current.find((reference) =>
			areCanvasResourceReferencesSame(uri, reference.uri, resolveResourceReference),
		)
		if (!initialReference || !currentReference) {
			return !initialReference && !currentReference
		}

		const expectedAssetId = expectedWorkspaceBindings.get(
			getImageReferenceTargetKey(initialReference) ?? "",
		)
		if (expectedAssetId) return currentReference.assetId === expectedAssetId

		// An unbound connected image must remain the same target while an async
		// compliance request is in flight. A late response must not be accepted
		// after the connection was replaced with another image.
		if (!initialReference.assetId) {
			if (currentReference.assetId) return false
			const initialTargetKey = getImageReferenceTargetKey(initialReference)
			const currentTargetKey = getImageReferenceTargetKey(currentReference)
			if (initialTargetKey && currentTargetKey && initialTargetKey !== currentTargetKey) {
				return false
			}
		}

		return currentReference.assetId === initialReference.assetId
	})
}

function getImageReferenceTargetKey(reference: ImageAssetReference): string | undefined {
	if (!reference.elementId || !reference.contentId) return undefined
	return `${reference.elementId}\u0000${reference.contentId}`
}

function getPreflightTimeout(timeoutMs?: number): number {
	return Number.isFinite(timeoutMs) && (timeoutMs as number) > 0
		? (timeoutMs as number)
		: DEFAULT_SEEDANCE_COMPLIANCE_PREFLIGHT_TIMEOUT_MS
}

function getComplianceWaitTimeout(waitTimeoutMs?: number): number {
	return Number.isFinite(waitTimeoutMs) && (waitTimeoutMs as number) > 0
		? (waitTimeoutMs as number)
		: DEFAULT_SEEDANCE_COMPLIANCE_WAIT_TIMEOUT_MS
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false
		const timer = setTimeout(() => {
			if (settled) return
			settled = true
			reject(new Error("Seedance compliance preflight timed out"))
		}, timeoutMs)

		Promise.resolve(promise).then(
			(value) => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				resolve(value)
			},
			(error) => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}

function getComplianceFailureReason(value: unknown): string | null {
	if (typeof value !== "string") return null
	const reason = value.trim()
	return reason || null
}

function getComplianceBlockedResult(
	reason: SeedanceImageComplianceBlockedReason,
	options?: {
		assetId?: string
		status?: CanvasAssetComplianceStatus
		failedReason?: string | null
	},
): SeedanceImageCompliancePreflightResult {
	return {
		proceed: false,
		reason,
		...(options?.assetId ? { assetId: options.assetId } : {}),
		...(options?.status ? { status: options.status } : {}),
		...(options?.failedReason !== undefined ? { failedReason: options.failedReason } : {}),
	}
}

function areAllSeedanceImageReferencesResolved(
	canvas: Canvas,
	uris: readonly string[],
	assets: readonly ImageAssetReference[],
): boolean {
	const resolveResourceReference =
		canvas.magicConfigManager.config?.methods?.resolveResourceReference
	return uris.every((uri) =>
		assets.some((asset) =>
			areCanvasResourceReferencesSame(uri, asset.uri, resolveResourceReference),
		),
	)
}

async function waitForSeedanceAssetPass(
	canvas: Canvas,
	assetId: string,
	statusTimeoutMs: number,
	waitTimeoutMs: number,
): Promise<CanvasAssetComplianceState> {
	const getAssetComplianceStatus =
		canvas.magicConfigManager.config?.methods?.getAssetComplianceStatus
	if (!getAssetComplianceStatus) {
		throw new Error("Asset compliance resolver is not configured")
	}

	const initialState = await withTimeout(getAssetComplianceStatus(assetId), statusTimeoutMs)
	if (initialState.assetId !== assetId) {
		throw new Error("Asset compliance response does not match the requested asset")
	}
	if (initialState.status === "PASS" || initialState.status === "FAILED") {
		return initialState
	}
	if (initialState.status !== "PROCESSING") {
		throw new Error("Asset compliance state is unavailable")
	}

	return await new Promise<CanvasAssetComplianceState>((resolve, reject) => {
		let settled = false
		let unsubscribe: () => void = () => undefined
		const finish = (callback: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			unsubscribe()
			callback()
		}
		const timer = setTimeout(() => {
			finish(() => reject(new Error("Asset compliance wait timed out")))
		}, waitTimeoutMs)

		unsubscribe = canvas.assetComplianceTaskManager.watchCheck(assetId, {
			onUpdate: (state) => {
				if (state.assetId !== assetId) {
					finish(() =>
						reject(
							new Error(
								"Asset compliance response does not match the requested asset",
							),
						),
					)
					return
				}
				if (state.status === "PASS" || state.status === "FAILED") {
					finish(() => resolve(state))
				}
			},
			onSettled: (state) => {
				if (state.assetId !== assetId) {
					finish(() =>
						reject(
							new Error(
								"Asset compliance response does not match the requested asset",
							),
						),
					)
					return
				}
				if (state.status === "PASS" || state.status === "FAILED") {
					finish(() => resolve(state))
				} else {
					finish(() => reject(new Error("Asset compliance state is unavailable")))
				}
			},
			// Strict preflight treats a status lookup error as a failed gate. Removing
			// this listener stops this request from silently retrying the same check.
			onError: (error) => finish(() => reject(error)),
		})
	})
}

async function ensureAssetAgreementOnce(
	canvas: Canvas,
	ensureAssetAgreementSigned: NonNullable<CanvasDesignMethods["ensureAssetAgreementSigned"]>,
): Promise<boolean> {
	const pending = pendingAgreementByCanvas.get(canvas)
	if (pending) return pending

	const next = Promise.resolve().then(() => ensureAssetAgreementSigned())
	pendingAgreementByCanvas.set(canvas, next)
	try {
		return await next
	} finally {
		if (pendingAgreementByCanvas.get(canvas) === next) {
			pendingAgreementByCanvas.delete(canvas)
		}
	}
}

function ensureProcessingWatcher(canvas: Canvas, assetId: string): void {
	try {
		canvas.assetComplianceTaskManager.watchLibraryComplianceChecks([assetId])
	} catch {
		// Watcher recovery is best effort; the existing status remains authoritative.
	}
}

async function resolveAssetCompliance(
	canvas: Canvas,
	asset: BoundImageAssetReference,
	timeoutMs: number,
): Promise<ComplianceResolution | null> {
	const methods = canvas.magicConfigManager.config?.methods
	const localStatus = resolveMediaComplianceStatus(canvas, {
		assetId: asset.assetId,
		complianceStatus: asset.complianceStatus,
	})

	if (localStatus && localStatus !== "UNVERIFIED") {
		if (localStatus === "PROCESSING") ensureProcessingWatcher(canvas, asset.assetId)
		return { status: localStatus }
	}

	let status: CanvasAssetComplianceStatus | undefined = localStatus
	if (methods?.getAssetComplianceStatus) {
		try {
			const remoteState = await withTimeout(
				methods.getAssetComplianceStatus(asset.assetId),
				timeoutMs,
			)
			if (!remoteState || remoteState.assetId !== asset.assetId) return null
			status = normalizeAssetComplianceStatus(remoteState?.status)
		} catch {
			// An unknown remote state must not cause a duplicate compliance POST.
			return null
		}
	}

	if (status && status !== "UNVERIFIED") {
		if (status === "PROCESSING") ensureProcessingWatcher(canvas, asset.assetId)
		return { status }
	}

	try {
		const cachedDetail = assetDetailStore.getCached(asset.assetId)
		const detail = cachedDetail?.file_key?.trim()
			? cachedDetail
			: await withTimeout(assetDetailStore.getWithFileKey(asset.assetId), timeoutMs)
		if (detail.asset_id?.trim() !== asset.assetId) return null
		const detailStatus = normalizeAssetComplianceStatus(detail.compliance_status)
		if (detailStatus !== "UNVERIFIED") {
			if (detailStatus === "PROCESSING") ensureProcessingWatcher(canvas, asset.assetId)
			return { status: detailStatus, detail }
		}
		return { status: "UNVERIFIED", detail }
	} catch {
		// Without a reliable file_key/detail, do not guess a source path.
		return null
	}
}

function prepareUnboundWorkspaceAsset(
	canvas: Canvas,
	asset: WorkspaceImageAssetReference,
): PreparedWorkspaceAsset | null {
	if (parseAssetResourcePath(asset.sourcePath) || isRemoteOrSpecialPath(asset.sourcePath)) {
		return null
	}

	const status = resolveMediaComplianceStatus(canvas, {
		complianceStatus: asset.complianceStatus,
	})
	if (status === "PASS" || status === "PROCESSING") return null

	return {
		reference: asset,
		name: asset.name || getCanvasResourceFileName(asset.sourcePath) || "image",
	}
}

function canBindWorkspaceAsset(canvas: Canvas): boolean {
	try {
		return canvas.permissionManager?.can("document.write") ?? false
	} catch {
		return false
	}
}

/**
 * Run the Seedance-only image compliance preflight immediately before submit.
 * The generation request is released only after every resolved image asset is
 * confirmed PASS. A lookup, start, or wait failure blocks this submission;
 * callers may let the user explicitly try again later.
 */
export async function runSeedanceImageCompliancePreflight(
	options: SeedanceImageCompliancePreflightOptions,
): Promise<SeedanceImageCompliancePreflightResult> {
	const { canvas, request, sourceVideoElementId, modelName } = options
	if (!shouldRunSeedanceImageCompliancePreflight({ canvas, request, modelName })) {
		return { proceed: true }
	}

	const uris = collectSeedanceImageUris(request)
	if (uris.length === 0) return { proceed: true }

	let sourceSnapshot: SeedanceSourceSnapshot | undefined
	try {
		sourceSnapshot = captureSeedanceSourceSnapshot(canvas, sourceVideoElementId)
	} catch {
		return getComplianceBlockedResult("compliance-unavailable")
	}
	if (!sourceSnapshot) return getComplianceBlockedResult("compliance-unavailable")
	let assets: ImageAssetReference[]
	try {
		assets = resolveSeedanceImageAssetReferences(canvas, sourceVideoElementId, uris)
	} catch {
		return getComplianceBlockedResult("compliance-unavailable")
	}
	if (assets.length === 0) {
		return getComplianceBlockedResult("compliance-unavailable")
	}
	if (!areAllSeedanceImageReferencesResolved(canvas, uris, assets)) {
		return getComplianceBlockedResult("compliance-unavailable")
	}

	const sourceIsStillCurrent = (
		expectedWorkspaceBindings: ReadonlyMap<string, string> = new Map(),
	) => {
		if (options.isRequestStillCurrent) {
			try {
				if (!options.isRequestStillCurrent()) return false
			} catch {
				return false
			}
		}
		if (!isSeedanceSourceSnapshotCurrent(canvas, sourceSnapshot)) return false
		try {
			const currentAssets = resolveSeedanceImageAssetReferences(
				canvas,
				sourceVideoElementId,
				uris,
			)
			return haveSameSeedanceImageReferences(
				canvas,
				uris,
				assets,
				currentAssets,
				expectedWorkspaceBindings,
			)
		} catch {
			return false
		}
	}

	const methods = canvas.magicConfigManager.config?.methods
	const startExistingAssetCompliance = methods?.startExistingAssetCompliance
	const startWorkspaceMediaCompliance = methods?.startWorkspaceMediaCompliance

	const timeoutMs = getPreflightTimeout(options.timeoutMs)
	const waitTimeoutMs = getComplianceWaitTimeout(options.waitTimeoutMs)
	const workspaceReferences = assets.filter(
		(asset): asset is WorkspaceImageAssetReference => !asset.assetId,
	)
	if (workspaceReferences.length > 0) {
		if (!startWorkspaceMediaCompliance || !canBindWorkspaceAsset(canvas)) {
			return getComplianceBlockedResult("compliance-unavailable")
		}
		const failedWorkspaceAsset = workspaceReferences.find(
			(asset) =>
				resolveMediaComplianceStatus(canvas, {
					complianceStatus: asset.complianceStatus,
				}) === "FAILED",
		)
		if (failedWorkspaceAsset) {
			return getComplianceBlockedResult("compliance-failed", {
				failedReason:
					resolveMediaComplianceFailedReason(canvas, failedWorkspaceAsset) ?? null,
				status: "FAILED",
			})
		}
	}
	const preparedWorkspaceAssets = workspaceReferences
		.map((asset) => prepareUnboundWorkspaceAsset(canvas, asset))
		.filter((asset): asset is PreparedWorkspaceAsset => Boolean(asset))
	if (preparedWorkspaceAssets.length !== workspaceReferences.length) {
		return getComplianceBlockedResult("compliance-unavailable")
	}

	const boundAssets = assets.filter((asset): asset is BoundImageAssetReference =>
		Boolean(asset.assetId),
	)
	const boundResolutions = await Promise.all(
		boundAssets.map(async (asset) => {
			try {
				return {
					asset,
					resolution: await resolveAssetCompliance(canvas, asset, timeoutMs),
				}
			} catch {
				return { asset, resolution: null }
			}
		}),
	)
	if (boundResolutions.some(({ resolution }) => !resolution)) {
		return getComplianceBlockedResult("compliance-unavailable")
	}
	const failedResolution = boundResolutions.find(
		({ resolution }) => resolution?.status === "FAILED",
	)
	if (failedResolution?.resolution) {
		return getComplianceBlockedResult("compliance-failed", {
			assetId: failedResolution.asset.assetId,
			status: failedResolution.resolution.status,
			failedReason:
				resolveMediaComplianceFailedReason(canvas, failedResolution.asset) ??
				getComplianceFailureReason(
					failedResolution.resolution.detail?.compliance_failed_reason,
				),
		})
	}
	const processingAssetIds = boundResolutions
		.filter(({ resolution }) => resolution?.status === "PROCESSING")
		.map(({ asset }) => asset.assetId)
	const preparedAssets: PreparedLibraryAsset[] = []
	for (const { asset, resolution } of boundResolutions) {
		if (resolution?.status !== "UNVERIFIED") continue
		const fileKey = resolution.detail?.file_key?.trim()
		if (!fileKey || !startExistingAssetCompliance) {
			return getComplianceBlockedResult("compliance-unavailable", {
				assetId: asset.assetId,
				status: resolution.status,
			})
		}
		preparedAssets.push({
			assetId: asset.assetId,
			fileKey,
			name: resolution.detail?.name?.trim() || undefined,
		})
	}
	if (!sourceIsStillCurrent()) return getComplianceBlockedResult("source-changed")
	if (
		preparedWorkspaceAssets.length === 0 &&
		preparedAssets.length === 0 &&
		processingAssetIds.length === 0
	) {
		// A fresh status read is required even when a local cache says PASS. This
		// keeps the final gate from relying on a stale list or Canvas snapshot.
		try {
			const states = await Promise.all(
				boundAssets.map((asset) =>
					withTimeout(
						Promise.resolve().then(() =>
							methods?.getAssetComplianceStatus?.(asset.assetId),
						),
						timeoutMs,
					),
				),
			)
			if (
				states.some(
					(state, index) => !state || state.assetId !== boundAssets[index]?.assetId,
				)
			) {
				return getComplianceBlockedResult("compliance-unavailable")
			}
			const failedState = states.find((state) => state?.status === "FAILED")
			if (failedState) {
				return getComplianceBlockedResult("compliance-failed", {
					assetId: failedState.assetId,
					status: failedState.status,
					failedReason: getComplianceFailureReason(failedState.failedReason),
				})
			}
			if (states.some((state) => state?.status !== "PASS")) {
				return getComplianceBlockedResult("compliance-unavailable")
			}
		} catch {
			return getComplianceBlockedResult("compliance-unavailable")
		}
		return { proceed: true }
	}

	const ensureAssetAgreementSigned = methods?.ensureAssetAgreementSigned
	if (!ensureAssetAgreementSigned) {
		// Starting an unverified asset without the agreement gate would treat an
		// unavailable protocol as implicit consent, so this is the one capability
		// failure that must cancel the current video submission.
		return { proceed: false, reason: "agreement-error" }
	}

	let agreementSigned: boolean
	try {
		agreementSigned = await ensureAssetAgreementOnce(canvas, ensureAssetAgreementSigned)
	} catch {
		return { proceed: false, reason: "agreement-error" }
	}
	if (!agreementSigned) return { proceed: false, reason: "agreement-cancelled" }
	if (!sourceIsStillCurrent()) return { proceed: false, reason: "source-changed" }

	const expectedWorkspaceBindings = new Map<string, string>()
	const startedWorkspaceAssetIds: string[] = []
	const workspaceStartResults = await Promise.all(
		preparedWorkspaceAssets.map(async ({ reference, name }) => {
			try {
				if (!startWorkspaceMediaCompliance) return null
				const assetId = await withTimeout(
					Promise.resolve().then(() =>
						canvas.assetComplianceTaskManager.startWorkspaceFileCompliance({
							path: reference.sourcePath,
							name,
							persistTarget: {
								elementId: reference.elementId,
								contentId: reference.contentId,
								sourcePath: reference.sourcePath,
							},
							startWorkspaceMediaCompliance,
						}),
					),
					timeoutMs,
				)
				if (!assetId) return null
				const targetKey = getImageReferenceTargetKey(reference)
				if (targetKey) expectedWorkspaceBindings.set(targetKey, assetId)
				startedWorkspaceAssetIds.push(assetId)
				return assetId
			} catch {
				return null
			}
		}),
	)
	if (workspaceStartResults.some((assetId) => !assetId)) {
		return getComplianceBlockedResult("compliance-unavailable")
	}
	if (!sourceIsStillCurrent(expectedWorkspaceBindings)) {
		return getComplianceBlockedResult("source-changed")
	}

	// Workspace compliance creates and binds the asset first. Rebuild the
	// reference snapshot so the later existing-asset start does not treat this
	// expected assetId transition as a source replacement.
	if (preparedWorkspaceAssets.length > 0) {
		try {
			assets = resolveSeedanceImageAssetReferences(canvas, sourceVideoElementId, uris)
		} catch {
			return getComplianceBlockedResult("compliance-unavailable")
		}
	}

	const startedLibraryAssetIds: string[] = []
	if (startExistingAssetCompliance) {
		const startResults = await Promise.all(
			preparedAssets.map(async (asset) => {
				try {
					const startedAssetId = await withTimeout(
						Promise.resolve().then(() =>
							canvas.assetComplianceTaskManager.startLibraryAssetCompliance({
								assetId: asset.assetId,
								fileKey: asset.fileKey,
								name: asset.name,
								startExistingAssetCompliance,
							}),
						),
						timeoutMs,
					)
					if (startedAssetId) startedLibraryAssetIds.push(asset.assetId)
					return startedAssetId
				} catch {
					return null
				}
			}),
		)
		if (startResults.some((assetId) => !assetId)) {
			return getComplianceBlockedResult("compliance-unavailable")
		}
	}
	if (!sourceIsStillCurrent(expectedWorkspaceBindings)) {
		return getComplianceBlockedResult("source-changed")
	}

	const assetsToWaitFor = Array.from(
		new Set([...processingAssetIds, ...startedWorkspaceAssetIds, ...startedLibraryAssetIds]),
	)
	try {
		const states = await Promise.all(
			assetsToWaitFor.map((assetId) =>
				waitForSeedanceAssetPass(canvas, assetId, timeoutMs, waitTimeoutMs),
			),
		)
		const failedState = states.find((state) => state.status === "FAILED")
		if (failedState) {
			return getComplianceBlockedResult("compliance-failed", {
				assetId: failedState.assetId,
				status: failedState.status,
				failedReason: getComplianceFailureReason(failedState.failedReason),
			})
		}
		if (states.some((state) => state.status !== "PASS")) {
			return getComplianceBlockedResult("compliance-unavailable")
		}
	} catch (error) {
		return getComplianceBlockedResult(
			error instanceof Error && error.message.includes("timed out")
				? "compliance-timeout"
				: "compliance-unavailable",
		)
	}
	if (!sourceIsStillCurrent(expectedWorkspaceBindings)) {
		return getComplianceBlockedResult("source-changed")
	}
	return { proceed: true }
}
