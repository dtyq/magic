import { cloneDeep } from "lodash-es"
import type { DesignData } from "../types"
import {
	generateMagicProjectJsContent,
	resolveDesignDirectoryNameFromAttachments,
	resolveDesignProjectBasePathFromAttachments,
} from "../utils/utils"
import { hashDesignDataComparable } from "../utils/designContentHash"
import {
	getElementDetailsSidecarStatus,
	getHydratedElementDetailsProvenance,
	writeUserElementDetails,
} from "../utils/elementDetailsIo"
import { isContentProjectVersion } from "../utils/magicProjectCompression"
import { SuperMagicApi } from "@/apis"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import {
	type DesignProjectStateBag,
	type DesignProjectManagerOptions,
	type DesignCurrentFileLoadResult,
	getDesignRequestIdentity,
} from "./types"

const AUTO_SAVE_DEBOUNCE_MS = 3000

function getTopLevelElementCount(data: DesignData | null | undefined): number {
	return data?.canvas?.elements?.length ?? 0
}

function normalizeElementIds(ids?: string[]): string[] {
	return ids?.length ? Array.from(new Set(ids)) : []
}

interface DesignCommitSaveOptions {
	allowRemoteConflict?: boolean
	allowReadOnlyRetry?: boolean
	designData?: DesignData
	updateCurrentDesignData?: boolean
	source?: DesignSaveSource
	deletedElementIds?: string[]
	beforeElementCount?: number
	nextElementCount?: number
	isRemoteApplying?: boolean
	fromDraft?: boolean
}

export interface RemoteUpdateCheckResult {
	hasUpdate: boolean
	currentFingerprint: string | null
	currentFile?: DesignCurrentFileLoadResult
	isCheckReliable: boolean
}

export type DesignSaveFailureReason =
	| "readonly"
	| "no-file"
	| "remote-conflict"
	| "remote-updated"
	| "remote-check-unreliable"
	| "empty-content"
	| "unsafe-empty-canvas"
	| "unsupported-sidecar"
	| "sidecar-persist-failed"
	| "error"

export type DesignSaveSource =
	| "canvas-patch"
	| "canvas-full-export"
	| "draft-restore"
	| "manual-refresh-draft"
	| "version-switch"
	| "remote-apply"
	| "remote-merge"
	| "conflict-resolution"
	| "dsl-upgrade"
	| "manual-save"
	| "unknown-auto"

export interface DesignSaveMetadata {
	source?: DesignSaveSource
	deletedElementIds?: string[]
	beforeElementCount?: number
	nextElementCount?: number
	isRemoteApplying?: boolean
	fromDraft?: boolean
}

export interface DesignSaveContext {
	designData: DesignData
	source: DesignSaveSource
	beforeElementCount: number
	nextElementCount: number
	deletedElementIds: string[]
	isRemoteApplying: boolean
	fromDraft: boolean
}

export type DesignSaveResult =
	| {
			ok: true
			fileId: string
			accessIdentity: string
			baseFingerprint: string
			savedUpdatedAt: string | null
			fullyPersisted: boolean
			savedDesignData: DesignData
			savedFingerprint: string
	  }
	| {
			ok: false
			reason: DesignSaveFailureReason
			currentFile?: DesignCurrentFileLoadResult
			isCheckReliable?: boolean
			error?: string
	  }

export interface DesignSaveLifecycleHandlers {
	onSaveStart?: () => number | null
	onSaveCommitted?: (result: Extract<DesignSaveResult, { ok: true }>) => Promise<void> | void
	onSaveEnd?: (
		saveToken: number | null | undefined,
		didSave: boolean,
		savedUpdatedAt?: string | null,
	) => Promise<void> | void
	onAutoSaveResult?: (result: DesignSaveResult) => Promise<void> | void
	shouldBlockEmptyCanvasSave?: (context: DesignSaveContext) => boolean
}

export class DesignSaveManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private fetchAndSetVersions: () => Promise<FileHistoryVersion[]>
	private saveLifecycleHandlers: DesignSaveLifecycleHandlers

	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private pendingAutoSaveBaseFingerprint: string | null = null
	private pendingAutoSaveDesignData: DesignData | null = null
	private pendingAutoSaveMetadata: DesignSaveMetadata | null = null
	private hasRemoteConflictPending = false
	private lastSaveFullyPersisted = false
	private saveQueue: Promise<void> = Promise.resolve()
	private pendingSaveCount = 0

	constructor(
		stateBag: DesignProjectStateBag,
		options: DesignProjectManagerOptions,
		fetchAndSetVersions: () => Promise<FileHistoryVersion[]>,
		private readCurrentFile: (
			fileId: string,
			options: DesignProjectManagerOptions,
		) => Promise<DesignCurrentFileLoadResult>,
		saveLifecycleHandlers: DesignSaveLifecycleHandlers = {},
	) {
		this.stateBag = stateBag
		this.options = options
		this.fetchAndSetVersions = fetchAndSetVersions
		this.saveLifecycleHandlers = saveLifecycleHandlers
	}

	updateOptions(options: DesignProjectManagerOptions) {
		this.options = options
	}

	updateFetchAndSetVersions(fn: () => Promise<FileHistoryVersion[]>) {
		this.fetchAndSetVersions = fn
	}

	private getProjectBasePathForDsl(): string | undefined {
		return resolveDesignProjectBasePathFromAttachments(this.options)
	}

	private getDesignDataForSave(
		designData: DesignData = this.stateBag.getDesignData(),
		requestOptions: DesignProjectManagerOptions = this.options,
	): DesignData {
		const directoryName = resolveDesignDirectoryNameFromAttachments(requestOptions)
		if (!directoryName || directoryName === designData.name) {
			return designData
		}
		return {
			...designData,
			name: directoryName,
		}
	}

	private normalizeSaveMetadata(metadata?: DesignSaveMetadata): DesignSaveMetadata | null {
		if (!metadata) return null
		return {
			...metadata,
			deletedElementIds: normalizeElementIds(metadata.deletedElementIds),
		}
	}

	scheduleAutoSave(designData?: DesignData, metadata?: DesignSaveMetadata): void {
		this.pendingAutoSaveBaseFingerprint = designData
			? this.stateBag.getPrevDesignDataFingerprint()
			: null
		this.pendingAutoSaveDesignData = designData ? (cloneDeep(designData) as DesignData) : null
		this.pendingAutoSaveMetadata = this.normalizeSaveMetadata(metadata)
		this.runDebouncedSave()
	}

	cancelAutoSave(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		this.pendingAutoSaveBaseFingerprint = null
		this.pendingAutoSaveDesignData = null
		this.pendingAutoSaveMetadata = null
		this.stateBag.setters.setIsSaving(false)
	}

	async manualSave(designData?: DesignData): Promise<DesignSaveResult> {
		this.cancelAutoSave()
		this.stateBag.setters.setIsSaving(true)
		return this.commitSave({
			allowRemoteConflict: true,
			designData,
			source: "manual-save",
		})
	}

	syncDesignData(newDesignData: DesignData): void {
		this.stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(newDesignData))
		this.clearRemoteConflict()
	}

	hasPendingAutoSave(): boolean {
		return this.debounceTimer !== null || this.pendingSaveCount > 0
	}

	isLocalDirty(): boolean {
		const prevFingerprint = this.stateBag.getPrevDesignDataFingerprint()
		if (!prevFingerprint) return false
		const currentData = this.getDesignDataForSave()
		return hashDesignDataComparable(currentData) !== prevFingerprint
	}

	hasRemoteConflict(): boolean {
		return this.hasRemoteConflictPending
	}

	markRemoteConflict(): void {
		this.hasRemoteConflictPending = true
	}

	clearRemoteConflict(): void {
		this.hasRemoteConflictPending = false
	}

	wasLastSaveFullyPersisted(): boolean {
		return this.lastSaveFullyPersisted
	}

	private runDebouncedSave(): void {
		const fileId = this.stateBag.getMagicProjectJsFileId()
		if (!fileId) {
			return
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}

		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null
			const explicitBase = this.pendingAutoSaveBaseFingerprint
			this.pendingAutoSaveBaseFingerprint = null
			const explicitSaveData = this.pendingAutoSaveDesignData
			const metadata = this.pendingAutoSaveMetadata
			this.pendingAutoSaveDesignData = null
			this.pendingAutoSaveMetadata = null
			const currentData = explicitSaveData ?? this.stateBag.getDesignData()
			const designDataToSave = this.getDesignDataForSave(currentData)
			const fp = hashDesignDataComparable(designDataToSave)
			const prevFp = this.stateBag.getPrevDesignDataFingerprint()

			if (explicitSaveData && explicitBase !== prevFp) {
				void this.saveLifecycleHandlers.onAutoSaveResult?.({
					ok: false,
					reason: "remote-updated",
				})
				return
			}
			if (!prevFp) {
				return
			}
			if (prevFp === fp) {
				this.stateBag.setters.setIsSaving(false)
				return
			}

			this.stateBag.setters.setIsSaving(true)
			void this.commitSave({
				designData: explicitSaveData ?? undefined,
				updateCurrentDesignData: !explicitSaveData,
				source: metadata?.source,
				deletedElementIds: metadata?.deletedElementIds,
				beforeElementCount: metadata?.beforeElementCount,
				nextElementCount: metadata?.nextElementCount,
				isRemoteApplying: metadata?.isRemoteApplying,
				fromDraft: metadata?.fromDraft,
			}).then((result) => this.saveLifecycleHandlers.onAutoSaveResult?.(result))
		}, AUTO_SAVE_DEBOUNCE_MS)
	}

	private buildSaveContext(
		designDataToSave: DesignData,
		source: DesignSaveSource,
		options?: DesignSaveMetadata,
	): DesignSaveContext {
		const deletedElementIds = normalizeElementIds(options?.deletedElementIds)
		const beforeElementCount =
			options?.beforeElementCount ?? getTopLevelElementCount(this.stateBag.getDesignData())
		const nextElementCount =
			options?.nextElementCount ?? getTopLevelElementCount(designDataToSave)

		return {
			designData: designDataToSave,
			source,
			beforeElementCount,
			nextElementCount,
			deletedElementIds,
			isRemoteApplying: options?.isRemoteApplying ?? false,
			fromDraft: options?.fromDraft ?? source === "draft-restore",
		}
	}

	commitSave(options?: DesignCommitSaveOptions): Promise<DesignSaveResult> {
		const requestOptions = this.options
		const fileId = this.stateBag.getMagicProjectJsFileId()
		const accessIdentity = getDesignRequestIdentity(requestOptions)
		const requestAccessMode = this.stateBag.getAccessMode()
		const explicitData = options?.designData ? cloneDeep(options.designData) : undefined
		const explicitBase = this.stateBag.getPrevDesignDataFingerprint()
		this.pendingSaveCount += 1
		const result = this.saveQueue.then(() => {
			if (
				fileId !== this.stateBag.getMagicProjectJsFileId() ||
				accessIdentity !== getDesignRequestIdentity(this.options) ||
				requestAccessMode !== this.stateBag.getAccessMode()
			)
				return { ok: false, reason: "no-file" } as DesignSaveResult
			const baseFingerprint = this.stateBag.getPrevDesignDataFingerprint()
			if (explicitData && explicitBase !== baseFingerprint)
				return { ok: false, reason: "remote-updated" } as DesignSaveResult
			// 排队时不冻结普通保存的旧正文；开始执行后载荷与基准保持不变。
			const capturedOptions = {
				...options,
				designData: cloneDeep(explicitData ?? this.stateBag.getDesignData()),
			}
			return this.commitSaveInternal(
				capturedOptions,
				requestOptions,
				requestAccessMode,
				baseFingerprint,
			)
		})
		const completed = result.finally(() => {
			this.pendingSaveCount -= 1
			if (
				fileId === this.stateBag.getMagicProjectJsFileId() &&
				accessIdentity === getDesignRequestIdentity(this.options)
			)
				this.stateBag.setters.setIsSaving(this.pendingSaveCount > 0)
		})
		this.saveQueue = completed.then(
			() => undefined,
			() => undefined,
		)
		return completed
	}

	private async commitSaveInternal(
		options: DesignCommitSaveOptions,
		requestOptions: DesignProjectManagerOptions,
		requestAccessMode: ReturnType<DesignProjectStateBag["getAccessMode"]>,
		baseFingerprint: string,
	): Promise<DesignSaveResult> {
		this.lastSaveFullyPersisted = false
		if (this.stateBag.getAccessMode() !== "edit" && !options?.allowReadOnlyRetry) {
			this.stateBag.setters.setIsSaving(false)
			return { ok: false, reason: "readonly" }
		}
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) {
			this.stateBag.setters.setIsSaving(false)
			return { ok: false, reason: "no-file" }
		}
		if (this.hasRemoteConflict() && !options?.allowRemoteConflict) {
			this.stateBag.setters.setIsSaving(false)
			return { ok: false, reason: "remote-conflict" }
		}

		const provenance = cloneDeep(
			this.stateBag.getElementDetailsProvenance?.() ??
				getHydratedElementDetailsProvenance(
					options.designData ?? this.stateBag.getDesignData(),
				),
		)
		const isCurrentRequest = () =>
			magicProjectJsFileId === this.stateBag.getMagicProjectJsFileId() &&
			getDesignRequestIdentity(requestOptions) === getDesignRequestIdentity(this.options) &&
			requestAccessMode === this.stateBag.getAccessMode()
		let saveToken: number | null | undefined
		let didSave = false
		let savedUpdatedAt: string | null = null
		try {
			saveToken = this.saveLifecycleHandlers.onSaveStart?.()
			const check = await this.checkRemoteUpdate(requestOptions, baseFingerprint)
			if (!isCurrentRequest()) return { ok: false, reason: "no-file" }
			if (!check.isCheckReliable)
				return { ok: false, reason: "remote-check-unreliable", isCheckReliable: false }
			if (
				check.hasUpdate ||
				this.stateBag.getPrevDesignDataFingerprint() !== baseFingerprint
			) {
				this.markRemoteConflict()
				return {
					ok: false,
					reason: "remote-updated",
					currentFile: check.currentFile,
					isCheckReliable: true,
				}
			}

			const currentDesignData = options?.designData ?? this.stateBag.getDesignData()
			const designDataToSave = this.getDesignDataForSave(currentDesignData, requestOptions)
			const saveSource = options?.source ?? "unknown-auto"
			const saveContext = this.buildSaveContext(designDataToSave, saveSource, options)
			if (this.saveLifecycleHandlers.shouldBlockEmptyCanvasSave?.(saveContext)) {
				this.stateBag.setters.setIsSaving(false)
				return { ok: false, reason: "unsafe-empty-canvas" }
			}
			const fp = hashDesignDataComparable(designDataToSave)
			const content = generateMagicProjectJsContent(designDataToSave, {
				projectBasePath: resolveDesignProjectBasePathFromAttachments(requestOptions),
				flatAttachments: requestOptions.flatAttachments,
				attachmentIndex: requestOptions.attachmentIndex,
			})
			if (!content?.trim()) {
				this.stateBag.setters.setIsSaving(false)
				return { ok: false, reason: "empty-content" }
			}

			const sidecarContext = {
				attachments: requestOptions.attachments,
				flatAttachments: requestOptions.flatAttachments,
				mainFileId: magicProjectJsFileId,
				projectId: requestOptions.projectId,
				fileApi: requestOptions.fileApi,
			}
			if (isContentProjectVersion(designDataToSave.version)) {
				const sidecarStatus = await getElementDetailsSidecarStatus(sidecarContext)
				if (sidecarStatus === "unsupported") {
					this.stateBag.setters.setIsSaving(false)
					return { ok: false, reason: "unsupported-sidecar" }
				}
			}

			if (!isCurrentRequest()) return { ok: false, reason: "no-file" }
			const saveResponse = await SuperMagicApi.saveFileContent([
				{ file_id: magicProjectJsFileId, content, enable_shadow: true },
			])
			const savedFile = saveResponse.success_files?.find(
				(file) => file.file_id === magicProjectJsFileId,
			)
			if (!savedFile)
				return {
					ok: false,
					reason: "error",
					error:
						saveResponse.error_files?.find(
							(file) => file.file_id === magicProjectJsFileId,
						)?.error ?? "Canvas file was not saved",
				}
			didSave = true
			savedUpdatedAt = savedFile.data.updated_at ?? null

			// v3：主文件保存成功后只写用户 sidecar，不触碰 element-details.json
			let didPersistDetails = true
			if (isContentProjectVersion(designDataToSave.version)) {
				const sidecarResult = await writeUserElementDetails(
					designDataToSave,
					sidecarContext,
					provenance,
				)
				didPersistDetails =
					sidecarResult === "persisted" ||
					sidecarResult === "unchanged" ||
					sidecarResult === "skipped"
			}
			const requestIsCurrent = isCurrentRequest()
			if (
				requestIsCurrent &&
				this.stateBag.getPrevDesignDataFingerprint() === baseFingerprint
			) {
				if (
					(options.updateCurrentDesignData ?? true) &&
					hashDesignDataComparable(this.stateBag.getDesignData()) ===
						hashDesignDataComparable(currentDesignData)
				)
					this.stateBag.setters.setDesignData(designDataToSave)
			}
			const result: Extract<DesignSaveResult, { ok: true }> = {
				ok: true,
				fileId: magicProjectJsFileId,
				accessIdentity: getDesignRequestIdentity(requestOptions),
				baseFingerprint,
				savedUpdatedAt,
				fullyPersisted: didPersistDetails,
				savedDesignData: designDataToSave,
				savedFingerprint: fp,
			}
			if (requestIsCurrent) await this.saveLifecycleHandlers.onSaveCommitted?.(result)
			this.lastSaveFullyPersisted =
				didPersistDetails &&
				isCurrentRequest() &&
				this.stateBag.getPrevDesignDataFingerprint() === fp
			if (this.lastSaveFullyPersisted) this.clearRemoteConflict()
			// 版本菜单刷新失败不改变已经确认的保存结果。
			if (requestIsCurrent) await this.fetchAndSetVersions().catch(() => [])
			return result
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return { ok: false, reason: "error", error: errorMessage }
		} finally {
			await this.saveLifecycleHandlers.onSaveEnd?.(saveToken, didSave, savedUpdatedAt)
			if (isCurrentRequest()) this.stateBag.setters.setIsSaving(this.pendingSaveCount > 1)
		}
	}

	async checkRemoteUpdate(
		requestOptions: DesignProjectManagerOptions = this.options,
		baseFingerprint: string = this.stateBag.getPrevDesignDataFingerprint(),
	): Promise<RemoteUpdateCheckResult> {
		const fileId = this.stateBag.getMagicProjectJsFileId()
		if (!fileId || !baseFingerprint || this.stateBag.getAccessMode() === "share")
			return { hasUpdate: false, currentFingerprint: null, isCheckReliable: false }
		try {
			const currentFile = await this.readCurrentFile(fileId, requestOptions)
			if (
				!currentFile.data ||
				currentFile.fileId !== this.stateBag.getMagicProjectJsFileId() ||
				currentFile.accessIdentity !== getDesignRequestIdentity(this.options)
			)
				return { hasUpdate: false, currentFingerprint: null, isCheckReliable: false }
			const currentFingerprint = hashDesignDataComparable(currentFile.data)
			return {
				hasUpdate: currentFingerprint !== baseFingerprint,
				currentFingerprint,
				currentFile,
				isCheckReliable: true,
			}
		} catch {
			return { hasUpdate: false, currentFingerprint: null, isCheckReliable: false }
		}
	}

	generateContent(data?: DesignData): string {
		return generateMagicProjectJsContent(this.getDesignDataForSave(data), {
			projectBasePath: this.getProjectBasePathForDsl(),
			flatAttachments: this.options.flatAttachments,
			attachmentIndex: this.options.attachmentIndex,
		})
	}
}
