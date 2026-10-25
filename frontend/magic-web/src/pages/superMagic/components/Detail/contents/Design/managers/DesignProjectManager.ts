import { cloneDeep } from "lodash-es"
import type { DesignData } from "../types"
import { MAGIC_PROJECT_VERSION_V3 } from "../utils/magicProjectCompression"
import type {
	DesignCurrentFileLoadResult,
	DesignConflict,
	DesignConnectionConflict,
	DesignElementConflict,
	DesignProjectStateBag,
	DesignProjectManagerOptions,
	PendingDesignUpgrade,
} from "./types"
import { DesignRemoteListener } from "./DesignRemoteListener"
import type {
	ApplyRemoteDesignDataFn,
	DesignRemoteListenerOptions,
	FetchRemoteDesignDataFn,
	LoadAndApplyRemoteFn,
} from "./DesignRemoteListener"
import { DesignLoadManager, type DesignLoadResult } from "./DesignLoadManager"
import {
	DesignSaveManager,
	type DesignSaveContext,
	type DesignSaveLifecycleHandlers,
	type DesignSaveMetadata,
	type DesignSaveResult,
} from "./DesignSaveManager"
import { DesignVersionManager } from "./DesignVersionManager"
import { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import { hashDesignDataComparable } from "../utils/designContentHash"
import { resolveDesignProjectBasePathFromAttachments } from "../utils/utils"
import { DesignLoadError, loadDesignDataToRuntime } from "../utils/designDataLoader"
import type { LoadDesignDataToRuntimeResult } from "../utils/designDataLoader"
import {
	clearPendingDesignUpgrade,
	readPendingDesignUpgrade,
	writePendingDesignUpgrade,
} from "../utils/designUpgradeStorage"
import {
	deleteDesignDraft,
	getDesignDraftWriteDebounceMs,
	readDesignDraft,
	writeDesignDraft,
	type DesignDraftEntry,
	type DesignDraftIdentity,
	type DesignDraftReason,
	type DesignDraftWriteResult,
} from "../utils/designDraftStorage"
import {
	mergeDesignDataByElement,
	refreshDesignElementConflictsFromRemoteData,
	type DesignDataElementMergeResult,
} from "../utils/designDataElementMerge"
import {
	reconcileElementDetailsProvenance,
	tryApplyCanvasDocumentPatch,
	tryMergeCanvasElementsByField,
} from "@/components/CanvasDesign/runtime/document"
import {
	getHydratedElementDetailsProvenance,
	setHydratedElementDetailsProvenance,
	transferHydratedElementDetailsProvenance,
} from "../utils/elementDetailsIo"
import { getDesignBaseAccessMode, getDesignRequestIdentity } from "./types"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"

type ElementLevelMergeConflictResult = Extract<
	DesignDataElementMergeResult,
	{ ok: false; isElementLevelConflict: true }
>

type ConnectionLevelMergeConflictResult = Extract<
	DesignDataElementMergeResult,
	{ ok: false; isConnectionLevelConflict: true }
>

interface LocalDraftBaseSnapshot {
	baseRemoteFingerprint: string
	baseRemoteData?: DesignData
}

const DESIGN_SAVE_GUARD_LOG_PREFIX = "[DesignSaveGuard]"

function getTopLevelElementCount(data: DesignData | null | undefined): number {
	return data?.canvas?.elements?.length ?? 0
}

export interface DesignProjectManagerFactoryParams {
	stateBag: DesignProjectStateBag
	options: DesignProjectManagerOptions
	getFileVersionsList: () => FileHistoryVersion[]
	getFileVersion: () => number | undefined
}

export interface DesignProjectManagerAPI {
	magicProjectJsFileId: string | null
	designData: DesignData
	updateDesignData: (updater: (draft: DesignData) => void) => void
	updateDesignDataAndScheduleSave: (
		updater: (draft: DesignData) => void,
		metadata?: DesignSaveMetadata,
	) => void

	isInitialLoading: boolean
	isSaving: boolean

	scheduleAutoSave: (metadata?: DesignSaveMetadata) => void
	cancelAutoSave: () => void
	canUpdateCurrentDesignData: () => boolean
	persistLocalDraft: (
		designData: DesignData,
		options?: { immediate?: boolean; reason?: DesignDraftReason },
	) => void
	persistLocalDraftAndWait: (
		designData: DesignData,
		options?: { immediate?: boolean; reason?: DesignDraftReason },
	) => Promise<DesignDraftWriteResult | null>
	hasUnsavedChanges: (designData?: DesignData) => boolean
	manualSave: (designData?: DesignData) => Promise<boolean>
	syncDesignData: (newDesignData: DesignData) => void
	persistPendingDesignUpgrade: () => Promise<boolean>

	loadFromRemote: () => Promise<boolean>
	reloadPreservingLocalDraft: () => Promise<boolean>
	reloadCurrentVersion: () => Promise<void>
	reloadDiscardingLocalDraft: () => Promise<boolean>

	saveToRemote: () => Promise<void>
	generateContent: (data?: DesignData) => string

	loadWithVersion: (version: number) => Promise<DesignData | null>
	loadLatest: () => Promise<DesignCurrentFileLoadResult>

	checkRemoteUpdate: () => Promise<{
		hasUpdate: boolean
		currentFingerprint: string | null
		isCheckReliable: boolean
	}>

	setAccessMode: (value: CanvasAccessMode) => void
	clearConflictState: () => void
	resolveBlockingConflictWithRemote: () => boolean
	resolveBlockingConflictWithLocal: () => Promise<boolean>
	resolveElementConflictWithLocal: (elementId: string) => boolean
	resolveElementConflictWithRemote: (elementId: string) => boolean
	resolveConnectionConflictWithLocal: (connectionId: string) => boolean
	resolveConnectionConflictWithRemote: (connectionId: string) => boolean
	resolveEditedElementConflictsWithLocal: (
		elementIds: string[],
		nextDesignData: DesignData,
		metadata?: DesignSaveMetadata,
	) => boolean

	isProcessingRevoke: boolean
	revokeType: "revoke" | "restore" | null
	conflictState: DesignConflict | null

	fileVersionsList: FileHistoryVersion[]
	fileVersion: number | undefined
	isNewestVersion: boolean
	handleChangeFileVersion: (version: number, isNewestVersion: boolean) => Promise<void>
	handleReturnLatest: () => void
	handleVersionRollback: (version?: number) => Promise<void>
	fetchFileVersions: () => Promise<FileHistoryVersion[]>

	getRemoteListener: () => DesignRemoteListener | null
}

export class DesignProjectManager implements DesignProjectManagerAPI {
	magicProjectJsFileId: string | null
	designData: DesignData
	updateDesignData: (updater: (draft: DesignData) => void) => void
	updateDesignDataAndScheduleSave: (
		updater: (draft: DesignData) => void,
		metadata?: DesignSaveMetadata,
	) => void

	isInitialLoading: boolean
	isSaving: boolean

	fileVersionsList: FileHistoryVersion[]
	fileVersion: number | undefined
	isProcessingRevoke: boolean
	revokeType: "revoke" | "restore" | null
	conflictState: DesignConflict | null

	private loadManager: DesignLoadManager
	private saveManager: DesignSaveManager
	private versionManager: DesignVersionManager
	private remoteListener: DesignRemoteListener | null = null

	private fetchRemoteDesignDataFn: FetchRemoteDesignDataFn
	private applyRemoteDesignDataFn: ApplyRemoteDesignDataFn
	private loadAndApplyRemoteFn: LoadAndApplyRemoteFn
	private pendingRemoteDesignData: {
		data: DesignData
		updateType: "message" | "revoke" | "restore"
	} | null = null
	private versionDataSourceLockCount = 0
	private baseDesignData: DesignData | null = null
	private draftSaveTimer: ReturnType<typeof setTimeout> | null = null
	private pendingDraftSave: {
		designData: DesignData
		reason: DesignDraftReason
		baseSnapshot: LocalDraftBaseSnapshot
	} | null = null
	private hasShownLocalDraftUnavailableToast = false
	private remoteLoadMetadata = new WeakMap<object, LoadDesignDataToRuntimeResult>()

	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private getFileVersion: () => number | undefined
	private getAccessMode: () => CanvasAccessMode

	constructor(params: DesignProjectManagerFactoryParams) {
		const { stateBag, options, getFileVersion } = params

		this.stateBag = stateBag
		this.options = options
		this.getFileVersion = getFileVersion
		this.getAccessMode = () => stateBag.getAccessMode()

		this.magicProjectJsFileId = null
		this.designData = {
			type: "design",
			name: "",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: { elements: [] },
		}
		this.updateDesignData = noopDesignDataUpdater
		this.updateDesignDataAndScheduleSave = noopDesignDataUpdater
		this.isInitialLoading = true
		this.isSaving = false
		this.fileVersionsList = []
		this.fileVersion = undefined
		this.isProcessingRevoke = false
		this.revokeType = null
		this.conflictState = null

		this.loadManager = new DesignLoadManager(stateBag, options)
		const saveLifecycleHandlers: DesignSaveLifecycleHandlers = {
			onSaveStart: () => this.remoteListener?.beginLocalSave() ?? null,
			// 在处理保存期间积累的远端通知前，接受本次实际保存正文作为共同基准。
			onSaveCommitted: (result) => this.handleSuccessfulSaveResult(result),
			onSaveEnd: async (saveToken) => {
				await this.remoteListener?.endLocalSave(saveToken)
			},
			onAutoSaveResult: async (saveResult) => {
				if (saveResult.ok) {
					if (saveResult.fullyPersisted && !this.hasUnresolvedMergeConflicts()) {
						this.clearLocalDraftAfterFullyPersistedSave(saveResult)
					}
					return
				}
				await this.handleSaveResultConflict(saveResult)
			},
			shouldBlockEmptyCanvasSave: (context) => this.shouldBlockUnsafeEmptyCanvasSave(context),
		}
		this.saveManager = new DesignSaveManager(
			stateBag,
			options,
			async () => {
				// Will be set after versionManager is created
				return []
			},
			(fileId, requestOptions) => this.loadManager.readCurrentFile(fileId, requestOptions),
			saveLifecycleHandlers,
		)
		this.versionManager = new DesignVersionManager(
			stateBag,
			options,
			this.saveManager,
			getFileVersion,
			(fileId, requestOptions) => this.loadManager.readCurrentFile(fileId, requestOptions),
		)
		this.saveManager.updateFetchAndSetVersions(() => this.versionManager.fetchFileVersions())

		const fetchRemoteDesignData: FetchRemoteDesignDataFn = async () => {
			const fid = this.stateBag.getMagicProjectJsFileId()
			if (!fid) return null

			try {
				const snapshot = await this.versionManager.loadLatest()
				const { data, loadResult } = snapshot
				if (
					!data ||
					!loadResult ||
					snapshot.fileId !== this.stateBag.getMagicProjectJsFileId() ||
					snapshot.accessIdentity !== getDesignRequestIdentity(this.options)
				)
					return null

				const clonedData = cloneDeep(data) as DesignData
				transferHydratedElementDetailsProvenance(data, clonedData)
				if (loadResult) this.remoteLoadMetadata.set(clonedData, loadResult)
				return {
					...snapshot,
					data: clonedData,
					loadResult,
				}
			} catch (error) {
				if (error instanceof DesignLoadError) {
					this.stateBag.setters.setDesignLoadIssue?.(error.issue)
				}
				return null
			}
		}

		const isVersionDataSourceLocked = () => this.isVersionDataSourceLocked()

		const applyRemoteDesignData: ApplyRemoteDesignDataFn = (
			newData: DesignData,
			updateType: "message" | "revoke" | "restore",
			applyOptions,
		) => {
			const loadResult =
				applyOptions?.loadResult ?? this.remoteLoadMetadata.get(newData as object)
			const applied = this.applyRemoteDesignDataSafely(newData, updateType)
			if (applied) this.applyLoadMetadata(loadResult)
			return applied
		}

		const loadAndApplyRemote: LoadAndApplyRemoteFn = async (
			updateType: "message" | "revoke" | "restore" = "message",
		) => {
			const loadIdentity = this.loadManager.getCurrentLoadIdentity()
			const isCurrentLoad = () =>
				!loadIdentity || this.loadManager.isCurrentLoadIdentity(loadIdentity)
			if (isVersionDataSourceLocked()) return false
			const remote = await fetchRemoteDesignData()
			if (isVersionDataSourceLocked() || !isCurrentLoad()) return false
			if (!remote?.data) return false
			return applyRemoteDesignData(remote.data, updateType, {
				loadResult: remote.loadResult,
			})
		}

		this.fetchRemoteDesignDataFn = fetchRemoteDesignData
		this.applyRemoteDesignDataFn = applyRemoteDesignData
		this.loadAndApplyRemoteFn = loadAndApplyRemote

		const listenerOptions: DesignRemoteListenerOptions = {
			...options,
			getAccessMode: () => this.getAccessMode(),
			getMagicProjectJsFileId: () => this.stateBag.getMagicProjectJsFileId(),
			getIsViewingHistory: isVersionDataSourceLocked,
			getDesignDataName: () => this.stateBag.getDesignData().name,
			fetchAndSetVersions: () => this.versionManager.fetchFileVersions(),
			loadAndApplyRemote,
			fetchRemoteDesignData,
			applyRemoteDesignData,
			updateListenerDebounceMs: options.updateListenerDebounceMs ?? 100,
			setIsProcessingRevoke: (v) => this.stateBag.setters.setIsProcessingRevoke(v),
			setRevokeType: (v) => this.stateBag.setters.setRevokeType(v),
		}

		this.remoteListener = new DesignRemoteListener(listenerOptions)
	}

	updateOptions(options: DesignProjectManagerOptions): void {
		const previousBaseMode = getDesignBaseAccessMode(this.options)
		const nextBaseMode = getDesignBaseAccessMode(options)
		this.options = options
		if (
			this.stateBag.getAccessMode() === previousBaseMode &&
			nextBaseMode !== previousBaseMode
		) {
			this.setAccessMode(nextBaseMode)
		}
		this.loadManager.updateOptions(options)
		this.saveManager.updateOptions(options)
		this.versionManager.updateOptions(options)
		this.remoteListener?.updateOptions({
			...options,
			getAccessMode: () => this.getAccessMode(),
			getMagicProjectJsFileId: () => this.stateBag.getMagicProjectJsFileId(),
			getIsViewingHistory: () => this.isVersionDataSourceLocked(),
			getDesignDataName: () => this.stateBag.getDesignData().name,
			fetchAndSetVersions: () => this.versionManager.fetchFileVersions(),
			loadAndApplyRemote: this.loadAndApplyRemoteFn,
			fetchRemoteDesignData: this.fetchRemoteDesignDataFn,
			applyRemoteDesignData: this.applyRemoteDesignDataFn,
		})
	}

	private getUpgradeIdentity() {
		return {
			projectId: this.options.projectId,
			designProjectId: this.options.designProjectId,
			magicProjectJsFileId: this.stateBag.getMagicProjectJsFileId(),
		}
	}

	private buildPendingUpgrade(
		loadResult: LoadDesignDataToRuntimeResult,
		reason: PendingDesignUpgrade["reason"] = "legacy-dsl",
	): PendingDesignUpgrade | null {
		const fileId = this.stateBag.getMagicProjectJsFileId()
		if (!fileId) return null
		return {
			reason,
			fileId,
			sourceVersion: loadResult.sourceVersion,
			targetVersion: MAGIC_PROJECT_VERSION_V3,
			createdAt: Date.now(),
		}
	}

	private applyLoadMetadata(loadResult: LoadDesignDataToRuntimeResult | undefined): void {
		if (!loadResult) return
		this.stateBag.setters.setSidecarStatus?.(loadResult.sidecarStatus)
		this.stateBag.setters.setDesignLoadIssue?.(loadResult.issue)
		if (loadResult.sidecarStatus === "unsupported") {
			this.stateBag.setters.setPendingDesignUpgrade?.(null)
			this.stateBag.setters.setAccessMode("readonly")
			return
		}

		if (loadResult.needsPersist) {
			const pending = this.buildPendingUpgrade(loadResult)
			if (pending) {
				this.stateBag.setters.setPendingDesignUpgrade?.(pending)
				void writePendingDesignUpgrade(this.getUpgradeIdentity(), pending)
			}
		}
	}

	private async restoreStoredPendingUpgrade(): Promise<void> {
		if (this.stateBag.getSidecarStatus?.() === "unsupported") return
		if (this.stateBag.getPendingDesignUpgrade?.()) return
		const stored = await readPendingDesignUpgrade(this.getUpgradeIdentity())
		if (!stored || stored.fileId !== this.stateBag.getMagicProjectJsFileId()) return
		const pending: PendingDesignUpgrade = {
			...stored,
			reason: "sidecar-retry",
			createdAt: stored.createdAt || Date.now(),
		}
		this.stateBag.setters.setPendingDesignUpgrade?.(pending)
		this.stateBag.setters.setDesignLoadIssue?.({
			kind: "sidecar-persist-failed",
			stage: "hydrate-sidecar",
			message: "Canvas element details are waiting to be persisted",
			sourceVersion: pending.sourceVersion,
			fileId: pending.fileId,
		})
		this.stateBag.setters.setAccessMode("readonly")
	}

	private setBaseDesignData(data: DesignData | null): void {
		this.baseDesignData = data ? cloneDeep(data) : null
	}

	private applyElementDetailsProvenance(
		data: DesignData,
		...candidateData: Array<DesignData | null | undefined>
	) {
		const provenance = reconcileElementDetailsProvenance(
			data.canvas?.elements,
			getHydratedElementDetailsProvenance(data),
			...candidateData.map((candidate) =>
				candidate ? getHydratedElementDetailsProvenance(candidate) : undefined,
			),
			this.stateBag.getElementDetailsProvenance?.(),
		)
		setHydratedElementDetailsProvenance(data, provenance)
		this.stateBag.setters.setElementDetailsProvenance?.(provenance)
		return provenance
	}

	private isVersionDataSourceLocked(): boolean {
		return this.getFileVersion() !== undefined || this.versionDataSourceLockCount > 0
	}

	canUpdateCurrentDesignData(): boolean {
		return !this.isVersionDataSourceLocked()
	}

	private lockVersionDataSource(): () => void {
		let released = false
		this.versionDataSourceLockCount += 1
		return () => {
			if (released) return
			released = true
			this.versionDataSourceLockCount = Math.max(0, this.versionDataSourceLockCount - 1)
		}
	}

	private setSyncedRemoteBaseDesignData(data: DesignData): void {
		this.stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(data))
		this.setBaseDesignData(data)
	}

	private syncBaseDesignDataFromCurrent(): void {
		const currentData = this.stateBag.getDesignData()
		const currentFingerprint = hashDesignDataComparable(currentData)
		const syncedFingerprint = this.stateBag.getPrevDesignDataFingerprint()

		if (!syncedFingerprint || currentFingerprint !== syncedFingerprint) {
			return
		}

		this.setBaseDesignData(currentData)
	}

	private getBaseRemoteDataForLocalDraft(): DesignData | undefined {
		return this.baseDesignData ? (cloneDeep(this.baseDesignData) as DesignData) : undefined
	}

	private getLocalDraftBaseSnapshot(): LocalDraftBaseSnapshot | null {
		const baseRemoteFingerprint = this.stateBag.getPrevDesignDataFingerprint()
		if (
			!baseRemoteFingerprint ||
			!this.baseDesignData ||
			hashDesignDataComparable(this.baseDesignData) !== baseRemoteFingerprint
		) {
			return null
		}
		return {
			baseRemoteFingerprint,
			baseRemoteData: this.getBaseRemoteDataForLocalDraft(),
		}
	}

	private isUserCanvasDeletionSource(context: DesignSaveContext): boolean {
		if (context.source === "manual-save" || context.source === "conflict-resolution") {
			return true
		}
		if (context.source !== "canvas-patch" && context.source !== "canvas-full-export") {
			return false
		}
		return context.deletedElementIds.length > 0
	}

	private shouldBlockUnsafeEmptyCanvasSave(context: DesignSaveContext): boolean {
		const trustedBaseElementCount = getTopLevelElementCount(this.baseDesignData)
		const shouldBlock =
			context.nextElementCount === 0 &&
			trustedBaseElementCount > 0 &&
			!this.isUserCanvasDeletionSource(context)

		if (shouldBlock) {
			this.logBlockedEmptyCanvasSave(context, trustedBaseElementCount)
		}

		return shouldBlock
	}

	private logBlockedEmptyCanvasSave(
		context: DesignSaveContext,
		trustedBaseElementCount: number,
	): void {
		console.warn(
			DESIGN_SAVE_GUARD_LOG_PREFIX,
			JSON.stringify({
				event: "blocked-empty-canvas-save",
				source: context.source,
				beforeElementCount: context.beforeElementCount,
				nextElementCount: context.nextElementCount,
				trustedBaseElementCount,
				deletedElementIds: context.deletedElementIds,
				designDataVersion: context.designData.version,
				fileVersion: this.getFileVersion(),
				isVersionDataSourceLocked: this.isVersionDataSourceLocked(),
				isRemoteApplying: context.isRemoteApplying,
				fromDraft: context.fromDraft,
				hasPendingRemoteDesignData: this.pendingRemoteDesignData !== null,
			}),
		)
	}

	private shouldAutoSaveRestoredDraft(localData: DesignData, remoteData: DesignData): boolean {
		const localElementCount = getTopLevelElementCount(localData)
		const remoteElementCount = getTopLevelElementCount(remoteData)
		return localElementCount > 0 || remoteElementCount === 0
	}

	private enterDraftRestoreConflictForUnsafeEmptyLocal(options: {
		localData: DesignData
		remoteData: DesignData
		baseRemoteData?: DesignData
		baseFingerprint?: string
		localFingerprint?: string
		remoteFingerprint?: string
	}): void {
		const conflict = this.buildConflict({
			reason: "draft-remote-advanced",
			localData: options.localData,
			remoteData: options.remoteData,
			baseFingerprint: options.baseFingerprint,
			localFingerprint: options.localFingerprint,
			remoteFingerprint: options.remoteFingerprint,
		})
		this.setConflictState(conflict)
		this.writeConflictLocalDraftNow(
			conflict,
			options.localData,
			options.baseRemoteData ?? options.remoteData,
		)
		console.warn(
			DESIGN_SAVE_GUARD_LOG_PREFIX,
			JSON.stringify({
				event: "blocked-empty-draft-restore-autosave",
				source: "draft-restore",
				localElementCount: getTopLevelElementCount(options.localData),
				remoteElementCount: getTopLevelElementCount(options.remoteData),
				fileVersion: this.getFileVersion(),
				isVersionDataSourceLocked: this.isVersionDataSourceLocked(),
			}),
		)
	}

	private hasUnresolvedElementConflicts(
		conflict: DesignConflict | null = this.stateBag.getConflictState(),
	): boolean {
		return !!conflict?.elementConflicts?.some(({ status }) => status === "unresolved")
	}

	private hasUnresolvedConnectionConflicts(
		conflict: DesignConflict | null = this.stateBag.getConflictState(),
	): boolean {
		return !!conflict?.connectionConflicts?.some(({ status }) => status === "unresolved")
	}

	private hasUnresolvedMergeConflicts(
		conflict: DesignConflict | null = this.stateBag.getConflictState(),
	): boolean {
		return (
			this.hasUnresolvedElementConflicts(conflict) ||
			this.hasUnresolvedConnectionConflicts(conflict)
		)
	}

	private getUnresolvedConnectionConflictIds(
		conflict: DesignConflict | null = this.stateBag.getConflictState(),
	): string[] {
		return (conflict?.connectionConflicts ?? [])
			.filter(({ status }) => status === "unresolved")
			.map(({ connectionId }) => connectionId)
	}

	private hasBlockingConflict(): boolean {
		const conflict = this.stateBag.getConflictState()
		return !!conflict && !this.hasUnresolvedMergeConflicts(conflict)
	}

	private hasUnsafeLocalChanges(): boolean {
		return (
			this.hasBlockingConflict() ||
			this.hasUnresolvedMergeConflicts() ||
			this.saveManager.isLocalDirty() ||
			this.saveManager.hasPendingAutoSave() ||
			this.saveManager.hasRemoteConflict()
		)
	}

	private getLocalDraftDataForCurrentConflict(designData: DesignData): DesignData {
		const conflict = this.stateBag.getConflictState()
		if (!this.hasUnresolvedMergeConflicts(conflict)) {
			return designData
		}
		let localData = designData
		if (conflict?.elementConflicts?.length) {
			localData = this.buildLocalDataFromElementConflicts(
				localData,
				conflict.elementConflicts,
			)
		}
		if (conflict?.connectionConflicts?.length) {
			localData = this.buildLocalDataFromConnectionConflicts(
				localData,
				conflict.connectionConflicts,
			)
		}
		return localData
	}

	private getRemoteSaveDataForCurrentElementConflicts(
		designData: DesignData = this.stateBag.getDesignData(),
	): DesignData | null {
		const conflict = this.stateBag.getConflictState()
		if (!this.hasUnresolvedElementConflicts(conflict) || !conflict?.elementConflicts?.length) {
			return null
		}

		const unresolvedElementConflicts = conflict.elementConflicts.filter(
			({ status }) => status === "unresolved",
		)
		const patchResult = tryApplyCanvasDocumentPatch(
			designData.canvas,
			{
				upserts: unresolvedElementConflicts
					.filter(
						(
							elementConflict,
						): elementConflict is DesignElementConflict & {
							remoteElement: NonNullable<DesignElementConflict["remoteElement"]>
						} => !!elementConflict.remoteElement,
					)
					.map((elementConflict) => ({
						element: cloneDeep(elementConflict.remoteElement),
						parentId: elementConflict.remoteParentId,
					})),
				deletedElementIds: unresolvedElementConflicts
					.filter(({ remoteElement }) => !remoteElement)
					.map(({ elementId }) => elementId),
				changedElementIds: unresolvedElementConflicts.map(({ elementId }) => elementId),
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) {
			return null
		}

		return {
			...designData,
			canvas: patchResult.canvas,
		}
	}

	private buildConflict(options: {
		reason: DesignConflict["reason"]
		localData: DesignData
		remoteData: DesignData
		baseFingerprint?: string
		localFingerprint?: string
		remoteFingerprint?: string
		elementConflicts?: DesignElementConflict[]
		connectionConflicts?: DesignConnectionConflict[]
		mergedData?: DesignData
	}): DesignConflict {
		const localData = cloneDeep(options.localData) as DesignData
		const remoteData = cloneDeep(options.remoteData) as DesignData
		const mergedData = options.mergedData
			? (cloneDeep(options.mergedData) as DesignData)
			: undefined

		return {
			reason: options.reason,
			baseFingerprint:
				options.baseFingerprint ?? this.stateBag.getPrevDesignDataFingerprint(),
			localFingerprint: options.localFingerprint ?? hashDesignDataComparable(localData),
			remoteFingerprint: options.remoteFingerprint ?? hashDesignDataComparable(remoteData),
			localData,
			remoteData,
			createdAt: Date.now(),
			elementConflicts: options.elementConflicts,
			connectionConflicts: options.connectionConflicts,
			mergedData,
		}
	}

	private setConflictState(conflict: DesignConflict): void {
		this.conflictState = conflict
		this.stateBag.setters.setConflictState(conflict)
	}

	private clearBlockingConflictState(): void {
		if (this.hasUnresolvedMergeConflicts()) return
		this.clearConflictState()
	}

	private buildElementConflicts(
		mergeResult: ElementLevelMergeConflictResult,
		previousElementConflicts: DesignElementConflict[] = [],
	): DesignElementConflict[] {
		const createdAt = Date.now()
		const previousElementConflictsById = new Map(
			previousElementConflicts.map((elementConflict) => [
				elementConflict.elementId,
				elementConflict,
			]),
		)
		return mergeResult.elementConflicts.map((elementConflict) => {
			const previousElementConflict = previousElementConflictsById.get(
				elementConflict.elementId,
			)
			return {
				...elementConflict,
				status: "unresolved",
				createdAt:
					previousElementConflict?.status === "unresolved"
						? previousElementConflict.createdAt
						: createdAt,
			}
		})
	}

	private buildConnectionConflicts(
		mergeResult: ConnectionLevelMergeConflictResult,
		previousConnectionConflicts: DesignConnectionConflict[] = [],
	): DesignConnectionConflict[] {
		const createdAt = Date.now()
		const previousConnectionConflictsById = new Map(
			previousConnectionConflicts.map((connectionConflict) => [
				connectionConflict.connectionId,
				connectionConflict,
			]),
		)
		return mergeResult.connectionConflicts.map((connectionConflict) => {
			const previousConnectionConflict = previousConnectionConflictsById.get(
				connectionConflict.connectionId,
			)
			return {
				...connectionConflict,
				status: "unresolved",
				createdAt:
					previousConnectionConflict?.status === "unresolved"
						? previousConnectionConflict.createdAt
						: createdAt,
			}
		})
	}

	private mergeElementConflictsWithLatestRemote(options: {
		existingElementConflicts: DesignElementConflict[]
		remoteData: DesignData
		mergeResult?: ElementLevelMergeConflictResult
	}): DesignElementConflict[] {
		const refreshedExistingElementConflicts = refreshDesignElementConflictsFromRemoteData(
			options.existingElementConflicts,
			options.remoteData,
		)
		const nextElementConflictsById = new Map(
			refreshedExistingElementConflicts.map((elementConflict) => [
				elementConflict.elementId,
				elementConflict,
			]),
		)

		if (options.mergeResult) {
			this.buildElementConflicts(
				options.mergeResult,
				options.existingElementConflicts,
			).forEach((elementConflict) => {
				nextElementConflictsById.set(elementConflict.elementId, elementConflict)
			})
		}

		return Array.from(nextElementConflictsById.values())
	}

	private tryMergeElementConflictIntoData(
		data: DesignData,
		elementConflict: DesignElementConflict,
	): DesignData | null {
		if (
			elementConflict.status !== "unresolved" ||
			elementConflict.reason !== "same-element-changed" ||
			!elementConflict.baseElement ||
			!elementConflict.localElement ||
			!elementConflict.remoteElement ||
			elementConflict.baseParentId !== elementConflict.localParentId ||
			elementConflict.baseParentId !== elementConflict.remoteParentId
		) {
			return null
		}

		const mergedElement = tryMergeCanvasElementsByField(
			elementConflict.baseElement,
			elementConflict.localElement,
			elementConflict.remoteElement,
		)
		if (!mergedElement) return null

		const patchResult = tryApplyCanvasDocumentPatch(
			data.canvas,
			{
				upserts: [
					{
						element: mergedElement,
						parentId: elementConflict.remoteParentId,
					},
				],
				deletedElementIds: [],
				changedElementIds: [elementConflict.elementId],
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) return null

		return {
			...data,
			canvas: patchResult.canvas,
		}
	}

	private autoMergeElementConflictsIntoData(options: {
		mergedData: DesignData
		elementConflicts: DesignElementConflict[]
	}): {
		mergedData: DesignData
		elementConflicts: DesignElementConflict[]
		didAutoMerge: boolean
	} {
		let mergedData = options.mergedData
		let didAutoMerge = false
		const elementConflicts: DesignElementConflict[] = []

		options.elementConflicts.forEach((elementConflict) => {
			const nextMergedData = this.tryMergeElementConflictIntoData(mergedData, elementConflict)
			if (nextMergedData) {
				mergedData = nextMergedData
				didAutoMerge = true
				return
			}
			elementConflicts.push(elementConflict)
		})

		return {
			mergedData,
			elementConflicts,
			didAutoMerge,
		}
	}

	private buildLocalDataFromElementConflicts(
		mergedData: DesignData,
		elementConflicts: DesignElementConflict[],
	): DesignData {
		const unresolvedElementConflicts = elementConflicts.filter(
			({ status }) => status === "unresolved",
		)
		if (unresolvedElementConflicts.length === 0) {
			return cloneDeep(mergedData) as DesignData
		}

		const patchResult = tryApplyCanvasDocumentPatch(
			mergedData.canvas,
			{
				upserts: unresolvedElementConflicts
					.filter(
						(
							elementConflict,
						): elementConflict is DesignElementConflict & {
							localElement: NonNullable<DesignElementConflict["localElement"]>
						} => !!elementConflict.localElement,
					)
					.map((elementConflict) => ({
						element: cloneDeep(elementConflict.localElement),
						parentId: elementConflict.localParentId,
					})),
				deletedElementIds: unresolvedElementConflicts
					.filter(({ localElement }) => !localElement)
					.map(({ elementId }) => elementId),
				changedElementIds: unresolvedElementConflicts.map(({ elementId }) => elementId),
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) {
			return cloneDeep(mergedData) as DesignData
		}

		return {
			...mergedData,
			canvas: patchResult.canvas,
		}
	}

	private buildLocalDataFromConnectionConflicts(
		mergedData: DesignData,
		connectionConflicts: DesignConnectionConflict[],
	): DesignData {
		const unresolvedConnectionConflicts = connectionConflicts.filter(
			({ status }) => status === "unresolved",
		)
		if (unresolvedConnectionConflicts.length === 0) {
			return cloneDeep(mergedData) as DesignData
		}

		const patchResult = tryApplyCanvasDocumentPatch(
			mergedData.canvas,
			{
				upserts: [],
				deletedElementIds: [],
				changedElementIds: [],
				connectionUpserts: unresolvedConnectionConflicts
					.map(({ localConnection }) => localConnection)
					.filter(
						(
							connection,
						): connection is NonNullable<DesignConnectionConflict["localConnection"]> =>
							!!connection,
					)
					.map((connection) => cloneDeep(connection)),
				deletedConnectionIds: unresolvedConnectionConflicts
					.filter(({ localConnection }) => !localConnection)
					.map(({ connectionId }) => connectionId),
				changedConnectionIds: unresolvedConnectionConflicts.map(
					({ connectionId }) => connectionId,
				),
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) {
			return cloneDeep(mergedData) as DesignData
		}

		return {
			...mergedData,
			canvas: patchResult.canvas,
		}
	}

	private buildLocalDataFromMergeConflicts(
		baseData: DesignData,
		options: {
			elementConflicts?: DesignElementConflict[]
			connectionConflicts?: DesignConnectionConflict[]
		},
	): DesignData {
		let localData = baseData
		if (options.elementConflicts?.length) {
			localData = this.buildLocalDataFromElementConflicts(localData, options.elementConflicts)
		}
		if (options.connectionConflicts?.length) {
			localData = this.buildLocalDataFromConnectionConflicts(
				localData,
				options.connectionConflicts,
			)
		}
		return localData
	}

	private applyConnectionConflictResolutionToData(
		data: DesignData,
		connectionConflicts: DesignConnectionConflict[],
		resolution: "use-local" | "use-remote",
	): DesignData | null {
		const targetConnections = connectionConflicts
			.map((connectionConflict) =>
				resolution === "use-local"
					? connectionConflict.localConnection
					: connectionConflict.remoteConnection,
			)
			.filter(
				(
					connection,
				): connection is NonNullable<DesignConnectionConflict["localConnection"]> =>
					!!connection,
			)
			.map((connection) => cloneDeep(connection))
		const deletedConnectionIds = connectionConflicts
			.filter((connectionConflict) =>
				resolution === "use-local"
					? !connectionConflict.localConnection
					: !connectionConflict.remoteConnection,
			)
			.map(({ connectionId }) => connectionId)
		const changedConnectionIds = connectionConflicts.map(({ connectionId }) => connectionId)

		const patchResult = tryApplyCanvasDocumentPatch(
			data.canvas,
			{
				upserts: [],
				deletedElementIds: [],
				changedElementIds: [],
				connectionUpserts: targetConnections,
				deletedConnectionIds,
				changedConnectionIds,
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) return null

		return {
			...data,
			canvas: patchResult.canvas,
		}
	}

	private refreshElementConflictStateAfterRemoteMerge(options: {
		remoteData: DesignData
		mergedData: DesignData
		mergeResult?: ElementLevelMergeConflictResult
	}): { refreshed: boolean; localData?: DesignData } {
		const existingConflict = this.stateBag.getConflictState()
		if (!existingConflict?.elementConflicts?.length) return { refreshed: false }

		const elementConflicts = this.mergeElementConflictsWithLatestRemote({
			existingElementConflicts: existingConflict.elementConflicts,
			remoteData: options.remoteData,
			mergeResult: options.mergeResult,
		})
		const autoMergeResult = this.autoMergeElementConflictsIntoData({
			mergedData: options.mergedData,
			elementConflicts,
		})
		if (!autoMergeResult.elementConflicts.some(({ status }) => status === "unresolved")) {
			this.clearConflictState()
			return {
				refreshed: false,
				localData: autoMergeResult.didAutoMerge ? autoMergeResult.mergedData : undefined,
			}
		}

		const remoteFingerprint = hashDesignDataComparable(options.remoteData)
		const localData = this.buildLocalDataFromElementConflicts(
			autoMergeResult.mergedData,
			autoMergeResult.elementConflicts,
		)
		const nextConflict: DesignConflict = {
			...existingConflict,
			reason: "element-level-conflict",
			baseFingerprint: remoteFingerprint,
			localFingerprint: hashDesignDataComparable(localData),
			remoteFingerprint,
			localData,
			remoteData: cloneDeep(options.remoteData) as DesignData,
			mergedData: cloneDeep(autoMergeResult.mergedData) as DesignData,
			elementConflicts: autoMergeResult.elementConflicts,
		}

		this.setConflictState(nextConflict)
		this.writeConflictLocalDraftNow(nextConflict, localData)
		return { refreshed: true, localData }
	}

	private deferRemoteDesignData(
		newData: DesignData,
		updateType: "message" | "revoke" | "restore",
		options: {
			reason?: DesignConflict["reason"]
		} = {},
	): void {
		const localData = this.stateBag.getDesignData()
		const remoteData = cloneDeep(newData) as DesignData
		transferHydratedElementDetailsProvenance(newData, remoteData)
		this.pendingRemoteDesignData = {
			data: remoteData,
			updateType,
		}
		this.saveManager.cancelAutoSave()
		this.saveManager.markRemoteConflict()
		this.setConflictState(
			this.buildConflict({
				reason: options.reason ?? "remote-update-with-local-dirty",
				localData,
				remoteData,
			}),
		)
	}

	private applyRemoteDesignDataNow(
		newData: DesignData,
		updateType: "message" | "revoke" | "restore",
	): boolean {
		try {
			const oldData = this.stateBag.getDesignData()
			this.applyElementDetailsProvenance(newData, oldData)
			this.pendingRemoteDesignData = null
			this.saveManager.cancelAutoSave()
			this.saveManager.clearRemoteConflict()
			this.clearConflictState()
			this.stateBag.setters.setIsSaving(false)
			this.stateBag.setters.setDesignData(newData)
			this.setSyncedRemoteBaseDesignData(newData)
			this.options.onRemoteDesignDataUpdate?.(oldData, newData, updateType)
			return true
		} catch {
			return false
		}
	}

	private tryMergeRemoteDesignData(
		newData: DesignData,
		updateType: "message" | "revoke" | "restore",
	): boolean {
		if (updateType !== "message") return false
		if (this.hasBlockingConflict()) return false
		if (!this.baseDesignData) {
			return false
		}

		const oldData = this.stateBag.getDesignData()
		const mergeResult = mergeDesignDataByElement({
			baseData: this.baseDesignData,
			localData: oldData,
			remoteData: newData,
		})

		if (!mergeResult.ok) {
			if (mergeResult.isElementLevelConflict) {
				return this.applyElementLevelMergeConflict(newData, updateType, mergeResult)
			}
			if (mergeResult.isConnectionLevelConflict) {
				return this.applyConnectionLevelMergeConflict(newData, updateType, mergeResult)
			}

			return false
		}

		try {
			const mergedData = mergeResult.mergedData
			if (!this.shouldAutoSaveRestoredDraft(mergedData, newData)) {
				this.deferRemoteDesignData(newData, updateType)
				return true
			}

			this.pendingRemoteDesignData = null
			this.saveManager.cancelAutoSave()
			this.saveManager.clearRemoteConflict()
			this.stateBag.setters.setIsSaving(false)
			const elementConflictRefresh = this.refreshElementConflictStateAfterRemoteMerge({
				remoteData: newData,
				mergedData,
			})
			const nextDesignData = elementConflictRefresh.localData ?? mergedData
			this.applyElementDetailsProvenance(nextDesignData, newData, oldData)
			this.stateBag.setters.setDesignData(nextDesignData)
			this.setSyncedRemoteBaseDesignData(newData)
			this.clearBlockingConflictState()
			this.options.onRemoteDesignDataUpdate?.(oldData, nextDesignData, updateType)
			if (!elementConflictRefresh.refreshed) {
				this.persistLocalDraft(nextDesignData)
				this.saveManager.scheduleAutoSave(undefined, { source: "remote-merge" })
			}
			return true
		} catch {
			return false
		}
	}

	private applyElementLevelMergeConflict(
		newData: DesignData,
		updateType: "message",
		mergeResult: ElementLevelMergeConflictResult,
	): boolean {
		if (!this.baseDesignData) return false

		try {
			const oldData = this.stateBag.getDesignData()
			const baseRemoteData = cloneDeep(this.baseDesignData) as DesignData
			const mergedData = mergeResult.mergedData
			const existingConflict = this.stateBag.getConflictState()
			const elementConflicts = this.mergeElementConflictsWithLatestRemote({
				existingElementConflicts: existingConflict?.elementConflicts ?? [],
				remoteData: newData,
				mergeResult,
			})
			const localData = this.buildLocalDataFromElementConflicts(mergedData, elementConflicts)
			const conflict = this.buildConflict({
				reason: "element-level-conflict",
				localData,
				remoteData: newData,
				elementConflicts,
				mergedData,
			})
			this.applyElementDetailsProvenance(localData, newData, oldData)

			this.pendingRemoteDesignData = null
			this.saveManager.cancelAutoSave()
			this.saveManager.clearRemoteConflict()
			this.stateBag.setters.setIsSaving(false)
			this.stateBag.setters.setDesignData(localData)
			this.setSyncedRemoteBaseDesignData(newData)
			this.options.onRemoteDesignDataUpdate?.(oldData, localData, updateType)
			this.setConflictState(conflict)
			this.writeConflictLocalDraftNow(conflict, localData, baseRemoteData)

			return true
		} catch {
			return false
		}
	}

	private applyConnectionLevelMergeConflict(
		newData: DesignData,
		updateType: "message",
		mergeResult: ConnectionLevelMergeConflictResult,
	): boolean {
		if (!this.baseDesignData) return false

		try {
			const oldData = this.stateBag.getDesignData()
			const baseRemoteData = cloneDeep(this.baseDesignData) as DesignData
			const mergedData = mergeResult.mergedData
			const existingConflict = this.stateBag.getConflictState()
			const connectionConflicts = this.buildConnectionConflicts(
				mergeResult,
				existingConflict?.connectionConflicts ?? [],
			)
			const localData = this.buildLocalDataFromConnectionConflicts(
				mergedData,
				connectionConflicts,
			)
			const conflict = this.buildConflict({
				reason: "connection-level-conflict",
				localData,
				remoteData: newData,
				connectionConflicts,
				mergedData,
			})
			this.applyElementDetailsProvenance(localData, newData, oldData)

			this.pendingRemoteDesignData = null
			this.saveManager.cancelAutoSave()
			this.saveManager.clearRemoteConflict()
			this.stateBag.setters.setIsSaving(false)
			this.stateBag.setters.setDesignData(localData)
			this.setSyncedRemoteBaseDesignData(newData)
			this.options.onRemoteDesignDataUpdate?.(oldData, localData, updateType)
			this.setConflictState(conflict)
			this.writeConflictLocalDraftNow(conflict, localData, baseRemoteData)

			return true
		} catch {
			return false
		}
	}

	private applyRemoteDesignDataSafely(
		newData: DesignData,
		updateType: "message" | "revoke" | "restore",
	): boolean {
		if (!Array.isArray(newData?.canvas?.elements)) {
			return false
		}
		if (this.isVersionDataSourceLocked()) {
			return false
		}
		if (
			updateType === "message" &&
			hashDesignDataComparable(newData) === this.stateBag.getPrevDesignDataFingerprint()
		)
			return true
		if (this.hasUnsafeLocalChanges()) {
			if (this.tryMergeRemoteDesignData(newData, updateType)) {
				return true
			}
			this.deferRemoteDesignData(newData, updateType)
			return false
		}

		return this.applyRemoteDesignDataNow(newData, updateType)
	}

	private tryApplyPendingRemoteDesignData(): boolean {
		const pending = this.pendingRemoteDesignData
		if (!pending || this.isVersionDataSourceLocked() || this.hasUnsafeLocalChanges()) {
			return false
		}
		const applied = this.applyRemoteDesignDataNow(pending.data, pending.updateType)
		if (applied) this.applyLoadMetadata(this.remoteLoadMetadata.get(pending.data as object))
		return applied
	}

	private clearPendingRemoteDesignData(): void {
		this.pendingRemoteDesignData = null
		this.saveManager.clearRemoteConflict()
		this.clearConflictState()
	}

	scheduleAutoSave(metadata?: DesignSaveMetadata): void {
		if (this.isVersionDataSourceLocked()) {
			return
		}
		if (this.hasUnresolvedConnectionConflicts()) {
			return
		}
		if (this.hasUnresolvedElementConflicts()) {
			const remoteSaveData = this.getRemoteSaveDataForCurrentElementConflicts()
			if (!remoteSaveData) {
				return
			}
			this.saveManager.scheduleAutoSave(remoteSaveData, {
				...metadata,
				source: metadata?.source ?? "conflict-resolution",
			})
			return
		}
		this.saveManager.scheduleAutoSave(undefined, metadata)
	}

	cancelAutoSave(): void {
		this.saveManager.cancelAutoSave()
	}

	private getDraftIdentity(): DesignDraftIdentity {
		return {
			projectId: this.options.projectId,
			designProjectId: this.options.designProjectId,
			magicProjectJsFileId: this.stateBag.getMagicProjectJsFileId(),
		}
	}

	private canUseLocalDraft(): boolean {
		return (
			!!this.options.projectId &&
			!!this.options.designProjectId &&
			!!this.stateBag.getMagicProjectJsFileId() &&
			this.getAccessMode() === "edit" &&
			!this.isVersionDataSourceLocked() &&
			this.getFileVersion() === undefined
		)
	}

	private getDesignProjectBasePath(): string | undefined {
		return resolveDesignProjectBasePathFromAttachments(this.options)
	}

	private clearPendingLocalDraftTimer(): void {
		if (this.draftSaveTimer) {
			clearTimeout(this.draftSaveTimer)
			this.draftSaveTimer = null
		}
		this.pendingDraftSave = null
	}

	private writeLocalDraftNow(
		designData: DesignData,
		reason: DesignDraftReason,
		baseSnapshot: LocalDraftBaseSnapshot | null = this.getLocalDraftBaseSnapshot(),
	): Promise<DesignDraftWriteResult | null> {
		if (!this.canUseLocalDraft()) {
			return Promise.resolve(null)
		}
		if (!baseSnapshot) {
			return Promise.resolve(null)
		}

		const localFingerprint = hashDesignDataComparable(designData)
		const identity = this.getDraftIdentity()
		if (localFingerprint === baseSnapshot.baseRemoteFingerprint) {
			void deleteDesignDraft(identity)
			return Promise.resolve({ target: "none", durable: true })
		}

		const shouldWriteEmergencyDraft = reason === "pagehide" || reason === "manual-refresh"

		return writeDesignDraft(
			{
				...identity,
				designProjectBasePath: this.getDesignProjectBasePath(),
				baseRemoteFingerprint: baseSnapshot.baseRemoteFingerprint,
				localFingerprint,
				localUpdatedAt: Date.now(),
				reason,
				designData,
				baseRemoteData: baseSnapshot.baseRemoteData,
			},
			{ emergency: shouldWriteEmergencyDraft },
		).then((result) => {
			this.handleLocalDraftWriteResult(result, reason)
			return result
		})
	}

	private writeConflictLocalDraftNow(
		conflict: DesignConflict,
		localData: DesignData,
		baseRemoteData?: DesignData,
	): void {
		if (!this.canUseLocalDraft()) {
			return
		}

		const baseRemoteFingerprint = conflict.baseFingerprint || conflict.remoteFingerprint
		if (!baseRemoteFingerprint) {
			return
		}

		const matchingBaseRemoteData =
			baseRemoteData && hashDesignDataComparable(baseRemoteData) === baseRemoteFingerprint
				? (cloneDeep(baseRemoteData) as DesignData)
				: hashDesignDataComparable(conflict.remoteData) === baseRemoteFingerprint
					? (cloneDeep(conflict.remoteData) as DesignData)
					: undefined
		const localFingerprint = hashDesignDataComparable(localData)
		void writeDesignDraft({
			...this.getDraftIdentity(),
			designProjectBasePath: this.getDesignProjectBasePath(),
			baseRemoteFingerprint,
			localFingerprint,
			localUpdatedAt: Date.now(),
			reason: "local-edit",
			designData: localData,
			baseRemoteData: matchingBaseRemoteData,
		}).then((result) => this.handleLocalDraftWriteResult(result, "local-edit"))
	}

	private handleLocalDraftWriteResult(
		result: DesignDraftWriteResult,
		reason: DesignDraftReason,
	): void {
		if (result.durable) {
			this.hasShownLocalDraftUnavailableToast = false
			return
		}
		if (reason === "pagehide" || this.hasShownLocalDraftUnavailableToast) return
		this.hasShownLocalDraftUnavailableToast = true
	}

	persistLocalDraft(
		designData: DesignData,
		options: { immediate?: boolean; reason?: DesignDraftReason } = {},
	): void {
		if (this.isVersionDataSourceLocked()) {
			this.clearPendingLocalDraftTimer()
			return
		}
		const reason = options.reason ?? "local-edit"
		const draftDesignData = this.getLocalDraftDataForCurrentConflict(designData)
		const baseSnapshot = this.getLocalDraftBaseSnapshot()
		if (options.immediate) {
			this.clearPendingLocalDraftTimer()
			void this.writeLocalDraftNow(draftDesignData, reason, baseSnapshot)
			return
		}
		if (!baseSnapshot) {
			this.clearPendingLocalDraftTimer()
			return
		}

		this.pendingDraftSave = {
			designData: cloneDeep(draftDesignData) as DesignData,
			reason,
			baseSnapshot,
		}
		if (this.draftSaveTimer) {
			clearTimeout(this.draftSaveTimer)
		}
		this.draftSaveTimer = setTimeout(() => {
			const pending = this.pendingDraftSave
			this.draftSaveTimer = null
			this.pendingDraftSave = null
			if (!pending) return
			this.writeLocalDraftNow(pending.designData, pending.reason, pending.baseSnapshot)
		}, getDesignDraftWriteDebounceMs())
	}

	async persistLocalDraftAndWait(
		designData: DesignData,
		options: { immediate?: boolean; reason?: DesignDraftReason } = {},
	): Promise<DesignDraftWriteResult | null> {
		if (!options.immediate) {
			this.persistLocalDraft(designData, options)
			return null
		}

		this.clearPendingLocalDraftTimer()
		const reason = options.reason ?? "local-edit"
		const draftDesignData = this.getLocalDraftDataForCurrentConflict(designData)
		return this.writeLocalDraftNow(draftDesignData, reason)
	}

	hasUnsavedChanges(designData?: DesignData): boolean {
		if (
			this.hasBlockingConflict() ||
			this.hasUnresolvedMergeConflicts() ||
			this.saveManager.hasRemoteConflict() ||
			this.stateBag.getPendingDesignUpgrade?.()
		) {
			return true
		}

		const previousFingerprint = this.stateBag.getPrevDesignDataFingerprint()
		if (!previousFingerprint) return true
		return (
			hashDesignDataComparable(designData ?? this.stateBag.getDesignData()) !==
			previousFingerprint
		)
	}

	private clearLocalDraft(): void {
		this.clearPendingLocalDraftTimer()
		void deleteDesignDraft(this.getDraftIdentity())
	}

	private isCurrentSaveResult(result: Extract<DesignSaveResult, { ok: true }>): boolean {
		return (
			result.fileId === this.stateBag.getMagicProjectJsFileId() &&
			result.accessIdentity === getDesignRequestIdentity(this.options) &&
			result.savedFingerprint === this.stateBag.getPrevDesignDataFingerprint()
		)
	}

	private clearLocalDraftAfterFullyPersistedSave(
		result: Extract<DesignSaveResult, { ok: true }>,
	): void {
		const expectedLocalFingerprint = result.savedFingerprint
		if (
			!result.fullyPersisted ||
			!this.isCurrentSaveResult(result) ||
			hashDesignDataComparable(this.stateBag.getDesignData()) !== expectedLocalFingerprint
		)
			return
		void deleteDesignDraft(this.getDraftIdentity(), expectedLocalFingerprint)
	}

	private clearLocalDraftBecauseAlreadySynced(): void {
		this.clearLocalDraft()
	}

	private clearLocalDraftBecauseRemoteAccepted(): void {
		this.clearLocalDraft()
	}

	private clearLocalDraftBecauseVersionSwitched(): void {
		this.clearLocalDraft()
	}

	private tryMergeRemoteAdvancedDraft(options: {
		draft: DesignDraftEntry
		draftData: DesignData
		baseData: DesignData
		remoteData: DesignData
		remoteFingerprint: string
	}): boolean {
		const { draft, draftData, baseData, remoteData, remoteFingerprint } = options
		const mergeResult = mergeDesignDataByElement({
			baseData,
			localData: draftData,
			remoteData,
		})
		const oldData = this.stateBag.getDesignData()

		if (mergeResult.ok) {
			const mergedData = mergeResult.mergedData
			if (!this.shouldAutoSaveRestoredDraft(mergedData, remoteData)) {
				this.enterDraftRestoreConflictForUnsafeEmptyLocal({
					localData: mergedData,
					remoteData,
					baseRemoteData: baseData,
					baseFingerprint: draft.baseRemoteFingerprint,
					localFingerprint: hashDesignDataComparable(mergedData),
					remoteFingerprint,
				})
				return true
			}

			this.stateBag.setters.setDesignData(mergedData)
			this.setSyncedRemoteBaseDesignData(remoteData)
			this.options.onRemoteDesignDataUpdate?.(oldData, mergedData, "draft")
			this.clearConflictState()
			this.persistLocalDraft(mergedData, { immediate: true })
			this.saveManager.scheduleAutoSave(undefined, { source: "draft-restore" })
			return true
		}

		if (!mergeResult.isElementLevelConflict && !mergeResult.isConnectionLevelConflict) {
			return false
		}

		const mergedData = mergeResult.mergedData
		const elementConflicts = mergeResult.isElementLevelConflict
			? this.buildElementConflicts(mergeResult)
			: undefined
		const connectionConflicts = mergeResult.isConnectionLevelConflict
			? this.buildConnectionConflicts(mergeResult)
			: undefined
		let localData = mergedData
		if (elementConflicts) {
			localData = this.buildLocalDataFromElementConflicts(localData, elementConflicts)
		}
		if (connectionConflicts) {
			localData = this.buildLocalDataFromConnectionConflicts(localData, connectionConflicts)
		}
		const conflict = this.buildConflict({
			reason: mergeResult.isConnectionLevelConflict
				? "connection-level-conflict"
				: "element-level-conflict",
			localData,
			remoteData,
			baseFingerprint: draft.baseRemoteFingerprint,
			localFingerprint: hashDesignDataComparable(localData),
			remoteFingerprint,
			elementConflicts,
			connectionConflicts,
			mergedData,
		})

		this.pendingRemoteDesignData = null
		this.saveManager.cancelAutoSave()
		this.saveManager.clearRemoteConflict()
		this.stateBag.setters.setIsSaving(false)
		this.stateBag.setters.setDesignData(localData)
		this.setSyncedRemoteBaseDesignData(remoteData)
		this.options.onRemoteDesignDataUpdate?.(oldData, localData, "draft")
		this.setConflictState(conflict)
		this.writeConflictLocalDraftNow(conflict, localData, baseData)
		return true
	}

	private async tryRestoreLocalDraftAfterRemoteLoad(
		loadIdentity: string | null = null,
	): Promise<void> {
		if (loadIdentity && !this.loadManager.isCurrentLoadIdentity(loadIdentity)) {
			return
		}
		if (!this.canUseLocalDraft()) {
			return
		}

		const identity = this.getDraftIdentity()
		const draft = await readDesignDraft(identity)
		if (loadIdentity && !this.loadManager.isCurrentLoadIdentity(loadIdentity)) {
			return
		}
		if (!draft) {
			return
		}

		const remoteFingerprint = this.stateBag.getPrevDesignDataFingerprint()
		if (!remoteFingerprint) {
			return
		}
		this.syncBaseDesignDataFromCurrent()
		if (draft.localFingerprint === remoteFingerprint) {
			void deleteDesignDraft(identity, draft.localFingerprint)
			return
		}

		const hasRemoteFingerprintChanged =
			!!draft.baseRemoteFingerprint && draft.baseRemoteFingerprint !== remoteFingerprint

		// 错配基准会把远端已删除的旧元素当成本地新增；保留草稿并进入原冲突入口。
		const hasTrustedDraftBase =
			!!draft.baseRemoteData &&
			hashDesignDataComparable(draft.baseRemoteData) === draft.baseRemoteFingerprint
		// 基准与本地相同表示没有用户修改；旧草稿不能恢复远端已经删除的元素。
		if (hasTrustedDraftBase && draft.localFingerprint === draft.baseRemoteFingerprint) {
			void deleteDesignDraft(identity, draft.localFingerprint)
			return
		}
		if (!hasTrustedDraftBase || hasRemoteFingerprintChanged) {
			const dslBase = this.getDesignProjectBasePath()
			const draftData =
				draft.designData.version === MAGIC_PROJECT_VERSION_V3
					? (cloneDeep(draft.designData) as DesignData)
					: (
							await loadDesignDataToRuntime({
								designData: draft.designData,
								pathContext: {
									projectBasePath: dslBase,
									flatAttachments: this.options.flatAttachments,
									attachmentIndex: this.options.attachmentIndex,
								},
							})
						).data
			const draftBaseData = draft.baseRemoteData
				? draft.baseRemoteData.version === MAGIC_PROJECT_VERSION_V3
					? (cloneDeep(draft.baseRemoteData) as DesignData)
					: (
							await loadDesignDataToRuntime({
								designData: draft.baseRemoteData,
								pathContext: {
									projectBasePath: dslBase,
									flatAttachments: this.options.flatAttachments,
									attachmentIndex: this.options.attachmentIndex,
								},
							})
						).data
				: null
			if (draftBaseData && hasTrustedDraftBase) {
				if (
					this.tryMergeRemoteAdvancedDraft({
						draft,
						draftData,
						baseData: draftBaseData,
						remoteData: this.stateBag.getDesignData(),
						remoteFingerprint,
					})
				) {
					return
				}
			}
			this.setConflictState(
				this.buildConflict({
					reason: "draft-remote-advanced",
					localData: draftData,
					remoteData: this.stateBag.getDesignData(),
					baseFingerprint: draft.baseRemoteFingerprint,
					localFingerprint: draft.localFingerprint,
					remoteFingerprint,
				}),
			)
			return
		}

		const dslBase = this.getDesignProjectBasePath()
		const restoredData =
			draft.designData.version === MAGIC_PROJECT_VERSION_V3
				? (cloneDeep(draft.designData) as DesignData)
				: (
						await loadDesignDataToRuntime({
							designData: draft.designData,
							pathContext: {
								projectBasePath: dslBase,
								flatAttachments: this.options.flatAttachments,
								attachmentIndex: this.options.attachmentIndex,
							},
						})
					).data

		const oldData = this.stateBag.getDesignData()
		if (!this.shouldAutoSaveRestoredDraft(restoredData, oldData)) {
			this.enterDraftRestoreConflictForUnsafeEmptyLocal({
				localData: restoredData,
				remoteData: oldData,
				baseRemoteData: this.baseDesignData ?? oldData,
				baseFingerprint: draft.baseRemoteFingerprint || remoteFingerprint,
				localFingerprint: draft.localFingerprint,
				remoteFingerprint,
			})
			return
		}
		this.stateBag.setters.setDesignData(restoredData)
		this.stateBag.setPrevDesignDataFingerprint(remoteFingerprint)
		this.options.onRemoteDesignDataUpdate?.(oldData, restoredData, "draft")
		this.saveManager.scheduleAutoSave(undefined, { source: "draft-restore" })
	}

	private async handleSaveResultConflict(saveResult: DesignSaveResult): Promise<boolean> {
		if (saveResult.ok) {
			if (!this.hasUnresolvedMergeConflicts()) {
				this.clearConflictState()
			}
			return false
		}
		if (saveResult.reason !== "remote-updated") return false

		try {
			const snapshot = saveResult.currentFile ?? (await this.versionManager.loadLatest())
			if (
				snapshot.fileId !== this.stateBag.getMagicProjectJsFileId() ||
				snapshot.accessIdentity !== getDesignRequestIdentity(this.options)
			)
				return false
			const { data, loadResult } = snapshot
			this.applyLoadMetadata(loadResult)
			if (!data) return false
			if (this.tryMergeRemoteDesignData(data, "message")) {
				return true
			}
			this.deferRemoteDesignData(data, "message", {
				reason: "save-content-conflict",
			})
			return true
		} catch {
			return false
		}
	}

	private refreshElementConflictStateAfterRemoteSave(savedRemoteData: DesignData): void {
		const existingConflict = this.stateBag.getConflictState()
		if (!this.hasUnresolvedElementConflicts(existingConflict) || !existingConflict) return

		const elementConflicts = refreshDesignElementConflictsFromRemoteData(
			existingConflict.elementConflicts ?? [],
			savedRemoteData,
		)
		const localData = this.buildLocalDataFromElementConflicts(
			this.stateBag.getDesignData(),
			elementConflicts,
		)
		const remoteFingerprint = hashDesignDataComparable(savedRemoteData)
		const nextConflict: DesignConflict = {
			...existingConflict,
			reason: "element-level-conflict",
			baseFingerprint: remoteFingerprint,
			localFingerprint: hashDesignDataComparable(localData),
			remoteFingerprint,
			localData,
			remoteData: cloneDeep(savedRemoteData) as DesignData,
			mergedData: cloneDeep(savedRemoteData) as DesignData,
			elementConflicts,
		}

		this.setConflictState(nextConflict)
		this.writeConflictLocalDraftNow(nextConflict, localData)
	}

	private async handleSuccessfulSaveResult(saveResult: DesignSaveResult): Promise<void> {
		if (
			!saveResult.ok ||
			saveResult.fileId !== this.stateBag.getMagicProjectJsFileId() ||
			saveResult.accessIdentity !== getDesignRequestIdentity(this.options)
		)
			return
		if (this.stateBag.getPrevDesignDataFingerprint() !== saveResult.baseFingerprint) {
			void this.loadAndApplyRemoteFn("message")
			return
		}
		if (!saveResult.fullyPersisted) {
			// 主文件已经成功；详情失败时以实际当前文件为基准，保留屏幕修改和草稿。
			try {
				const currentFile = await this.versionManager.loadLatest()
				if (
					currentFile.fileId !== saveResult.fileId ||
					currentFile.accessIdentity !== saveResult.accessIdentity ||
					saveResult.fileId !== this.stateBag.getMagicProjectJsFileId() ||
					saveResult.accessIdentity !== getDesignRequestIdentity(this.options)
				)
					return
				if (
					currentFile.data &&
					this.stateBag.getPrevDesignDataFingerprint() === saveResult.baseFingerprint
				)
					this.setSyncedRemoteBaseDesignData(currentFile.data)
			} catch {
				// 读取失败时保留原基准，重试仍需通过当前正文检查。
			}
			if (
				saveResult.fileId !== this.stateBag.getMagicProjectJsFileId() ||
				saveResult.accessIdentity !== getDesignRequestIdentity(this.options)
			)
				return
			const fileId = this.stateBag.getMagicProjectJsFileId()
			if (!fileId) return
			const currentPending = this.stateBag.getPendingDesignUpgrade?.()
			const retry: PendingDesignUpgrade = {
				reason: "sidecar-retry",
				fileId,
				sourceVersion: currentPending?.sourceVersion ?? MAGIC_PROJECT_VERSION_V3,
				targetVersion: MAGIC_PROJECT_VERSION_V3,
				createdAt: Date.now(),
			}
			this.stateBag.setters.setPendingDesignUpgrade?.(retry)
			this.stateBag.setters.setDesignLoadIssue?.({
				kind: "sidecar-persist-failed",
				stage: "hydrate-sidecar",
				message: "Canvas was saved, but element details still require persistence",
				sourceVersion: retry.sourceVersion,
				fileId,
			})
			this.stateBag.setters.setAccessMode("readonly")
			void writePendingDesignUpgrade(this.getUpgradeIdentity(), retry)
			return
		}

		const savedRemoteData = saveResult.savedDesignData
		if (!savedRemoteData) {
			this.syncBaseDesignDataFromCurrent()
			return
		}

		this.setSyncedRemoteBaseDesignData(savedRemoteData)
		if (this.hasUnresolvedElementConflicts()) {
			this.refreshElementConflictStateAfterRemoteSave(savedRemoteData)
			return
		}
		if (this.hasUnresolvedConnectionConflicts()) return
		this.clearConflictState()
	}

	async manualSave(designData?: DesignData): Promise<boolean> {
		if (this.isVersionDataSourceLocked()) {
			return false
		}
		if (this.hasUnresolvedConnectionConflicts()) {
			this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
			return false
		}
		if (this.hasUnresolvedElementConflicts()) {
			const remoteSaveData = this.getRemoteSaveDataForCurrentElementConflicts()
			if (!remoteSaveData) {
				this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
				return false
			}
			this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
			this.saveManager.cancelAutoSave()
			this.stateBag.setters.setIsSaving(true)
			const saveResult = await this.saveManager.commitSave({
				allowRemoteConflict: true,
				designData: remoteSaveData,
				updateCurrentDesignData: false,
				source: "conflict-resolution",
			})
			if (saveResult.ok) {
				if (!this.isCurrentSaveResult(saveResult)) return false
				this.pendingRemoteDesignData = null
				return true
			}
			await this.handleSaveResultConflict(saveResult)
			this.tryApplyPendingRemoteDesignData()
			return false
		}
		if (this.hasBlockingConflict()) {
			return false
		}
		const saveResult = await this.saveManager.manualSave(designData)
		if (saveResult.ok) {
			if (!this.isCurrentSaveResult(saveResult)) return false
			if (
				this.saveManager.wasLastSaveFullyPersisted() &&
				!this.hasUnresolvedMergeConflicts()
			) {
				this.clearLocalDraftAfterFullyPersistedSave(saveResult)
			}
			this.pendingRemoteDesignData = null
			return true
		}
		await this.handleSaveResultConflict(saveResult)
		this.tryApplyPendingRemoteDesignData()
		return false
	}

	syncDesignData(newDesignData: DesignData): void {
		if (this.isVersionDataSourceLocked() || this.hasBlockingConflict()) {
			return
		}
		this.saveManager.syncDesignData(newDesignData)
		this.setBaseDesignData(newDesignData)
		this.tryApplyPendingRemoteDesignData()
	}

	private applyPendingUpgradeFromLoad(loadResult: DesignLoadResult | undefined): void {
		if (!loadResult) return
		this.stateBag.setters.setDesignLoadIssue?.(loadResult.issue)
		this.stateBag.setters.setSidecarStatus?.(loadResult.sidecarStatus)
		this.stateBag.setters.setPendingDesignUpgrade?.(loadResult.pendingUpgrade)
		if (loadResult.pendingUpgrade) {
			void writePendingDesignUpgrade(this.getUpgradeIdentity(), loadResult.pendingUpgrade)
		}
	}

	private async completeRemoteLoad(
		load: () => Promise<boolean | DesignLoadResult>,
		restoreLocalDraft: boolean,
	): Promise<boolean> {
		this.stateBag.setters.setIsInitialLoading(true)
		const loadIdentity = this.loadManager.getCurrentLoadIdentity()
		const rawLoadResult = await load()
		const loadResult: DesignLoadResult =
			typeof rawLoadResult === "boolean"
				? (this.loadManager.getLastLoadResult() ?? {
						didLoad: rawLoadResult,
						pendingUpgrade: null,
						sidecarStatus: "missing",
					})
				: {
						didLoad: rawLoadResult.didLoad ?? true,
						pendingUpgrade: rawLoadResult.pendingUpgrade ?? null,
						issue: rawLoadResult.issue,
						sidecarStatus: rawLoadResult.sidecarStatus ?? "missing",
					}
		const isCurrentLoad = !loadIdentity || this.loadManager.isCurrentLoadIdentity(loadIdentity)
		if (!loadResult.didLoad || !isCurrentLoad) {
			// Keep the initial loading state while the attachment snapshot is not
			// trusted yet; the caller will retry after the next refresh.
			return false
		}

		this.syncBaseDesignDataFromCurrent()
		let draftLoadIssue: DesignLoadError["issue"] | undefined
		if (restoreLocalDraft) {
			try {
				await this.tryRestoreLocalDraftAfterRemoteLoad(loadIdentity)
			} catch (error) {
				if (error instanceof DesignLoadError) {
					draftLoadIssue = error.issue
				}
			}
		}
		if (loadIdentity && !this.loadManager.isCurrentLoadIdentity(loadIdentity)) {
			return false
		}

		this.applyPendingUpgradeFromLoad(loadResult)
		if (draftLoadIssue) this.stateBag.setters.setDesignLoadIssue?.(draftLoadIssue)
		await this.restoreStoredPendingUpgrade()
		this.stateBag.setters.setIsInitialLoading(false)
		return true
	}

	async loadFromRemote(): Promise<boolean> {
		this.clearPendingRemoteDesignData()
		return this.completeRemoteLoad(() => this.loadManager.loadFromRemote(), true)
	}

	async reloadPreservingLocalDraft(): Promise<boolean> {
		this.clearPendingRemoteDesignData()
		return this.completeRemoteLoad(() => this.loadManager.resetAndReload(), true)
	}

	async reloadCurrentVersion(): Promise<void> {
		const unlockVersionDataSource = this.lockVersionDataSource()
		try {
			this.clearPendingRemoteDesignData()
			this.saveManager.cancelAutoSave()
			await this.versionManager.reloadCurrentVersion()
		} finally {
			unlockVersionDataSource()
		}
	}

	async reloadDiscardingLocalDraft(): Promise<boolean> {
		this.clearPendingRemoteDesignData()
		this.clearLocalDraftBecauseVersionSwitched()
		return this.completeRemoteLoad(() => this.loadManager.resetAndReload(), false)
	}

	async persistPendingDesignUpgrade(): Promise<boolean> {
		const pendingUpgrade = this.stateBag.getPendingDesignUpgrade?.()
		if (!pendingUpgrade) return true
		if (pendingUpgrade.fileId !== this.stateBag.getMagicProjectJsFileId()) return false
		if (pendingUpgrade.targetVersion !== MAGIC_PROJECT_VERSION_V3) return false
		if (this.stateBag.getDesignData().version !== MAGIC_PROJECT_VERSION_V3) return false
		const baseAccessMode = getDesignBaseAccessMode(this.options)
		if (this.isVersionDataSourceLocked() || baseAccessMode !== "edit") return false
		if (this.getAccessMode() !== "edit" && pendingUpgrade.reason !== "sidecar-retry")
			return false
		if (this.hasBlockingConflict() || this.hasUnresolvedMergeConflicts()) return false

		this.saveManager.cancelAutoSave()
		this.stateBag.setters.setIsSaving(true)
		const saveResult = await this.saveManager.commitSave({
			designData: this.stateBag.getDesignData(),
			updateCurrentDesignData: true,
			source: "dsl-upgrade",
			...(pendingUpgrade.reason === "sidecar-retry" ? { allowReadOnlyRetry: true } : {}),
		})
		if (!saveResult.ok) {
			if (saveResult.reason === "unsupported-sidecar") {
				this.stateBag.setters.setDesignLoadIssue?.({
					kind: "unsupported-sidecar",
					stage: "hydrate-sidecar",
					message: "Unsupported element details sidecar structure",
					sourceVersion: pendingUpgrade.sourceVersion,
					fileId: pendingUpgrade.fileId,
				})
				this.stateBag.setters.setSidecarStatus?.("unsupported")
				this.stateBag.setters.setAccessMode("readonly")
			}
			await this.handleSaveResultConflict(saveResult)
			this.tryApplyPendingRemoteDesignData()
			return false
		}

		if (!saveResult.fullyPersisted) {
			const retry: PendingDesignUpgrade = {
				...pendingUpgrade,
				reason: "sidecar-retry",
				createdAt: Date.now(),
			}
			this.stateBag.setters.setPendingDesignUpgrade?.(retry)
			this.stateBag.setters.setDesignLoadIssue?.({
				kind: "sidecar-persist-failed",
				stage: "hydrate-sidecar",
				message: "Canvas was saved, but element details still require persistence",
				sourceVersion: retry.sourceVersion,
				fileId: retry.fileId,
			})
			this.stateBag.setters.setAccessMode("readonly")
			await writePendingDesignUpgrade(this.getUpgradeIdentity(), retry)
			return false
		}

		if (!this.isCurrentSaveResult(saveResult)) return false
		if (!this.hasUnresolvedMergeConflicts()) {
			this.clearLocalDraftAfterFullyPersistedSave(saveResult)
		}
		this.pendingRemoteDesignData = null
		this.stateBag.setters.setPendingDesignUpgrade?.(null)
		this.stateBag.setters.setDesignLoadIssue?.(undefined)
		await clearPendingDesignUpgrade(this.getUpgradeIdentity())
		this.stateBag.setters.setAccessMode(getDesignBaseAccessMode(this.options))
		return true
	}

	async saveToRemote(): Promise<void> {
		if (this.isVersionDataSourceLocked()) return
		if (this.getAccessMode() !== "edit") return
		if (this.hasUnresolvedConnectionConflicts()) {
			this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
			return
		}
		if (this.hasUnresolvedElementConflicts()) {
			const remoteSaveData = this.getRemoteSaveDataForCurrentElementConflicts()
			if (!remoteSaveData) {
				this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
				return
			}
			this.persistLocalDraft(this.stateBag.getDesignData(), { immediate: true })
			this.stateBag.setters.setIsSaving(true)
			const saveResult = await this.saveManager.commitSave({
				designData: remoteSaveData,
				updateCurrentDesignData: false,
				source: "conflict-resolution",
			})
			if (saveResult.ok) {
				if (!this.isCurrentSaveResult(saveResult)) return
				this.pendingRemoteDesignData = null
				return
			}
			await this.handleSaveResultConflict(saveResult)
			this.tryApplyPendingRemoteDesignData()
			return
		}
		if (this.hasBlockingConflict()) {
			return
		}
		this.stateBag.setters.setIsSaving(true)
		const saveResult = await this.saveManager.commitSave({ source: "manual-save" })
		if (saveResult.ok) {
			if (!this.isCurrentSaveResult(saveResult)) return
			if (
				this.saveManager.wasLastSaveFullyPersisted() &&
				!this.hasUnresolvedMergeConflicts()
			) {
				this.clearLocalDraftAfterFullyPersistedSave(saveResult)
			}
			this.pendingRemoteDesignData = null
			return
		}
		await this.handleSaveResultConflict(saveResult)
		this.tryApplyPendingRemoteDesignData()
	}

	generateContent(data?: DesignData): string {
		return this.saveManager.generateContent(data)
	}

	loadWithVersion(version: number): Promise<DesignData | null> {
		return this.versionManager.loadWithVersion(version)
	}

	loadLatest(): Promise<DesignCurrentFileLoadResult> {
		return this.versionManager.loadLatest()
	}

	checkRemoteUpdate(): Promise<{
		hasUpdate: boolean
		currentFingerprint: string | null
		isCheckReliable: boolean
	}> {
		return this.saveManager.checkRemoteUpdate()
	}

	get isNewestVersion(): boolean {
		return this.getFileVersion() === undefined
	}

	async handleChangeFileVersion(version: number, isNewestVersion: boolean): Promise<void> {
		const unlockVersionDataSource = this.lockVersionDataSource()
		try {
			this.clearPendingRemoteDesignData()
			this.clearLocalDraftBecauseVersionSwitched()
			this.saveManager.cancelAutoSave()
			const didApply = await this.versionManager.handleChangeFileVersion(
				version,
				isNewestVersion,
			)
			if (didApply && this.getFileVersion() === undefined)
				this.syncBaseDesignDataFromCurrent()
			if (isNewestVersion) await this.restoreStoredPendingUpgrade()
		} finally {
			unlockVersionDataSource()
		}
	}

	async handleReturnLatest(): Promise<void> {
		const unlockVersionDataSource = this.lockVersionDataSource()
		try {
			this.clearPendingRemoteDesignData()
			this.clearLocalDraftBecauseVersionSwitched()
			this.saveManager.cancelAutoSave()
			const didApply = await this.versionManager.handleReturnLatest()
			if (didApply) this.syncBaseDesignDataFromCurrent()
		} finally {
			unlockVersionDataSource()
		}
	}

	async handleVersionRollback(version?: number): Promise<void> {
		const unlockVersionDataSource = this.lockVersionDataSource()
		try {
			this.clearPendingRemoteDesignData()
			this.clearLocalDraftBecauseVersionSwitched()
			this.saveManager.cancelAutoSave()
			const didApply = await this.versionManager.handleVersionRollback(version)
			if (didApply) this.syncBaseDesignDataFromCurrent()
		} finally {
			unlockVersionDataSource()
		}
	}

	fetchFileVersions(): Promise<FileHistoryVersion[]> {
		return this.versionManager.fetchFileVersions()
	}

	setAccessMode(value: CanvasAccessMode): void {
		this.stateBag.setters.setAccessMode(value)
	}

	private resolveElementConflicts(options: {
		elementIds: string[]
		resolution: "use-local" | "use-remote"
		nextDesignData?: DesignData
		trigger: "user-edit" | "explicit-local" | "explicit-remote"
	}): boolean {
		const conflict = this.stateBag.getConflictState()
		if (!conflict?.elementConflicts?.length) return false

		const targetElementIds = new Set(options.elementIds)
		const resolvedAt = Date.now()
		let didResolve = false
		const elementConflicts = conflict.elementConflicts.map((elementConflict) => {
			if (
				elementConflict.status !== "unresolved" ||
				!targetElementIds.has(elementConflict.elementId)
			) {
				return elementConflict
			}

			didResolve = true
			return {
				...elementConflict,
				status: "resolved" as const,
				resolution: options.resolution,
				resolvedAt,
			}
		})

		if (!didResolve) return false

		const unresolvedElementIds = elementConflicts
			.filter(({ status }) => status === "unresolved")
			.map(({ elementId }) => elementId)
		const currentData = options.nextDesignData ?? this.stateBag.getDesignData()
		const nextLocalData = this.buildLocalDataFromMergeConflicts(currentData, {
			elementConflicts,
			connectionConflicts: conflict.connectionConflicts,
		})
		const nextConflict: DesignConflict = {
			...conflict,
			elementConflicts,
			localData: cloneDeep(nextLocalData) as DesignData,
			mergedData: options.nextDesignData
				? (cloneDeep(options.nextDesignData) as DesignData)
				: conflict.mergedData,
			localFingerprint: hashDesignDataComparable(nextLocalData),
		}

		if (unresolvedElementIds.length > 0 || this.hasUnresolvedMergeConflicts(nextConflict)) {
			this.setConflictState(nextConflict)
			this.writeConflictLocalDraftNow(nextConflict, nextLocalData)
			return true
		}

		this.clearConflictState()
		if (
			hashDesignDataComparable(currentData) === this.stateBag.getPrevDesignDataFingerprint()
		) {
			this.clearLocalDraftBecauseAlreadySynced()
		} else {
			this.persistLocalDraft(currentData)
		}
		return true
	}

	private tryAutoMergeSingleElementConflict(
		elementConflict: DesignElementConflict,
		resolution: "use-local" | "use-remote",
	): boolean {
		if (
			elementConflict.reason !== "same-element-changed" ||
			!elementConflict.baseElement ||
			!elementConflict.localElement ||
			!elementConflict.remoteElement ||
			elementConflict.baseParentId !== elementConflict.localParentId ||
			elementConflict.baseParentId !== elementConflict.remoteParentId
		) {
			return false
		}

		const mergedElement = tryMergeCanvasElementsByField(
			elementConflict.baseElement,
			elementConflict.localElement,
			elementConflict.remoteElement,
		)
		if (!mergedElement) return false

		const oldData = this.stateBag.getDesignData()
		const patchResult = tryApplyCanvasDocumentPatch(
			oldData.canvas,
			{
				upserts: [
					{
						element: mergedElement,
						parentId: elementConflict.remoteParentId,
					},
				],
				deletedElementIds: [],
				changedElementIds: [elementConflict.elementId],
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) return false

		const nextData: DesignData = {
			...oldData,
			canvas: patchResult.canvas,
		}
		this.stateBag.setters.setDesignData(nextData)
		this.options.onRemoteDesignDataUpdate?.(oldData, nextData, "draft")
		const didResolve = this.resolveElementConflicts({
			elementIds: [elementConflict.elementId],
			resolution,
			nextDesignData: nextData,
			trigger: "user-edit",
		})
		if (didResolve) {
			this.scheduleAutoSave({ source: "conflict-resolution" })
		}
		return didResolve
	}

	clearConflictState(): void {
		this.conflictState = null
		this.stateBag.setters.setConflictState(null)
	}

	resolveBlockingConflictWithRemote(): boolean {
		const conflict = this.stateBag.getConflictState()
		if (
			conflict &&
			this.hasUnresolvedConnectionConflicts(conflict) &&
			!this.hasUnresolvedElementConflicts(conflict)
		) {
			return this.resolveAllConnectionConflictsWithRemote()
		}
		if (!conflict || this.hasUnresolvedMergeConflicts(conflict)) return false

		const pending = this.pendingRemoteDesignData
		const remoteData = cloneDeep(pending?.data ?? conflict.remoteData) as DesignData
		const updateType = pending?.updateType ?? "message"
		const applied = this.applyRemoteDesignDataNow(remoteData, updateType)
		if (!applied) return false

		this.clearLocalDraftBecauseRemoteAccepted()
		return true
	}

	async resolveBlockingConflictWithLocal(): Promise<boolean> {
		const conflict = this.stateBag.getConflictState()
		if (
			conflict &&
			this.hasUnresolvedConnectionConflicts(conflict) &&
			!this.hasUnresolvedElementConflicts(conflict)
		) {
			return this.resolveAllConnectionConflictsWithLocal()
		}
		if (!conflict || this.hasUnresolvedMergeConflicts(conflict)) return false

		const localData = cloneDeep(conflict.localData) as DesignData
		const oldData = this.stateBag.getDesignData()
		this.saveManager.cancelAutoSave()
		this.stateBag.setters.setDesignData(localData)
		this.options.onRemoteDesignDataUpdate?.(oldData, localData, "draft")
		this.persistLocalDraft(localData, { immediate: true })

		this.stateBag.setters.setIsSaving(true)
		const saveResult = await this.saveManager.commitSave({
			allowRemoteConflict: true,
			designData: localData,
			updateCurrentDesignData: true,
			source: "conflict-resolution",
		})
		if (saveResult.ok) {
			if (!this.isCurrentSaveResult(saveResult)) return false
			this.pendingRemoteDesignData = null
			this.saveManager.clearRemoteConflict()
			if (!saveResult.fullyPersisted) {
				this.clearConflictState()
			}
			if (
				this.saveManager.wasLastSaveFullyPersisted() &&
				!this.hasUnresolvedMergeConflicts()
			) {
				this.clearLocalDraftAfterFullyPersistedSave(saveResult)
			}
			return true
		}

		return false
	}

	private resolveConnectionConflicts(options: {
		connectionIds: string[]
		resolution: "use-local" | "use-remote"
		nextDesignData?: DesignData
	}): boolean {
		const conflict = this.stateBag.getConflictState()
		if (!conflict?.connectionConflicts?.length) return false

		const targetConnectionIds = new Set(options.connectionIds)
		const resolvedAt = Date.now()
		let didResolve = false
		const connectionConflicts = conflict.connectionConflicts.map((connectionConflict) => {
			if (
				connectionConflict.status !== "unresolved" ||
				!targetConnectionIds.has(connectionConflict.connectionId)
			) {
				return connectionConflict
			}

			didResolve = true
			return {
				...connectionConflict,
				status: "resolved" as const,
				resolution: options.resolution,
				resolvedAt,
			}
		})

		if (!didResolve) return false

		const currentData = options.nextDesignData ?? this.stateBag.getDesignData()
		const nextLocalData = this.buildLocalDataFromMergeConflicts(currentData, {
			elementConflicts: conflict.elementConflicts,
			connectionConflicts,
		})
		const nextConflict: DesignConflict = {
			...conflict,
			connectionConflicts,
			localData: cloneDeep(nextLocalData) as DesignData,
			mergedData: options.nextDesignData
				? (cloneDeep(options.nextDesignData) as DesignData)
				: conflict.mergedData,
			localFingerprint: hashDesignDataComparable(nextLocalData),
		}

		if (this.hasUnresolvedMergeConflicts(nextConflict)) {
			this.setConflictState(nextConflict)
			this.writeConflictLocalDraftNow(nextConflict, nextLocalData)
			return true
		}

		this.clearConflictState()
		if (
			hashDesignDataComparable(currentData) === this.stateBag.getPrevDesignDataFingerprint()
		) {
			this.clearLocalDraftBecauseAlreadySynced()
		} else {
			this.persistLocalDraft(currentData)
		}
		return true
	}

	resolveElementConflictWithLocal(elementId: string): boolean {
		const conflict = this.stateBag.getConflictState()
		const elementConflict = conflict?.elementConflicts?.find(
			(item) => item.elementId === elementId && item.status === "unresolved",
		)
		if (!conflict || !elementConflict) return false
		if (this.tryAutoMergeSingleElementConflict(elementConflict, "use-local")) {
			return true
		}

		const oldData = this.stateBag.getDesignData()
		const patchResult = tryApplyCanvasDocumentPatch(
			oldData.canvas,
			{
				upserts: elementConflict.localElement
					? [
							{
								element: cloneDeep(elementConflict.localElement),
								parentId: elementConflict.localParentId,
							},
						]
					: [],
				deletedElementIds: elementConflict.localElement ? [] : [elementId],
				changedElementIds: [elementId],
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) {
			return false
		}
		const nextData: DesignData = {
			...oldData,
			canvas: patchResult.canvas,
		}

		this.stateBag.setters.setDesignData(nextData)
		this.options.onRemoteDesignDataUpdate?.(oldData, nextData, "draft")
		const didResolve = this.resolveElementConflicts({
			elementIds: [elementId],
			resolution: "use-local",
			nextDesignData: nextData,
			trigger: "explicit-local",
		})
		if (didResolve) {
			this.scheduleAutoSave({ source: "conflict-resolution" })
		}
		return didResolve
	}

	resolveElementConflictWithRemote(elementId: string): boolean {
		const conflict = this.stateBag.getConflictState()
		const elementConflict = conflict?.elementConflicts?.find(
			(item) => item.elementId === elementId && item.status === "unresolved",
		)
		if (!conflict || !elementConflict) return false
		if (this.tryAutoMergeSingleElementConflict(elementConflict, "use-remote")) {
			return true
		}

		const oldData = this.stateBag.getDesignData()
		const patchResult = tryApplyCanvasDocumentPatch(
			oldData.canvas,
			{
				upserts: elementConflict.remoteElement
					? [
							{
								element: cloneDeep(elementConflict.remoteElement),
								parentId: elementConflict.remoteParentId,
							},
						]
					: [],
				deletedElementIds: elementConflict.remoteElement ? [] : [elementId],
				changedElementIds: [elementId],
			},
			{ strictParent: true },
		)
		if (!patchResult.ok) {
			return false
		}
		const nextData: DesignData = {
			...oldData,
			canvas: patchResult.canvas,
		}

		this.stateBag.setters.setDesignData(nextData)
		this.options.onRemoteDesignDataUpdate?.(oldData, nextData, "draft")
		const didResolve = this.resolveElementConflicts({
			elementIds: [elementId],
			resolution: "use-remote",
			nextDesignData: nextData,
			trigger: "explicit-remote",
		})
		if (
			didResolve &&
			hashDesignDataComparable(nextData) !== this.stateBag.getPrevDesignDataFingerprint()
		) {
			this.scheduleAutoSave({ source: "conflict-resolution" })
		}
		return didResolve
	}

	resolveConnectionConflictWithLocal(connectionId: string): boolean {
		return this.resolveSingleConnectionConflict(connectionId, "use-local")
	}

	resolveConnectionConflictWithRemote(connectionId: string): boolean {
		return this.resolveSingleConnectionConflict(connectionId, "use-remote")
	}

	private resolveSingleConnectionConflict(
		connectionId: string,
		resolution: "use-local" | "use-remote",
	): boolean {
		const conflict = this.stateBag.getConflictState()
		const connectionConflict = conflict?.connectionConflicts?.find(
			(item) => item.connectionId === connectionId && item.status === "unresolved",
		)
		if (!conflict || !connectionConflict) return false

		const oldData = this.stateBag.getDesignData()
		const nextData = this.applyConnectionConflictResolutionToData(
			oldData,
			[connectionConflict],
			resolution,
		)
		if (!nextData) return false

		this.stateBag.setters.setDesignData(nextData)
		this.options.onRemoteDesignDataUpdate?.(oldData, nextData, "draft")
		const didResolve = this.resolveConnectionConflicts({
			connectionIds: [connectionId],
			resolution,
			nextDesignData: nextData,
		})
		if (
			didResolve &&
			hashDesignDataComparable(nextData) !== this.stateBag.getPrevDesignDataFingerprint()
		) {
			this.scheduleAutoSave({ source: "conflict-resolution" })
		}
		return didResolve
	}

	private resolveAllConnectionConflictsWithRemote(): boolean {
		const conflict = this.stateBag.getConflictState()
		const unresolvedConnectionIds = this.getUnresolvedConnectionConflictIds(conflict)
		if (!conflict || unresolvedConnectionIds.length === 0) return false

		const unresolvedConnectionConflicts = (conflict.connectionConflicts ?? []).filter(
			({ connectionId, status }) =>
				status === "unresolved" && unresolvedConnectionIds.includes(connectionId),
		)
		const oldData = this.stateBag.getDesignData()
		const nextData = this.applyConnectionConflictResolutionToData(
			oldData,
			unresolvedConnectionConflicts,
			"use-remote",
		)
		if (!nextData) return false

		this.stateBag.setters.setDesignData(nextData)
		this.options.onRemoteDesignDataUpdate?.(oldData, nextData, "draft")
		const didResolve = this.resolveConnectionConflicts({
			connectionIds: unresolvedConnectionIds,
			resolution: "use-remote",
			nextDesignData: nextData,
		})
		if (
			didResolve &&
			hashDesignDataComparable(nextData) !== this.stateBag.getPrevDesignDataFingerprint()
		) {
			this.scheduleAutoSave({ source: "conflict-resolution" })
		}
		return didResolve
	}

	private async resolveAllConnectionConflictsWithLocal(): Promise<boolean> {
		const conflict = this.stateBag.getConflictState()
		const unresolvedConnectionIds = this.getUnresolvedConnectionConflictIds(conflict)
		if (!conflict || unresolvedConnectionIds.length === 0) return false

		const localData = cloneDeep(conflict.localData) as DesignData
		const oldData = this.stateBag.getDesignData()
		this.saveManager.cancelAutoSave()
		this.stateBag.setters.setDesignData(localData)
		this.options.onRemoteDesignDataUpdate?.(oldData, localData, "draft")
		const didResolve = this.resolveConnectionConflicts({
			connectionIds: unresolvedConnectionIds,
			resolution: "use-local",
			nextDesignData: localData,
		})
		if (!didResolve) return false

		this.persistLocalDraft(localData, { immediate: true })
		this.stateBag.setters.setIsSaving(true)
		const saveResult = await this.saveManager.commitSave({
			allowRemoteConflict: true,
			designData: localData,
			updateCurrentDesignData: true,
			source: "conflict-resolution",
		})
		if (saveResult.ok) {
			if (!this.isCurrentSaveResult(saveResult)) return false
			this.pendingRemoteDesignData = null
			this.saveManager.clearRemoteConflict()
			if (!saveResult.fullyPersisted) {
				this.clearConflictState()
			}
			if (
				this.saveManager.wasLastSaveFullyPersisted() &&
				!this.hasUnresolvedMergeConflicts()
			) {
				this.clearLocalDraftAfterFullyPersistedSave(saveResult)
			}
			return true
		}

		this.setConflictState(conflict)
		this.writeConflictLocalDraftNow(conflict, localData)
		return false
	}

	resolveEditedElementConflictsWithLocal(
		elementIds: string[],
		nextDesignData: DesignData,
		metadata?: DesignSaveMetadata,
	): boolean {
		if (!elementIds.length) return false
		const didResolve = this.resolveElementConflicts({
			elementIds,
			resolution: "use-local",
			nextDesignData,
			trigger: "user-edit",
		})
		if (didResolve) {
			this.scheduleAutoSave({
				...metadata,
				source: metadata?.source ?? "canvas-patch",
			})
		}
		return didResolve
	}

	getRemoteListener(): DesignRemoteListener | null {
		return this.remoteListener
	}
}

function noopDesignDataUpdater(
	_updater: (draft: DesignData) => void,
	_metadata?: DesignSaveMetadata,
): void {
	void _updater
	void _metadata
}
