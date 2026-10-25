import type {
	CanvasAssetComplianceState,
	CanvasAssetResourceInfo,
} from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import type {
	CanvasAssetCompliancePollingOptions,
	CanvasAssetCompliancePollingManager,
} from "./CanvasAssetCompliancePollingManager"
import type { CanvasAssetResourceManager } from "./CanvasAssetResourceManager"
import {
	collectAssetBoundComplianceResumeIds,
	collectDocumentComplianceResumeTargets,
} from "./collectDocumentComplianceResumeTargets"
import { applyWorkspaceMediaComplianceState } from "./mediaComplianceContent"
import { assetLibrarySessionStore } from "./AssetLibrarySessionStore"
import { bindMediaContentToAsset } from "./imageContentAssetBinding"

export interface MediaCompliancePersistTarget {
	elementId: string
	contentId: string
	sourcePath: string
}

export interface ComplianceWatchOptions {
	persistTargets?: MediaCompliancePersistTarget[]
	onUpdate?: (state: CanvasAssetComplianceState) => void
	onSettled?: (state: CanvasAssetComplianceState) => void
	onError?: (error: unknown) => void
}

export interface CanvasAssetComplianceTaskHost {
	assetCompliancePollingManager: CanvasAssetCompliancePollingManager
	assetResourceManager: CanvasAssetResourceManager
	elementManager: Canvas["elementManager"]
	permissionManager?: Canvas["permissionManager"]
	isSeedanceComplianceEnabled?: () => boolean
	refreshMediaComplianceFailedTags?: () => void
	refreshNameLabelIcons?: (elementIds?: readonly string[]) => void
}

export interface StartWorkspaceFileComplianceParams {
	path: string
	name: string
	persistTarget: MediaCompliancePersistTarget
	startWorkspaceMediaCompliance: (params: {
		path: string
		name: string
	}) => Promise<CanvasAssetResourceInfo>
}

export interface StartLibraryAssetComplianceParams {
	assetId: string
	fileKey?: string | null
	name?: string
	startExistingAssetCompliance: (params: {
		assetId: string
		fileKey?: string
		name?: string
	}) => Promise<CanvasAssetResourceInfo>
}

/**
 * 统一编排素材合规：发起检查、绑定素材 ID、轮询 compliance、文档刷新后恢复。
 * UI 层只负责触发与 toast，不直接 setInterval 或拼 API 流程。
 */
export class CanvasAssetComplianceTaskManager {
	private readonly activeLibraryWatchIds = new Set<string>()
	/**
	 * Existing-asset compliance is a mutation.  Keep one in-flight mutation per
	 * source asset so automatic video preflight and a manual menu action cannot
	 * create duplicate checks for the same asset.
	 */
	private readonly activeLibraryStartPromises = new Map<string, Promise<string | null>>()

	constructor(private readonly host: CanvasAssetComplianceTaskHost) {}

	private isSeedanceComplianceEnabled(): boolean {
		return this.host.isSeedanceComplianceEnabled?.() ?? false
	}

	public stopAllComplianceWatching(): void {
		this.activeLibraryWatchIds.clear()
		this.host.assetCompliancePollingManager.stopAll()
	}

	public watchCheck(checkId: string, options: ComplianceWatchOptions = {}): () => void {
		if (!this.isSeedanceComplianceEnabled()) return () => undefined
		const normalizedId = checkId.trim()
		if (!normalizedId) return () => undefined

		const persistTargets = options.persistTargets ?? []
		const canPersist = this.canPersistToDocument()
		const pollingOptions: CanvasAssetCompliancePollingOptions = {
			onUpdate: (state) => {
				if (canPersist) {
					this.persistState(persistTargets, state, normalizedId)
				}
				options.onUpdate?.(state)
				this.host.refreshNameLabelIcons?.()
				this.host.refreshMediaComplianceFailedTags?.()
			},
			onSettled: (state) => {
				if (canPersist) {
					this.persistState(persistTargets, state, normalizedId)
				}
				// Compliance can be started from the Canvas menu while the library
				// dialog is already open. Patch the shared snapshot and revalidate only
				// PASS-filtered queries that may need membership changes.
				assetLibrarySessionStore.applyAssetComplianceState(
					normalizedId,
					state.status,
					state.failedReason,
				)
				options.onSettled?.(state)
				this.host.refreshNameLabelIcons?.()
				this.host.refreshMediaComplianceFailedTags?.()
			},
			onError: options.onError,
		}

		return this.host.assetCompliancePollingManager.start(normalizedId, pollingOptions)
	}

	public async startWorkspaceFileCompliance(
		params: StartWorkspaceFileComplianceParams,
		watchOptions: Omit<ComplianceWatchOptions, "persistTargets"> = {},
	): Promise<string | null> {
		if (!this.isSeedanceComplianceEnabled()) return null
		const created = await params.startWorkspaceMediaCompliance({
			path: params.path,
			name: params.name,
		})
		const assetId = created.assetId?.trim()
		if (!assetId) return null

		if (this.canPersistToDocument()) {
			// The project-path compliance endpoint creates the asset as part of the
			// request. Bind that server-owned ID before polling so a reload, menu
			// decision, or concurrent edit can never mistake it for a transient check ID.
			const bindingResult = bindMediaContentToAsset(this.host as Canvas, {
				elementId: params.persistTarget.elementId,
				contentId: params.persistTarget.contentId,
				sourcePath: params.persistTarget.sourcePath,
				assetId,
			})
			// The asset is already created on the server, but it belongs to the
			// original source only when the binding still matches.  Do not start a
			// watcher for a late response that can no longer affect this Content.
			if (bindingResult !== "bound" && bindingResult !== "already-bound") return null
		}

		// Once the Content is bound, compliance status belongs to the asset service;
		// do not persist PROCESSING/PASS/FAILED snapshots back into the workspace DSL.
		this.watchCheck(assetId, watchOptions)
		return assetId
	}

	/** 素材库对已有 asset 发起合规：使用稳定源 ID 轮询，不写 DSL。 */
	public async startLibraryAssetCompliance(
		params: StartLibraryAssetComplianceParams,
		onSettled?: (state: CanvasAssetComplianceState) => void,
	): Promise<string | null> {
		if (!this.isSeedanceComplianceEnabled()) return null
		const sourceAssetId = params.assetId.trim()
		if (!sourceAssetId) return null

		const activeStart = this.activeLibraryStartPromises.get(sourceAssetId)
		if (activeStart) {
			const result = await activeStart
			// The first caller owns the mutation, while later callers may still need
			// their own listener attached to the already shared polling entry.
			if (result && onSettled) this.watchLibraryComplianceChecks([sourceAssetId], onSettled)
			return result
		}

		const startPromise = (async () => {
			await params.startExistingAssetCompliance({
				assetId: sourceAssetId,
				fileKey: params.fileKey?.trim() || undefined,
				name: params.name?.trim() || undefined,
			})
			// Existing-asset compliance must never turn a response ID into a new
			// frontend asset. The source asset remains the authoritative polling key.
			this.watchLibraryComplianceChecks([sourceAssetId], onSettled)
			return sourceAssetId
		})()
		this.activeLibraryStartPromises.set(sourceAssetId, startPromise)
		try {
			return await startPromise
		} finally {
			if (this.activeLibraryStartPromises.get(sourceAssetId) === startPromise) {
				this.activeLibraryStartPromises.delete(sourceAssetId)
			}
		}
	}

	public resumeDocumentCompliancePolling(): void {
		if (!this.isSeedanceComplianceEnabled()) return
		for (const group of collectDocumentComplianceResumeTargets(this.host)) {
			this.watchCheck(group.checkId, {
				persistTargets: group.targets,
			})
		}

		for (const assetId of collectAssetBoundComplianceResumeIds(this.host)) {
			this.watchCheck(assetId, {
				onSettled: () => {
					void this.host.assetResourceManager
						.refreshResources([assetId], { forceRefresh: true })
						.then(() => {
							this.host.refreshMediaComplianceFailedTags?.()
						})
						.catch(() => undefined)
				},
			})
		}
		this.host.refreshNameLabelIcons?.()
		this.host.refreshMediaComplianceFailedTags?.()
	}

	public watchLibraryComplianceChecks(
		assetIds: readonly string[],
		onSettled?: (state: CanvasAssetComplianceState) => void,
	): () => void {
		const normalizedIds = Array.from(
			new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)),
		)
		const unsubscribers = normalizedIds.map((assetId) => {
			this.activeLibraryWatchIds.add(assetId)
			return this.watchCheck(assetId, {
				onSettled: (state) => {
					this.activeLibraryWatchIds.delete(assetId)
					onSettled?.(state)
				},
			})
		})

		return () => {
			for (const unsubscribe of unsubscribers) unsubscribe()
			for (const assetId of normalizedIds) this.activeLibraryWatchIds.delete(assetId)
		}
	}

	public resumeLibraryComplianceChecks(
		assetIds: readonly string[],
		onSettled?: (state: CanvasAssetComplianceState) => void,
	): () => void {
		const pendingIds = assetIds
			.map((assetId) => assetId.trim())
			.filter((assetId) => assetId.length > 0)
			.filter(
				(assetId) =>
					!this.activeLibraryWatchIds.has(assetId) &&
					this.host.assetCompliancePollingManager.getState(assetId)?.status !== "PASS" &&
					this.host.assetCompliancePollingManager.getState(assetId)?.status !== "FAILED",
			)

		if (pendingIds.length === 0) return () => undefined
		return this.watchLibraryComplianceChecks(pendingIds, onSettled)
	}

	private canPersistToDocument(): boolean {
		return this.host.permissionManager?.can("document.write") ?? false
	}

	private persistState(
		targets: MediaCompliancePersistTarget[],
		state: CanvasAssetComplianceState,
		checkId: string,
	): void {
		for (const target of targets) {
			applyWorkspaceMediaComplianceState(this.host as Canvas, {
				elementId: target.elementId,
				contentId: target.contentId,
				sourcePath: target.sourcePath,
				complianceStatus: state.status,
				complianceFailedReason: state.failedReason,
				complianceCheckId: checkId,
			})
		}
	}
}

export function resumeDocumentAssetCompliancePolling(canvas: Canvas): void {
	canvas.assetComplianceTaskManager.resumeDocumentCompliancePolling()
}
