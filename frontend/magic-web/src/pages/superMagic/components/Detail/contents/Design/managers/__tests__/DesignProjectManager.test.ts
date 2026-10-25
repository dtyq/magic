import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
	CanvasConnection,
	LayerElement,
	RectangleElement,
} from "@/components/CanvasDesign/runtime/document/types"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"
import type { DesignSaveResult, DesignSaveLifecycleHandlers } from "../DesignSaveManager"
import { getDesignRequestIdentity } from "../types"
import { DesignProjectManager } from "../DesignProjectManager"
import type {
	DesignConflict,
	DesignProjectManagerOptions,
	DesignProjectStateBag,
	PendingDesignUpgrade,
} from "../types"
import type { DesignData } from "../../types"
import {
	deleteDesignDraft,
	readDesignDraft,
	writeDesignDraft,
	type DesignDraftEntry,
} from "../../utils/designDraftStorage"
import { hashDesignDataComparable } from "../../utils/designContentHash"
import {
	clearPendingDesignUpgrade,
	writePendingDesignUpgrade,
} from "../../utils/designUpgradeStorage"

vi.mock("../../utils/designDraftStorage", () => ({
	getDesignDraftWriteDebounceMs: vi.fn(() => 0),
	readDesignDraft: vi.fn(),
	writeDesignDraft: vi.fn(),
	deleteDesignDraft: vi.fn(),
}))

function rect(id: string, options: Partial<RectangleElement> = {}): RectangleElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 1,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId }],
		...options,
	}
}

function connection(
	id: string,
	sourceElementId = "source",
	targetElementId = "target",
): CanvasConnection {
	return { id, sourceElementId, targetElementId }
}

function createDesignData(
	name: string,
	elements: LayerElement[] = [],
	connections?: CanvasConnection[],
): DesignData {
	return {
		type: "design",
		name,
		version: "3.0.0",
		canvas: { elements, ...(connections ? { connections } : {}) },
	}
}

function createConflict(localData: DesignData, remoteData: DesignData): DesignConflict {
	return {
		reason: "draft-remote-advanced",
		baseFingerprint: "base-fingerprint",
		localFingerprint: "local-fingerprint",
		remoteFingerprint: "remote-fingerprint",
		localData,
		remoteData,
		createdAt: 1,
	}
}

function getBaseDesignData(manager: DesignProjectManager): DesignData | null {
	return (manager as unknown as { baseDesignData: DesignData | null }).baseDesignData
}

function createManager(
	initialData = createDesignData("local"),
	optionsOverrides: Partial<DesignProjectManagerOptions> = {},
) {
	let designData = initialData
	let conflictState: DesignConflict | null = null
	let magicProjectJsFileId: string | null = "file-1"
	let prevDesignDataFingerprint = hashDesignDataComparable(initialData)
	let accessMode: CanvasAccessMode = "edit"
	let pendingDesignUpgrade: PendingDesignUpgrade | null = null

	const stateBag: DesignProjectStateBag = {
		getDesignData: () => designData,
		getPendingDesignUpgrade: () => pendingDesignUpgrade,
		getConflictState: () => conflictState,
		getMagicProjectJsFileId: () => magicProjectJsFileId,
		getPrevDesignDataFingerprint: () => prevDesignDataFingerprint,
		setPrevDesignDataFingerprint: (v) => {
			prevDesignDataFingerprint = v
		},
		getAccessMode: () => accessMode,
		setters: {
			setMagicProjectJsFileId: vi.fn((v: string | null) => {
				magicProjectJsFileId = v
			}),
			setDesignData: vi.fn((data: DesignData) => {
				designData = data
			}),
			setPendingDesignUpgrade: vi.fn((upgrade: PendingDesignUpgrade | null) => {
				pendingDesignUpgrade = upgrade
			}),
			setIsInitialLoading: vi.fn(),
			setIsSaving: vi.fn(),
			setAccessMode: vi.fn((v: CanvasAccessMode) => {
				accessMode = v
			}),
			setFileVersionsList: vi.fn(),
			setFileVersion: vi.fn(),
			setIsProcessingRevoke: vi.fn(),
			setRevokeType: vi.fn(),
			setConflictState: vi.fn((v: DesignConflict | null) => {
				conflictState = v
			}),
		},
	}

	const options: DesignProjectManagerOptions = {
		allowEdit: true,
		isPlaybackMode: false,
		isShareRoute: false,
		isMobile: false,
		projectId: "project-1",
		designProjectId: "design-1",
		designProjectName: "design",
		attachments: [],
		flatAttachments: [],
		...optionsOverrides,
	}

	const manager = new DesignProjectManager({
		stateBag,
		options,
		getFileVersionsList: () => [],
		getFileVersion: () => undefined,
	})

	manager.syncDesignData(initialData)
	return {
		manager,
		stateBag,
		getState: () => ({
			designData,
			conflictState,
			prevDesignDataFingerprint,
			pendingDesignUpgrade,
		}),
	}
}

function notifyCommittedSave(
	manager: DesignProjectManager,
	result: Omit<
		Extract<DesignSaveResult, { ok: true }>,
		"fileId" | "accessIdentity" | "baseFingerprint"
	>,
): Extract<DesignSaveResult, { ok: true }> {
	const internals = manager as unknown as {
		options: DesignProjectManagerOptions
		stateBag: DesignProjectStateBag
		saveManager: { saveLifecycleHandlers: DesignSaveLifecycleHandlers }
	}
	const fileId = internals.stateBag.getMagicProjectJsFileId()
	if (!fileId) throw new Error("Saved fixture requires its current Canvas file")
	const complete = {
		...result,
		baseFingerprint: internals.stateBag.getPrevDesignDataFingerprint(),
		fileId,
		accessIdentity: getDesignRequestIdentity(internals.options),
	}
	internals.saveManager.saveLifecycleHandlers.onSaveCommitted?.(complete)
	return complete
}
function mockSuccessfulSave(
	manager: DesignProjectManager,
	result: Omit<
		Extract<DesignSaveResult, { ok: true }>,
		"fileId" | "accessIdentity" | "baseFingerprint"
	>,
) {
	return vi.fn(async () => notifyCommittedSave(manager, result))
}

describe("DesignProjectManager conflict boundaries", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(readDesignDraft).mockResolvedValue(null)
		vi.mocked(writeDesignDraft).mockResolvedValue({ target: "memory", durable: false })
		vi.mocked(deleteDesignDraft).mockResolvedValue(undefined)
	})

	it("does not clear an active conflict while syncing design data", () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, stateBag, getState } = createManager(localData)
		const conflict = createConflict(localData, remoteData)
		stateBag.setters.setConflictState(conflict)
		stateBag.setPrevDesignDataFingerprint("conflict-base-fingerprint")

		manager.syncDesignData(remoteData)

		expect(getState().conflictState).toBe(conflict)
		expect(getState().prevDesignDataFingerprint).toBe("conflict-base-fingerprint")
	})

	it("stores a full cloned base design when syncing clean design data", () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, getState } = createManager(localData)
		const remoteFingerprint = hashDesignDataComparable(remoteData)

		manager.syncDesignData(remoteData)

		const baseDesignData = getBaseDesignData(manager)
		expect(getState().prevDesignDataFingerprint).toBe(remoteFingerprint)
		expect(baseDesignData).toEqual(remoteData)
		expect(baseDesignData).not.toBe(remoteData)

		remoteData.name = "mutated-after-sync"
		expect(baseDesignData?.name).toBe("remote")
	})

	it("fully persists a pending legacy DSL upgrade and clears the pending state", async () => {
		const data = createDesignData("legacy-upgraded")
		const { manager, stateBag, getState } = createManager(data)
		stateBag.setters.setPendingDesignUpgrade?.({
			reason: "legacy-dsl",
			createdAt: Date.now(),
			fileId: "file-1",
			sourceVersion: "2.0.0",
			targetVersion: "3.0.0",
		})
		const managerInternals = manager as unknown as {
			saveManager: {
				cancelAutoSave: () => void
				commitSave: (options?: unknown) => Promise<unknown>
			}
		}
		managerInternals.saveManager.cancelAutoSave = vi.fn()
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: null,
			fullyPersisted: true,
			savedDesignData: data,
			savedFingerprint: hashDesignDataComparable(data),
		})

		await expect(manager.persistPendingDesignUpgrade()).resolves.toBe(true)

		expect(managerInternals.saveManager.commitSave).toHaveBeenCalledWith({
			designData: data,
			updateCurrentDesignData: true,
			source: "dsl-upgrade",
		})
		expect(getState().pendingDesignUpgrade).toBeNull()
	})

	it("keeps a pending legacy DSL upgrade retryable when sidecar persistence is incomplete", async () => {
		const data = createDesignData("legacy-upgraded")
		const { manager, stateBag, getState } = createManager(data)
		const pendingUpgrade: PendingDesignUpgrade = {
			reason: "legacy-dsl",
			createdAt: Date.now(),
			fileId: "file-1",
			sourceVersion: "1.0.0",
			targetVersion: "3.0.0",
		}
		stateBag.setters.setPendingDesignUpgrade?.(pendingUpgrade)
		const managerInternals = manager as unknown as {
			saveManager: {
				cancelAutoSave: () => void
				commitSave: (options?: unknown) => Promise<unknown>
			}
		}
		managerInternals.saveManager.cancelAutoSave = vi.fn()
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: null,
			fullyPersisted: false,
			savedDesignData: data,
			savedFingerprint: hashDesignDataComparable(data),
		})

		await expect(manager.persistPendingDesignUpgrade()).resolves.toBe(false)

		expect(getState().pendingDesignUpgrade).toMatchObject({
			...pendingUpgrade,
			reason: "sidecar-retry",
		})
	})

	it("does not persist a pending DSL upgrade while the canvas is read-only", async () => {
		const data = createDesignData("legacy-upgraded")
		const { manager, stateBag } = createManager(data)
		stateBag.setters.setPendingDesignUpgrade?.({
			reason: "legacy-dsl",
			createdAt: Date.now(),
			fileId: "file-1",
			sourceVersion: "2.0.0",
			targetVersion: "3.0.0",
		})
		stateBag.setters.setAccessMode("readonly")
		const managerInternals = manager as unknown as {
			saveManager: { commitSave: (options?: unknown) => Promise<unknown> }
		}
		managerInternals.saveManager.commitSave = vi.fn()

		await expect(manager.persistPendingDesignUpgrade()).resolves.toBe(false)

		expect(managerInternals.saveManager.commitSave).not.toHaveBeenCalled()
	})

	it("writes manual refresh drafts through the emergency fallback", () => {
		const draftData = createDesignData("manual-refresh", [rect("moved", { x: 120 })])
		const { manager } = createManager()

		manager.persistLocalDraft(draftData, { immediate: true, reason: "manual-refresh" })

		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				designData: draftData,
				reason: "manual-refresh",
			}),
			{ emergency: true },
		)
	})

	it("waits for an immediate local draft write when closing", async () => {
		const draftData = createDesignData("close-draft", [rect("close-element")])
		const { manager } = createManager()

		await expect(
			manager.persistLocalDraftAndWait(draftData, {
				immediate: true,
				reason: "manual-refresh",
			}),
		).resolves.toEqual({ target: "memory", durable: false })
		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({ designData: draftData }),
			{ emergency: true },
		)
	})

	it("detects whether an explicit close snapshot differs from the remote base", () => {
		const remoteData = createDesignData("remote")
		const localData = createDesignData("local")
		const { manager } = createManager(remoteData)

		manager.syncDesignData(remoteData)

		expect(manager.hasUnsavedChanges(remoteData)).toBe(false)
		expect(manager.hasUnsavedChanges(localData)).toBe(true)
	})

	it("force reloads remote data while preserving local draft recovery", async () => {
		const { manager } = createManager()
		const managerInternals = manager as unknown as {
			loadManager: {
				resetAndReload: () => Promise<boolean>
				getCurrentLoadIdentity: () => string | null
				isCurrentLoadIdentity: (identity: string | null) => boolean
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.resetAndReload = vi.fn().mockResolvedValue(true)
		managerInternals.loadManager.getCurrentLoadIdentity = vi.fn().mockReturnValue("request-a")
		managerInternals.loadManager.isCurrentLoadIdentity = vi.fn().mockReturnValue(true)
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		await manager.reloadPreservingLocalDraft()

		expect(managerInternals.loadManager.resetAndReload).toHaveBeenCalledTimes(1)
		expect(deleteDesignDraft).not.toHaveBeenCalled()
		expect(managerInternals.tryRestoreLocalDraftAfterRemoteLoad).toHaveBeenCalledTimes(1)
	})

	it("publishes a pending DSL upgrade after the remote load lifecycle completes", async () => {
		const { manager, getState } = createManager()
		const pendingUpgrade: PendingDesignUpgrade = {
			reason: "legacy-dsl",
			createdAt: Date.now(),
			fileId: "file-1",
			sourceVersion: "2.0.0",
			targetVersion: "3.0.0",
		}
		const managerInternals = manager as unknown as {
			loadManager: {
				loadFromRemote: () => Promise<{ pendingUpgrade: PendingDesignUpgrade | null }>
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.loadFromRemote = vi.fn().mockResolvedValue({ pendingUpgrade })
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		await manager.loadFromRemote()

		expect(getState().pendingDesignUpgrade).toEqual(pendingUpgrade)
		expect(managerInternals.tryRestoreLocalDraftAfterRemoteLoad).toHaveBeenCalledTimes(1)
	})

	it("restores a persisted sidecar retry after a v3 remote reload", async () => {
		const { manager, getState } = createManager()
		const identity = {
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
		}
		await clearPendingDesignUpgrade(identity)
		await writePendingDesignUpgrade(identity, {
			reason: "sidecar-retry",
			fileId: "file-1",
			sourceVersion: "2.0.0",
			targetVersion: "3.0.0",
			createdAt: 1,
		})
		const managerInternals = manager as unknown as {
			loadManager: {
				loadFromRemote: () => Promise<{
					pendingUpgrade: PendingDesignUpgrade | null
					sidecarStatus: "loaded"
				}>
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.loadFromRemote = vi.fn().mockResolvedValue({
			pendingUpgrade: null,
			sidecarStatus: "loaded",
		})
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		await manager.loadFromRemote()

		expect(getState().pendingDesignUpgrade).toMatchObject({
			reason: "sidecar-retry",
			fileId: "file-1",
		})
		await clearPendingDesignUpgrade(identity)
	})

	it("force reloads remote data while discarding local drafts for data source switches", async () => {
		const { manager } = createManager()
		const managerInternals = manager as unknown as {
			loadManager: {
				resetAndReload: () => Promise<boolean>
				getCurrentLoadIdentity: () => string | null
				isCurrentLoadIdentity: (identity: string | null) => boolean
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.resetAndReload = vi.fn().mockResolvedValue(true)
		managerInternals.loadManager.getCurrentLoadIdentity = vi.fn().mockReturnValue("request-a")
		managerInternals.loadManager.isCurrentLoadIdentity = vi.fn().mockReturnValue(true)
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		await manager.reloadDiscardingLocalDraft()

		expect(managerInternals.loadManager.resetAndReload).toHaveBeenCalledTimes(1)
		expect(deleteDesignDraft).toHaveBeenCalledTimes(1)
		expect(managerInternals.tryRestoreLocalDraftAfterRemoteLoad).not.toHaveBeenCalled()
	})

	it("keeps the initial loading state when remote reload does not produce trusted data", async () => {
		const { manager, stateBag } = createManager()
		const managerInternals = manager as unknown as {
			loadManager: {
				resetAndReload: () => Promise<boolean>
				getCurrentLoadIdentity: () => string | null
				isCurrentLoadIdentity: (identity: string | null) => boolean
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.resetAndReload = vi.fn().mockResolvedValue(false)
		managerInternals.loadManager.getCurrentLoadIdentity = vi.fn().mockReturnValue("request-a")
		managerInternals.loadManager.isCurrentLoadIdentity = vi.fn().mockReturnValue(true)
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		const didLoad = await manager.reloadPreservingLocalDraft()

		expect(didLoad).toBe(false)
		expect(managerInternals.tryRestoreLocalDraftAfterRemoteLoad).not.toHaveBeenCalled()
		expect(stateBag.setters.setIsInitialLoading).toHaveBeenLastCalledWith(true)
	})

	it("does not restore a draft after the loaded request becomes stale", async () => {
		const { manager, stateBag } = createManager()
		let isCurrentLoad = true
		const managerInternals = manager as unknown as {
			loadManager: {
				loadFromRemote: () => Promise<boolean>
				getCurrentLoadIdentity: () => string | null
				isCurrentLoadIdentity: (identity: string | null) => boolean
			}
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
		}
		managerInternals.loadManager.getCurrentLoadIdentity = vi.fn().mockReturnValue("request-a")
		managerInternals.loadManager.loadFromRemote = vi.fn().mockImplementation(async () => {
			isCurrentLoad = false
			return true
		})
		managerInternals.loadManager.isCurrentLoadIdentity = vi.fn(() => isCurrentLoad)
		managerInternals.tryRestoreLocalDraftAfterRemoteLoad = vi.fn().mockResolvedValue(undefined)

		expect(await manager.loadFromRemote()).toBe(false)
		expect(managerInternals.tryRestoreLocalDraftAfterRemoteLoad).not.toHaveBeenCalled()
		expect(stateBag.setters.setIsInitialLoading).not.toHaveBeenCalledWith(false)
	})

	it("clears local draft after a fully persisted save", async () => {
		const localData = createDesignData("local")
		const { manager } = createManager(localData)
		const managerInternals = manager as unknown as {
			saveManager: {
				commitSave: () => Promise<unknown>
				wasLastSaveFullyPersisted: () => boolean
			}
		}
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: "2026-01-01 00:00:00",
			fullyPersisted: true,
			savedDesignData: localData,
			savedFingerprint: hashDesignDataComparable(localData),
		})
		managerInternals.saveManager.wasLastSaveFullyPersisted = vi.fn(() => true)

		await manager.saveToRemote()

		expect(deleteDesignDraft).toHaveBeenCalledTimes(1)
	})

	it("keeps local draft when save succeeds without full persistence", async () => {
		const localData = createDesignData("local")
		const { manager } = createManager(localData)
		const managerInternals = manager as unknown as {
			saveManager: {
				commitSave: () => Promise<unknown>
				wasLastSaveFullyPersisted: () => boolean
			}
		}
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: "2026-01-01 00:00:00",
			fullyPersisted: false,
			savedDesignData: localData,
			savedFingerprint: hashDesignDataComparable(localData),
		})
		managerInternals.saveManager.wasLastSaveFullyPersisted = vi.fn(() => false)

		await manager.saveToRemote()

		expect(deleteDesignDraft).not.toHaveBeenCalled()
	})

	it("keeps local draft when save fails", async () => {
		const localData = createDesignData("local")
		const { manager } = createManager(localData)
		const managerInternals = manager as unknown as {
			saveManager: { commitSave: () => Promise<unknown> }
		}
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "error",
			error: "save failed",
		})

		await manager.saveToRemote()

		expect(deleteDesignDraft).not.toHaveBeenCalled()
	})

	it("clears local draft for version data source switches", async () => {
		const { manager } = createManager()
		const managerInternals = manager as unknown as {
			versionManager: {
				handleChangeFileVersion: () => Promise<void>
				handleReturnLatest: () => Promise<void>
				handleVersionRollback: () => Promise<void>
			}
		}
		managerInternals.versionManager.handleChangeFileVersion = vi
			.fn()
			.mockResolvedValue(undefined)
		managerInternals.versionManager.handleReturnLatest = vi.fn().mockResolvedValue(undefined)
		managerInternals.versionManager.handleVersionRollback = vi.fn().mockResolvedValue(undefined)

		await manager.handleChangeFileVersion(2, false)
		await manager.handleReturnLatest()
		await manager.handleVersionRollback(1)

		expect(deleteDesignDraft).toHaveBeenCalledTimes(3)
	})

	it("keeps the version data source locked until overlapping version switches finish", async () => {
		const remoteData = createDesignData("remote")
		const { manager, getState } = createManager()
		let resolveChangeVersion: (() => void) | undefined
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			loadAndApplyRemoteFn: (updateType?: "message") => Promise<boolean>
			versionManager: {
				handleChangeFileVersion: () => Promise<void>
				handleReturnLatest: () => Promise<void>
				loadLatest: () => Promise<{ data: DesignData | null; version: number | null }>
			}
		}
		managerInternals.versionManager.handleChangeFileVersion = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveChangeVersion = resolve
				}),
		)
		managerInternals.versionManager.handleReturnLatest = vi.fn().mockResolvedValue(undefined)
		managerInternals.versionManager.loadLatest = vi.fn().mockResolvedValue({
			data: remoteData,
			version: 4,
		})

		const changeVersionPromise = manager.handleChangeFileVersion(2, false)
		const returnLatestPromise = manager.handleReturnLatest()
		await returnLatestPromise

		expect(managerInternals.versionDataSourceLockCount).toBe(1)
		const applied = await managerInternals.loadAndApplyRemoteFn("message")
		expect(applied).toBe(false)
		expect(managerInternals.versionManager.loadLatest).not.toHaveBeenCalled()
		expect(getState().designData.name).toBe("local")

		resolveChangeVersion?.()
		await changeVersionPromise

		expect(managerInternals.versionDataSourceLockCount).toBe(0)
	})

	it("blocks incoming remote data while the version data source is locked", () => {
		const localData = createDesignData("local")
		const incomingRemoteData = createDesignData("incoming-remote")
		const { manager, getState } = createManager(localData)
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			pendingRemoteDesignData: { data: DesignData } | null
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
		}
		managerInternals.versionDataSourceLockCount = 1

		const applied = managerInternals.applyRemoteDesignDataSafely(incomingRemoteData, "message")

		expect(applied).toBe(false)
		expect(getState().designData).toBe(localData)
		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
	})

	it("does not schedule auto-save while the version data source is locked", () => {
		const { manager } = createManager()
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.versionDataSourceLockCount = 1
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		manager.scheduleAutoSave()

		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("blocks save and sync entrypoints while the version data source is locked", async () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, getState } = createManager(localData)
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			saveManager: {
				syncDesignData: (data: DesignData) => void
				manualSave: () => Promise<unknown>
				commitSave: () => Promise<unknown>
			}
		}
		managerInternals.versionDataSourceLockCount = 1
		managerInternals.saveManager.syncDesignData = vi.fn()
		managerInternals.saveManager.manualSave = vi.fn()
		managerInternals.saveManager.commitSave = vi.fn()

		expect(manager.canUpdateCurrentDesignData()).toBe(false)

		manager.syncDesignData(remoteData)
		await manager.manualSave()
		await manager.saveToRemote()

		expect(managerInternals.saveManager.syncDesignData).not.toHaveBeenCalled()
		expect(managerInternals.saveManager.manualSave).not.toHaveBeenCalled()
		expect(managerInternals.saveManager.commitSave).not.toHaveBeenCalled()
		expect(getState().prevDesignDataFingerprint).toBe(
			hashDesignDataComparable(createDesignData("local")),
		)
		expect(getBaseDesignData(manager)).toEqual(createDesignData("local"))
	})

	it("does not queue or write local drafts while the version data source is locked", () => {
		vi.useFakeTimers()
		try {
			const { manager } = createManager()
			const managerInternals = manager as unknown as {
				versionDataSourceLockCount: number
				draftSaveTimer: ReturnType<typeof setTimeout> | null
				pendingDraftSave: unknown
			}
			manager.persistLocalDraft(createDesignData("pending-draft"))
			expect(managerInternals.draftSaveTimer).not.toBeNull()

			managerInternals.versionDataSourceLockCount = 1
			manager.persistLocalDraft(createDesignData("blocked-draft"))
			vi.runOnlyPendingTimers()

			expect(managerInternals.draftSaveTimer).toBeNull()
			expect(managerInternals.pendingDraftSave).toBeNull()
			expect(writeDesignDraft).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not apply remote data if version switching starts before remote load", async () => {
		const remoteData = createDesignData("remote")
		const { manager, getState } = createManager()
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			loadAndApplyRemoteFn: (updateType?: "message") => Promise<boolean>
			versionManager: {
				loadLatest: () => Promise<{ data: DesignData | null; version: number | null }>
			}
		}
		managerInternals.versionManager.loadLatest = vi.fn().mockResolvedValue({
			data: remoteData,
			version: 4,
		})
		managerInternals.versionDataSourceLockCount = 1

		const applied = await managerInternals.loadAndApplyRemoteFn("message")

		expect(applied).toBe(false)
		expect(managerInternals.versionManager.loadLatest).not.toHaveBeenCalled()
		expect(getState().designData.name).toBe("local")
	})

	it("does not apply remote data if version switching starts after remote load", async () => {
		const remoteData = createDesignData("remote")
		const { manager, getState } = createManager()
		const managerInternals = manager as unknown as {
			versionDataSourceLockCount: number
			loadAndApplyRemoteFn: (updateType?: "message") => Promise<boolean>
			versionManager: {
				loadLatest: () => Promise<{ data: DesignData | null; version: number | null }>
			}
		}
		managerInternals.versionManager.loadLatest = vi.fn().mockImplementation(async () => {
			managerInternals.versionDataSourceLockCount = 1
			return {
				data: remoteData,
				version: 4,
			}
		})

		const applied = await managerInternals.loadAndApplyRemoteFn("message")

		expect(applied).toBe(false)
		expect(managerInternals.versionManager.loadLatest).toHaveBeenCalledTimes(1)
		expect(getState().designData.name).toBe("local")
	})

	it("defers incoming remote data while a conflict is active", () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const incomingRemoteData = createDesignData("incoming-remote")
		const { manager, stateBag, getState } = createManager(localData)
		stateBag.setters.setConflictState(createConflict(localData, remoteData))

		const applied = (
			manager as unknown as {
				applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			}
		).applyRemoteDesignDataSafely(incomingRemoteData, "message")

		const pendingRemoteDesignData = (
			manager as unknown as {
				pendingRemoteDesignData: { data: DesignData } | null
			}
		).pendingRemoteDesignData
		const saveManager = (
			manager as unknown as { saveManager: { hasRemoteConflict: () => boolean } }
		).saveManager

		expect(applied).toBe(false)
		expect(getState().designData).toBe(localData)
		expect(getState().conflictState?.remoteData).toEqual(incomingRemoteData)
		expect(pendingRemoteDesignData?.data).toEqual(incomingRemoteData)
		expect(saveManager.hasRemoteConflict()).toBe(true)
	})

	it("resolves a blocking conflict by applying pending remote data", () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const pendingRemoteData = createDesignData("pending-remote")
		const onRemoteDesignDataUpdate = vi.fn()
		const { manager, stateBag, getState } = createManager(localData, {
			onRemoteDesignDataUpdate,
		})
		stateBag.setters.setConflictState(createConflict(localData, remoteData))
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: {
				data: DesignData
				updateType: "message"
			} | null
			saveManager: {
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
			}
		}
		managerInternals.pendingRemoteDesignData = {
			data: pendingRemoteData,
			updateType: "message",
		}
		managerInternals.saveManager.markRemoteConflict()

		const didResolve = manager.resolveBlockingConflictWithRemote()

		expect(didResolve).toBe(true)
		expect(getState().designData).toEqual(pendingRemoteData)
		expect(getState().conflictState).toBeNull()
		expect(getState().prevDesignDataFingerprint).toBe(
			hashDesignDataComparable(pendingRemoteData),
		)
		expect(getBaseDesignData(manager)).toEqual(pendingRemoteData)
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(deleteDesignDraft).toHaveBeenCalledTimes(1)
		expect(onRemoteDesignDataUpdate).toHaveBeenCalledWith(
			localData,
			pendingRemoteData,
			"message",
		)
	})

	it("resolves a draft conflict by using remote data and deleting the local draft", () => {
		const localDraftData = createDesignData("local-draft")
		const remoteData = createDesignData("remote")
		const { manager, stateBag, getState } = createManager(localDraftData)
		stateBag.setters.setConflictState(createConflict(localDraftData, remoteData))
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: unknown
			saveManager: {
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
			}
		}
		managerInternals.saveManager.markRemoteConflict()

		const didResolve = manager.resolveBlockingConflictWithRemote()

		expect(didResolve).toBe(true)
		expect(getState().designData).toEqual(remoteData)
		expect(getState().conflictState).toBeNull()
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(deleteDesignDraft).toHaveBeenCalledTimes(1)
	})

	it("resolves a draft conflict by applying local draft data and force-saving once", async () => {
		const currentRemoteData = createDesignData("current-remote")
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const onRemoteDesignDataUpdate = vi.fn()
		const { manager, stateBag, getState } = createManager(currentRemoteData, {
			onRemoteDesignDataUpdate,
		})
		stateBag.setters.setConflictState(createConflict(localData, remoteData))
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: { data: DesignData } | null
			saveManager: {
				commitSave: (options?: unknown) => Promise<unknown>
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
				wasLastSaveFullyPersisted: () => boolean
			}
		}
		managerInternals.pendingRemoteDesignData = { data: remoteData }
		managerInternals.saveManager.markRemoteConflict()
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: "2026-01-01 00:00:00",
			fullyPersisted: true,
			savedDesignData: localData,
			savedFingerprint: hashDesignDataComparable(localData),
		})
		managerInternals.saveManager.wasLastSaveFullyPersisted = vi.fn(() => true)

		const didResolve = await manager.resolveBlockingConflictWithLocal()

		expect(didResolve).toBe(true)
		expect(getState().designData).toEqual(localData)
		expect(getState().conflictState).toBeNull()
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(localData))
		expect(getBaseDesignData(manager)).toEqual(localData)
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(managerInternals.saveManager.commitSave).toHaveBeenCalledWith({
			allowRemoteConflict: true,
			designData: localData,
			updateCurrentDesignData: true,
			source: "conflict-resolution",
		})
		expect(writeDesignDraft).toHaveBeenCalledTimes(1)
		expect(deleteDesignDraft).toHaveBeenCalledTimes(1)
		expect(onRemoteDesignDataUpdate).toHaveBeenCalledWith(currentRemoteData, localData, "draft")
	})

	it("keeps a blocking conflict recoverable when local force-save fails", async () => {
		const currentRemoteData = createDesignData("current-remote")
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const onRemoteDesignDataUpdate = vi.fn()
		const { manager, stateBag, getState } = createManager(currentRemoteData, {
			onRemoteDesignDataUpdate,
		})
		const conflict = createConflict(localData, remoteData)
		const pendingRemoteDesignData = {
			data: remoteData,
			updateType: "message" as const,
		}
		stateBag.setters.setConflictState(conflict)
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: typeof pendingRemoteDesignData | null
			saveManager: {
				commitSave: (options?: unknown) => Promise<unknown>
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
			}
		}
		managerInternals.pendingRemoteDesignData = pendingRemoteDesignData
		managerInternals.saveManager.markRemoteConflict()
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "error",
			error: "save failed",
		})

		const didResolve = await manager.resolveBlockingConflictWithLocal()

		expect(didResolve).toBe(false)
		expect(getState().designData).toEqual(localData)
		expect(getState().conflictState).toBe(conflict)
		expect(managerInternals.pendingRemoteDesignData).toBe(pendingRemoteDesignData)
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(true)
		expect(writeDesignDraft).toHaveBeenCalledTimes(1)
		expect(deleteDesignDraft).not.toHaveBeenCalled()
		expect(onRemoteDesignDataUpdate).toHaveBeenCalledWith(currentRemoteData, localData, "draft")
	})

	it("clears a blocking conflict but keeps the local draft when sidecar persistence fails", async () => {
		const currentRemoteData = createDesignData("current-remote")
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, stateBag, getState } = createManager(currentRemoteData)
		stateBag.setters.setConflictState(createConflict(localData, remoteData))
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: {
				data: DesignData
				updateType: "message"
			} | null
			saveManager: {
				commitSave: (options?: unknown) => Promise<unknown>
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
				wasLastSaveFullyPersisted: () => boolean
			}
		}
		managerInternals.pendingRemoteDesignData = {
			data: remoteData,
			updateType: "message",
		}
		managerInternals.saveManager.markRemoteConflict()
		managerInternals.saveManager.commitSave = mockSuccessfulSave(manager, {
			ok: true,
			savedUpdatedAt: "2026-01-01 00:00:00",
			fullyPersisted: false,
			savedDesignData: localData,
			savedFingerprint: hashDesignDataComparable(localData),
		})
		managerInternals.saveManager.wasLastSaveFullyPersisted = vi.fn(() => false)

		const didResolve = await manager.resolveBlockingConflictWithLocal()

		expect(didResolve).toBe(true)
		expect(getState().designData).toEqual(localData)
		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(writeDesignDraft).toHaveBeenCalledTimes(1)
		expect(deleteDesignDraft).not.toHaveBeenCalled()
	})

	it("keeps the blocking conflict visible while local force-save is still running", async () => {
		const currentRemoteData = createDesignData("current-remote")
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, stateBag, getState } = createManager(currentRemoteData)
		const conflict = createConflict(localData, remoteData)
		const pendingRemoteDesignData = {
			data: remoteData,
			updateType: "message" as const,
		}
		stateBag.setters.setConflictState(conflict)
		const managerInternals = manager as unknown as {
			pendingRemoteDesignData: typeof pendingRemoteDesignData | null
			saveManager: {
				commitSave: (options?: unknown) => Promise<unknown>
				markRemoteConflict: () => void
				hasRemoteConflict: () => boolean
				wasLastSaveFullyPersisted: () => boolean
			}
		}
		managerInternals.pendingRemoteDesignData = pendingRemoteDesignData
		managerInternals.saveManager.markRemoteConflict()
		let resolveSave!: (value: unknown) => void
		managerInternals.saveManager.commitSave = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveSave = resolve
				}),
		)
		managerInternals.saveManager.wasLastSaveFullyPersisted = vi.fn(() => true)

		const resolvePromise = manager.resolveBlockingConflictWithLocal()

		expect(getState().designData).toEqual(localData)
		expect(getState().conflictState).toBe(conflict)
		expect(managerInternals.pendingRemoteDesignData).toBe(pendingRemoteDesignData)
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(true)

		resolveSave(
			notifyCommittedSave(manager, {
				ok: true,
				savedUpdatedAt: "2026-01-01 00:00:00",
				fullyPersisted: true,
				savedDesignData: localData,
				savedFingerprint: hashDesignDataComparable(localData),
			}),
		)
		await expect(resolvePromise).resolves.toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
	})

	it("keeps normal save entrypoints blocked while a blocking conflict is active", async () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, stateBag } = createManager(localData)
		stateBag.setters.setConflictState(createConflict(localData, remoteData))
		const managerInternals = manager as unknown as {
			saveManager: { commitSave: () => Promise<unknown> }
		}
		managerInternals.saveManager.commitSave = vi.fn()

		await manager.manualSave()
		await manager.saveToRemote()

		expect(managerInternals.saveManager.commitSave).not.toHaveBeenCalled()
	})

	it("passes an explicit close snapshot to the remote save manager", async () => {
		const currentData = createDesignData("current")
		const closeSnapshot = createDesignData("close-snapshot")
		const { manager } = createManager(currentData)
		const managerInternals = manager as unknown as {
			saveManager: {
				manualSave: (data?: DesignData) => Promise<unknown>
			}
		}
		managerInternals.saveManager.manualSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "error",
		})

		await manager.manualSave(closeSnapshot)

		expect(managerInternals.saveManager.manualSave).toHaveBeenCalledWith(closeSnapshot)
	})

	it("merges incoming remote data when local and remote changed different elements", () => {
		const baseData = createDesignData("design", [rect("remote-element"), rect("local-element")])
		const localData = createDesignData("design", [
			rect("remote-element"),
			rect("local-element", { y: 200 }),
		])
		const remoteData = createDesignData("design", [
			rect("remote-element", { x: 100 }),
			rect("local-element"),
		])
		const onRemoteDesignDataUpdate = vi.fn()
		const { manager, stateBag, getState } = createManager(baseData, {
			onRemoteDesignDataUpdate,
		})
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			pendingRemoteDesignData: unknown
			saveManager: {
				hasRemoteConflict: () => boolean
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "remote-element", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 200 }),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
		expect(onRemoteDesignDataUpdate).toHaveBeenCalledWith(
			localData,
			expect.objectContaining({
				canvas: expect.objectContaining({
					elements: [
						expect.objectContaining({ id: "remote-element", x: 100, y: 0 }),
						expect.objectContaining({ id: "local-element", x: 0, y: 200 }),
					],
				}),
			}),
			"message",
		)
	})

	it("auto-merges incoming remote data when local and remote changed different fields on the same element", () => {
		const baseData = createDesignData("design", [rect("same"), rect("local-element")])
		const localData = createDesignData("design", [
			rect("same", { y: 200 }),
			rect("local-element", { y: 300 }),
		])
		const remoteData = createDesignData("design", [
			rect("same", { x: 100 }),
			rect("local-element"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			pendingRemoteDesignData: { data: DesignData } | null
			saveManager: {
				hasRemoteConflict: () => boolean
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "same", x: 100, y: 200 }),
				expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
			]),
		)
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
	})

	it("creates an element-level conflict when both sides change the same field", () => {
		const baseData = createDesignData("design", [rect("same"), rect("local-element")])
		const localData = createDesignData("design", [
			rect("same", { x: 200 }),
			rect("local-element", { y: 300 }),
		])
		const remoteData = createDesignData("design", [
			rect("same", { x: 100 }),
			rect("local-element"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			pendingRemoteDesignData: { data: DesignData } | null
			saveManager: {
				hasRemoteConflict: () => boolean
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
		])
		expect(getState().conflictState?.reason).toBe("element-level-conflict")
		expect(getState().conflictState?.localData).toEqual(localData)
		expect(getState().conflictState?.remoteData).toEqual(remoteData)
		expect(getState().conflictState?.mergedData?.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
		])
		expect(getState().conflictState?.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "same",
				reason: "same-element-changed",
				status: "unresolved",
				baseElement: expect.objectContaining({ id: "same", x: 0, y: 0 }),
				localElement: expect.objectContaining({ id: "same", x: 200, y: 0 }),
				remoteElement: expect.objectContaining({ id: "same", x: 100, y: 0 }),
			}),
		])
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				baseRemoteData: baseData,
				designData: localData,
				reason: "local-edit",
			}),
		)
	})

	it("defers a successful remote merge that would empty a non-empty remote canvas", () => {
		const baseData = createDesignData("base", [rect("remote")])
		const localData = createDesignData("base")
		const remoteData = createDesignData("remote", [rect("remote")])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			pendingRemoteDesignData: { data: DesignData } | null
			saveManager: {
				hasRemoteConflict: () => boolean
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		vi.mocked(stateBag.setters.setDesignData).mockClear()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().designData).toEqual(localData)
		expect(stateBag.setters.setDesignData).not.toHaveBeenCalled()
		expect(getState().conflictState?.reason).toBe("remote-update-with-local-dirty")
		expect(managerInternals.pendingRemoteDesignData).toEqual({
			data: remoteData,
			updateType: "message",
		})
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(true)
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("creates a connection-level conflict when both sides change the same connection", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseData = createDesignData("design", elements, [
			connection("edge", "source", "target"),
		])
		const localData = createDesignData("design", elements, [
			connection("edge", "target", "other"),
		])
		const remoteData = createDesignData("design", elements, [
			connection("edge", "other", "source"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().conflictState?.reason).toBe("connection-level-conflict")
		expect(getState().designData.canvas?.connections).toEqual([
			connection("edge", "target", "other"),
		])
		expect(getState().conflictState?.mergedData?.canvas?.connections).toEqual([
			connection("edge", "other", "source"),
		])
		expect(getState().conflictState?.connectionConflicts).toEqual([
			expect.objectContaining({
				connectionId: "edge",
				reason: "same-connection-changed",
				status: "unresolved",
				baseConnection: connection("edge", "source", "target"),
				localConnection: connection("edge", "target", "other"),
				remoteConnection: connection("edge", "other", "source"),
			}),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("resolves a connection-level blocking conflict with the remote connection", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseData = createDesignData("design", elements, [
			connection("edge", "source", "target"),
		])
		const localData = createDesignData("design", elements, [
			connection("edge", "target", "other"),
		])
		const remoteData = createDesignData("design", elements, [
			connection("edge", "other", "source"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		const didResolve = manager.resolveBlockingConflictWithRemote()

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.connections).toEqual([
			connection("edge", "other", "source"),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("keeps a connection-level conflict recoverable when local force-save fails", async () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseData = createDesignData("design", elements, [
			connection("edge", "source", "target"),
		])
		const localData = createDesignData("design", elements, [
			connection("edge", "target", "other"),
		])
		const remoteData = createDesignData("design", elements, [
			connection("edge", "other", "source"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				commitSave: (options?: unknown) => Promise<unknown>
			}
		}
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		const conflict = getState().conflictState
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "error",
			error: "save failed",
		})

		const didResolve = await manager.resolveBlockingConflictWithLocal()

		expect(didResolve).toBe(false)
		expect(getState().conflictState).toEqual(conflict)
		expect(getState().designData.canvas?.connections).toEqual([
			connection("edge", "target", "other"),
		])
		expect(writeDesignDraft).toHaveBeenCalled()
	})

	it("saves non-conflicting changes remotely while unresolved element conflicts keep remote candidates", async () => {
		const baseData = createDesignData("design", [rect("same"), rect("local-element")])
		const localData = createDesignData("design", [
			rect("same", { x: 200 }),
			rect("local-element", { y: 300 }),
		])
		const remoteData = createDesignData("design", [
			rect("same", { x: 100 }),
			rect("local-element"),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				commitSave: (options?: { designData?: DesignData }) => Promise<unknown>
				scheduleAutoSave: (designData?: DesignData) => void
			}
		}
		managerInternals.saveManager.commitSave = vi.fn(
			async (options?: { designData?: DesignData }) => ({
				ok: true,
				savedUpdatedAt: null,
				fullyPersisted: true,
				savedDesignData: options?.designData ?? getState().designData,
				savedFingerprint: hashDesignDataComparable(
					options?.designData ?? getState().designData,
				),
			}),
		)
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		vi.mocked(writeDesignDraft).mockClear()

		manager.scheduleAutoSave()
		await manager.saveToRemote()
		await manager.manualSave()

		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledWith(
			expect.objectContaining({
				canvas: expect.objectContaining({
					elements: [
						expect.objectContaining({ id: "same", x: 100, y: 0 }),
						expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
					],
				}),
			}),
			expect.objectContaining({ source: "conflict-resolution" }),
		)
		expect(managerInternals.saveManager.commitSave).toHaveBeenCalledTimes(2)
		expect(managerInternals.saveManager.commitSave).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				designData: expect.objectContaining({
					canvas: expect.objectContaining({
						elements: [
							expect.objectContaining({ id: "same", x: 100, y: 0 }),
							expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
						],
					}),
				}),
				updateCurrentDesignData: false,
			}),
		)
		expect(managerInternals.saveManager.commitSave).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				allowRemoteConflict: true,
				designData: expect.objectContaining({
					canvas: expect.objectContaining({
						elements: [
							expect.objectContaining({ id: "same", x: 100, y: 0 }),
							expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
						],
					}),
				}),
				updateCurrentDesignData: false,
			}),
		)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
		])
		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				designData: expect.objectContaining({
					canvas: expect.objectContaining({
						elements: [
							expect.objectContaining({ id: "same", x: 200, y: 0 }),
							expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
						],
					}),
				}),
				reason: "local-edit",
			}),
			expect.any(Object),
		)
	})

	it("auto-clears an existing element conflict when a later remote merge can reconcile it by field", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { y: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		stateBag.setters.setConflictState({
			reason: "element-level-conflict",
			baseFingerprint: hashDesignDataComparable(baseData),
			localFingerprint: hashDesignDataComparable(localData),
			remoteFingerprint: hashDesignDataComparable(remoteData),
			localData,
			remoteData,
			mergedData: remoteData,
			createdAt: 1,
			elementConflicts: [
				{
					elementId: "same",
					reason: "same-element-changed",
					status: "unresolved",
					baseElement: rect("same"),
					localElement: rect("same", { y: 200 }),
					remoteElement: rect("same", { x: 100 }),
					baseParentId: null,
					localParentId: null,
					remoteParentId: null,
					createdAt: 1,
				},
			],
		})
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const applied = managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		expect(applied).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 200 }),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
	})

	it("refreshes an unresolved element conflict when a later remote update changes that element", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { x: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const newerRemoteData = createDesignData("design", [rect("same", { x: 180 })])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		vi.mocked(writeDesignDraft).mockClear()

		const applied = managerInternals.applyRemoteDesignDataSafely(newerRemoteData, "message")

		expect(applied).toBe(true)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200, y: 0 }),
		])
		expect(getState().conflictState?.remoteData).toEqual(newerRemoteData)
		expect(getState().conflictState?.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "same",
				status: "unresolved",
				localElement: expect.objectContaining({ id: "same", x: 200, y: 0 }),
				remoteElement: expect.objectContaining({ id: "same", x: 180, y: 0 }),
			}),
		])
		expect(getState().conflictState?.localData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200, y: 0 }),
		])
		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				designData: expect.objectContaining({
					canvas: expect.objectContaining({
						elements: [expect.objectContaining({ id: "same", x: 200, y: 0 })],
					}),
				}),
				reason: "local-edit",
			}),
		)
	})

	it("keeps existing unresolved element conflicts when a newer remote update adds another element conflict", () => {
		const baseData = createDesignData("design", [rect("same-a"), rect("same-b")])
		const localData = createDesignData("design", [
			rect("same-a", { x: 200 }),
			rect("same-b", { x: 300 }),
		])
		const remoteData = createDesignData("design", [rect("same-a", { x: 100 }), rect("same-b")])
		const newerRemoteData = createDesignData("design", [
			rect("same-a", { x: 150 }),
			rect("same-b", { x: 120 }),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		const applied = managerInternals.applyRemoteDesignDataSafely(newerRemoteData, "message")

		expect(applied).toBe(true)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same-a", x: 200, y: 0 }),
			expect.objectContaining({ id: "same-b", x: 300, y: 0 }),
		])
		const conflictsById = new Map(
			getState().conflictState?.elementConflicts?.map((elementConflict) => [
				elementConflict.elementId,
				elementConflict,
			]),
		)
		expect(conflictsById.get("same-a")).toEqual(
			expect.objectContaining({
				status: "unresolved",
				localElement: expect.objectContaining({ id: "same-a", x: 200, y: 0 }),
				remoteElement: expect.objectContaining({ id: "same-a", x: 150, y: 0 }),
			}),
		)
		expect(conflictsById.get("same-b")).toEqual(
			expect.objectContaining({
				status: "unresolved",
				localElement: expect.objectContaining({ id: "same-b", x: 300, y: 0 }),
				remoteElement: expect.objectContaining({ id: "same-b", x: 120, y: 0 }),
			}),
		)
		expect(getState().conflictState?.localData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same-a", x: 200, y: 0 }),
			expect.objectContaining({ id: "same-b", x: 300, y: 0 }),
		])
	})

	it("resolves an element-level conflict as remote when the latest remote deleted the element", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { y: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const newerRemoteData = createDesignData("design", [])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		managerInternals.applyRemoteDesignDataSafely(newerRemoteData, "message")

		const didResolve = manager.resolveElementConflictWithRemote("same")

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([])
	})

	it("resolves an element-level conflict as local when the conflicted element is edited", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { x: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const editedData = createDesignData("design", [rect("same", { x: 160, y: 240 })])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		stateBag.setters.setDesignData(editedData)

		const didResolve = manager.resolveEditedElementConflictsWithLocal(["same"], editedData)

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 160, y: 240 }),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
	})

	it("reschedules selective remote save when one edited conflict is resolved locally and others remain unresolved", () => {
		const baseData = createDesignData("design", [rect("same-a"), rect("same-b")])
		const localData = createDesignData("design", [
			rect("same-a", { x: 200 }),
			rect("same-b", { x: 300 }),
		])
		const remoteData = createDesignData("design", [
			rect("same-a", { x: 100 }),
			rect("same-b", { x: 120 }),
		])
		const editedData = createDesignData("design", [
			rect("same-a", { x: 160, y: 240 }),
			rect("same-b", { x: 300 }),
		])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: (designData?: DesignData, metadata?: unknown) => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")
		vi.mocked(managerInternals.saveManager.scheduleAutoSave).mockClear()
		stateBag.setters.setDesignData(editedData)

		const didResolve = manager.resolveEditedElementConflictsWithLocal(["same-a"], editedData, {
			source: "canvas-patch",
			deletedElementIds: ["same-a"],
		})

		expect(didResolve).toBe(true)
		expect(getState().conflictState?.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "same-a",
				status: "resolved",
				resolution: "use-local",
			}),
			expect.objectContaining({
				elementId: "same-b",
				status: "unresolved",
			}),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledWith(
			expect.objectContaining({
				canvas: expect.objectContaining({
					elements: [
						expect.objectContaining({ id: "same-a", x: 160, y: 240 }),
						expect.objectContaining({ id: "same-b", x: 120, y: 0 }),
					],
				}),
			}),
			expect.objectContaining({
				source: "canvas-patch",
				deletedElementIds: ["same-a"],
			}),
		)
	})

	it("does not schedule selective remote save when an unresolved conflict cannot restore its remote parent", () => {
		const localData = createDesignData("design", [rect("same", { y: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const { manager, stateBag } = createManager(localData)
		stateBag.setters.setConflictState({
			reason: "element-level-conflict",
			baseFingerprint: "base-fingerprint",
			localFingerprint: "local-fingerprint",
			remoteFingerprint: "remote-fingerprint",
			localData,
			remoteData,
			createdAt: 1,
			elementConflicts: [
				{
					elementId: "same",
					reason: "missing-parent",
					status: "unresolved",
					baseElement: rect("same"),
					localElement: rect("same", { y: 200 }),
					remoteElement: rect("same", { x: 100 }),
					baseParentId: null,
					localParentId: null,
					remoteParentId: "missing-parent",
					createdAt: 1,
				},
			],
		})
		const managerInternals = manager as unknown as {
			saveManager: {
				scheduleAutoSave: (designData?: DesignData) => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		manager.scheduleAutoSave()

		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("auto-merges a stale single element conflict before applying a local choice", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { y: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const { manager, stateBag, getState } = createManager(localData)
		stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(remoteData))
		stateBag.setters.setConflictState({
			reason: "element-level-conflict",
			baseFingerprint: hashDesignDataComparable(baseData),
			localFingerprint: hashDesignDataComparable(localData),
			remoteFingerprint: hashDesignDataComparable(remoteData),
			localData,
			remoteData,
			mergedData: remoteData,
			createdAt: 1,
			elementConflicts: [
				{
					elementId: "same",
					reason: "same-element-changed",
					status: "unresolved",
					baseElement: rect("same"),
					localElement: rect("same", { y: 200 }),
					remoteElement: rect("same", { x: 100 }),
					baseParentId: null,
					localParentId: null,
					remoteParentId: null,
					createdAt: 1,
				},
			],
		})
		const managerInternals = manager as unknown as {
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		const didResolve = manager.resolveElementConflictWithLocal("same")

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 200 }),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
	})

	it("resolves an element-level conflict as local when the local element is chosen", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { x: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		const didResolve = manager.resolveElementConflictWithLocal("same")

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200, y: 0 }),
		])
	})

	it("resolves an element-level conflict as remote when the remote element is chosen", () => {
		const baseData = createDesignData("design", [rect("same")])
		const localData = createDesignData("design", [rect("same", { x: 200 })])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const { manager, stateBag, getState } = createManager(baseData)
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			applyRemoteDesignDataSafely: (data: DesignData, updateType: "message") => boolean
			saveManager: {
				scheduleAutoSave: () => void
			}
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.applyRemoteDesignDataSafely(remoteData, "message")

		const didResolve = manager.resolveElementConflictWithRemote("same")

		expect(didResolve).toBe(true)
		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 0 }),
		])
	})

	it("turns a remote-updated save result into a conflict with pending remote data", async () => {
		const localData = createDesignData("local")
		const remoteData = createDesignData("remote")
		const { manager, stateBag, getState } = createManager(createDesignData("base"))
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			saveManager: { commitSave: () => Promise<unknown>; hasRemoteConflict: () => boolean }
			versionManager: { loadLatest: () => Promise<{ data: DesignData; version: number }> }
			pendingRemoteDesignData: { data: DesignData } | null
		}
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "remote-updated",
			isCheckReliable: true,
		})
		managerInternals.versionManager.loadLatest = vi.fn().mockResolvedValue({
			data: remoteData,
			version: 3,
			fileId: "file-1",
			accessIdentity: getDesignRequestIdentity(
				(manager as unknown as { options: DesignProjectManagerOptions }).options,
			),
		})

		await manager.saveToRemote()

		expect(getState().designData).toBe(localData)
		expect(getState().conflictState?.reason).toBe("save-content-conflict")
		expect(getState().conflictState?.remoteData).toEqual(remoteData)
		expect(managerInternals.pendingRemoteDesignData?.data).toEqual(remoteData)
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(true)
	})

	it("merges a remote-updated save result when local and remote changed different elements", async () => {
		const baseData = createDesignData("design", [rect("remote-element"), rect("local-element")])
		const localData = createDesignData("design", [
			rect("remote-element"),
			rect("local-element", { y: 200 }),
		])
		const remoteData = createDesignData("design", [
			rect("remote-element", { x: 100 }),
			rect("local-element"),
		])
		const onRemoteDesignDataUpdate = vi.fn()
		const { manager, stateBag, getState } = createManager(baseData, {
			onRemoteDesignDataUpdate,
		})
		manager.syncDesignData(baseData)
		stateBag.setters.setDesignData(localData)
		const managerInternals = manager as unknown as {
			saveManager: {
				commitSave: () => Promise<unknown>
				hasRemoteConflict: () => boolean
				scheduleAutoSave: () => void
			}
			versionManager: { loadLatest: () => Promise<{ data: DesignData; version: number }> }
			pendingRemoteDesignData: { data: DesignData } | null
		}
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "remote-updated",
			isCheckReliable: true,
		})
		managerInternals.saveManager.scheduleAutoSave = vi.fn()
		managerInternals.versionManager.loadLatest = vi.fn().mockResolvedValue({
			data: remoteData,
			version: 3,
			fileId: "file-1",
			accessIdentity: getDesignRequestIdentity(
				(manager as unknown as { options: DesignProjectManagerOptions }).options,
			),
		})

		await manager.saveToRemote()

		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.saveManager.hasRemoteConflict()).toBe(false)
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "remote-element", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 200 }),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
		expect(onRemoteDesignDataUpdate).toHaveBeenCalledWith(
			localData,
			expect.objectContaining({
				canvas: expect.objectContaining({
					elements: [
						expect.objectContaining({ id: "remote-element", x: 100, y: 0 }),
						expect.objectContaining({ id: "local-element", x: 0, y: 200 }),
					],
				}),
			}),
			"message",
		)
	})

	it("does not create a conflict when the remote check is unreliable but no remote data was loaded", async () => {
		const localData = createDesignData("local")
		const { manager, getState } = createManager(localData)
		const managerInternals = manager as unknown as {
			saveManager: { commitSave: () => Promise<unknown> }
			versionManager: { loadLatest: () => Promise<unknown> }
			pendingRemoteDesignData: unknown
		}
		managerInternals.saveManager.commitSave = vi.fn().mockResolvedValue({
			ok: false,
			reason: "remote-check-unreliable",
			isCheckReliable: false,
		})
		managerInternals.versionManager.loadLatest = vi.fn()

		await manager.saveToRemote()

		expect(getState().designData).toBe(localData)
		expect(getState().conflictState).toBeNull()
		expect(managerInternals.pendingRemoteDesignData).toBeNull()
		expect(managerInternals.versionManager.loadLatest).not.toHaveBeenCalled()
	})

	it("auto-merges a remote-advanced local draft when base remote data is available", async () => {
		const baseData = createDesignData("design", [rect("same")])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const draftData = createDesignData("design", [rect("same", { y: 200 })])
		const { manager, stateBag, getState } = createManager(remoteData)
		stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(remoteData))
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: hashDesignDataComparable(baseData),
			localFingerprint: hashDesignDataComparable(draftData),
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
			baseRemoteData: baseData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		expect(getState().conflictState).toBeNull()
		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 200 }),
		])
		expect(getState().prevDesignDataFingerprint).toBe(hashDesignDataComparable(remoteData))
		expect(getBaseDesignData(manager)).toEqual(remoteData)
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
		expect(writeDesignDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				designData: expect.objectContaining({
					canvas: expect.objectContaining({
						elements: [expect.objectContaining({ id: "same", x: 100, y: 200 })],
					}),
				}),
				baseRemoteData: remoteData,
				reason: "local-edit",
			}),
			expect.any(Object),
		)
	})

	it("keeps a legacy remote-advanced local draft as a blocking conflict", async () => {
		const remoteData = createDesignData("remote")
		const draftData = createDesignData("local-draft")
		const { manager, getState } = createManager(remoteData)
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: "base-fingerprint",
			localFingerprint: "local-fingerprint",
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		expect(getState().designData).toBe(remoteData)
		expect(getState().conflictState?.reason).toBe("draft-remote-advanced")
		expect(getState().conflictState?.localData).toEqual(draftData)
		expect(getState().conflictState?.remoteData).toEqual(remoteData)
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("keeps only element-level conflicts when a remote-advanced draft cannot merge one field", async () => {
		const baseData = createDesignData("design", [rect("same")])
		const remoteData = createDesignData("design", [rect("same", { x: 100 })])
		const draftData = createDesignData("design", [rect("same", { x: 200 })])
		const { manager, stateBag, getState } = createManager(remoteData)
		stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(remoteData))
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: hashDesignDataComparable(baseData),
			localFingerprint: hashDesignDataComparable(draftData),
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
			baseRemoteData: baseData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		expect(getState().designData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 200 }),
		])
		expect(getState().conflictState?.reason).toBe("element-level-conflict")
		expect(getState().conflictState?.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "same",
				reason: "same-element-changed",
				status: "unresolved",
			}),
		])
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})

	it("keeps the clean remote base when a compatible local draft is restored", async () => {
		const remoteData = createDesignData("remote")
		const draftData = createDesignData("local-draft")
		const { manager, getState } = createManager(remoteData)
		manager.syncDesignData(remoteData)
		const remoteFingerprint = hashDesignDataComparable(remoteData)
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: remoteFingerprint,
			baseRemoteData: remoteData,
			localFingerprint: hashDesignDataComparable(draftData),
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		const baseDesignData = getBaseDesignData(manager)
		expect(getState().designData).toEqual(draftData)
		expect(getState().prevDesignDataFingerprint).toBe(remoteFingerprint)
		expect(baseDesignData).toEqual(remoteData)
		expect(baseDesignData).not.toBe(remoteData)
		expect(managerInternals.saveManager.scheduleAutoSave).toHaveBeenCalledTimes(1)
	})

	it("does not apply an empty restored draft when the trusted remote base is non-empty", async () => {
		const remoteData = createDesignData("remote", [rect("remote")])
		const draftData = createDesignData("empty-draft")
		const { manager, getState } = createManager(remoteData)
		manager.syncDesignData(remoteData)
		const remoteFingerprint = hashDesignDataComparable(remoteData)
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: remoteFingerprint,
			baseRemoteData: remoteData,
			localFingerprint: hashDesignDataComparable(draftData),
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		expect(getState().designData).toEqual(remoteData)
		expect(getState().conflictState).toEqual(
			expect.objectContaining({
				reason: "draft-remote-advanced",
				localData: draftData,
				remoteData,
			}),
		)
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
		expect(warnSpy).toHaveBeenCalledWith(
			"[DesignSaveGuard]",
			expect.stringContaining("blocked-empty-draft-restore-autosave"),
		)
		warnSpy.mockRestore()
	})

	it("does not apply an empty successful merge when the advanced remote remains non-empty", async () => {
		const baseData = createDesignData("base", [rect("remote")])
		const remoteData = createDesignData("remote", [rect("remote")])
		const draftData = createDesignData("base")
		const { manager, stateBag, getState } = createManager(remoteData)
		stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(remoteData))
		const draft: DesignDraftEntry = {
			key: "draft-key",
			schemaVersion: 1,
			projectId: "project-1",
			designProjectId: "design-1",
			magicProjectJsFileId: "file-1",
			baseRemoteFingerprint: hashDesignDataComparable(baseData),
			localFingerprint: hashDesignDataComparable(draftData),
			localUpdatedAt: 1,
			reason: "local-edit",
			designData: draftData,
			baseRemoteData: baseData,
		}
		vi.mocked(readDesignDraft).mockResolvedValue(draft)
		const managerInternals = manager as unknown as {
			tryRestoreLocalDraftAfterRemoteLoad: () => Promise<void>
			saveManager: { scheduleAutoSave: () => void }
		}
		managerInternals.saveManager.scheduleAutoSave = vi.fn()

		await managerInternals.tryRestoreLocalDraftAfterRemoteLoad()

		expect(getState().designData).toEqual(remoteData)
		expect(stateBag.setters.setDesignData).not.toHaveBeenCalled()
		expect(getState().conflictState).toEqual(
			expect.objectContaining({
				reason: "draft-remote-advanced",
				localData: expect.objectContaining({ canvas: { elements: [] } }),
				remoteData,
			}),
		)
		expect(managerInternals.saveManager.scheduleAutoSave).not.toHaveBeenCalled()
	})
})
