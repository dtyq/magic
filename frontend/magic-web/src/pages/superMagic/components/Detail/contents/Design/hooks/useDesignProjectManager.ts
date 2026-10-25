import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { produce } from "immer"
import { useImmer } from "use-immer"
import { useMount, useUnmount } from "ahooks"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import { DesignData } from "../types"
import {
	DesignProjectManager,
	type DesignConflict,
	type PendingDesignUpgrade,
	type DesignProjectManagerOptions,
	type DesignProjectStateBag,
	type DesignSaveMetadata,
} from "../managers"
import { MAGIC_PROJECT_VERSION_V3 } from "../utils/magicProjectCompression"
import type { DesignDraftReason, DesignDraftWriteResult } from "../utils/designDraftStorage"
import type { ElementDetailsProvenance } from "@/components/CanvasDesign/runtime/document"
import type { DesignLoadIssue, DesignSidecarStatus } from "../utils/designDataLoader"
import type { DesignCurrentFileLoadResult } from "../managers/types"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"
import { resolveDesignAccessMode } from "../managers/types"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

export type UseDesignProjectManagerOptions = DesignProjectManagerOptions

export interface UseDesignProjectManagerReturn {
	magicProjectJsFileId: string | null
	designData: DesignData
	elementDetailsProvenance: ElementDetailsProvenance
	setElementDetailsProvenance: (provenance: ElementDetailsProvenance) => void
	updateDesignData: (updater: (draft: DesignData) => void) => void
	updateDesignDataAndScheduleSave: (
		updater: (draft: DesignData) => void,
		metadata?: DesignSaveMetadata,
	) => void

	isInitialLoading: boolean
	isSaving: boolean
	pendingDesignUpgrade: PendingDesignUpgrade | null
	designLoadIssue: DesignLoadIssue | undefined
	sidecarStatus: DesignSidecarStatus
	clearDesignLoadIssue: () => void

	scheduleAutoSave: (metadata?: DesignSaveMetadata) => void
	cancelAutoSave: () => void
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

	accessMode: CanvasAccessMode
	setAccessMode: (value: CanvasAccessMode) => void

	isProcessingRevoke: boolean
	revokeType: "revoke" | "restore" | null
	conflictState: DesignConflict | null
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

	fileVersionsList: FileHistoryVersion[]
	fileVersion: number | undefined
	isNewestVersion: boolean
	handleChangeFileVersion: (version: number, isNewestVersion: boolean) => Promise<void>
	handleReturnLatest: () => Promise<void>
	handleVersionRollback: (version?: number) => Promise<void>
	fetchFileVersions: () => Promise<FileHistoryVersion[]>
}

const INITIAL_DESIGN_DATA: DesignData = {
	type: "design",
	name: "",
	version: MAGIC_PROJECT_VERSION_V3,
	canvas: { elements: [] },
}

function getTopLevelElementCount(data: DesignData | null | undefined): number {
	return data?.canvas?.elements?.length ?? 0
}

export function useDesignProjectManager(
	options: UseDesignProjectManagerOptions,
): UseDesignProjectManagerReturn {
	const { t } = useTranslation("super")
	// Bind the ambient file identity once here; managers live outside React and
	// receive this closure instead of each helper sprouting an `access` param.
	const fileApi = useFileApi()

	const [magicProjectJsFileId, setMagicProjectJsFileId] = useState<string | null>(null)
	const [designData, updateDesignData] = useImmer<DesignData>(INITIAL_DESIGN_DATA)
	const [elementDetailsProvenance, setElementDetailsProvenanceState] =
		useState<ElementDetailsProvenance>({})
	const [isInitialLoading, setIsInitialLoading] = useState(true)
	const [accessMode, setAccessMode] = useState<CanvasAccessMode>(() =>
		resolveDesignAccessMode(options),
	)
	const [isSaving, setIsSaving] = useState(false)
	const [pendingDesignUpgrade, setPendingDesignUpgrade] = useState<PendingDesignUpgrade | null>(
		null,
	)
	const [designLoadIssue, setDesignLoadIssueState] = useState<DesignLoadIssue | undefined>()
	const [sidecarStatus, setSidecarStatusState] = useState<DesignSidecarStatus>("missing")
	const [fileVersionsList, setFileVersionsList] = useState<FileHistoryVersion[]>([])
	const [fileVersion, setFileVersion] = useState<number | undefined>(undefined)
	const [isProcessingRevoke, setIsProcessingRevoke] = useState(false)
	const [revokeType, setRevokeType] = useState<"revoke" | "restore" | null>(null)
	const [conflictState, setConflictState] = useState<DesignConflict | null>(null)

	const designDataRef = useRef(designData)
	const elementDetailsProvenanceRef = useRef(elementDetailsProvenance)
	const pendingDesignUpgradeRef = useRef<PendingDesignUpgrade | null>(pendingDesignUpgrade)
	const designLoadIssueRef = useRef<DesignLoadIssue | undefined>(designLoadIssue)
	const sidecarStatusRef = useRef<DesignSidecarStatus>(sidecarStatus)
	const conflictStateRef = useRef<DesignConflict | null>(conflictState)
	const magicProjectJsFileIdRef = useRef<string | null>(null)
	const accessModeRef = useRef(accessMode)
	const prevDesignDataFingerprintRef = useRef<string>("")
	const fileVersionsListRef = useRef<FileHistoryVersion[]>([])
	const fileVersionRef = useRef<number | undefined>(undefined)

	designDataRef.current = designData
	elementDetailsProvenanceRef.current = elementDetailsProvenance
	pendingDesignUpgradeRef.current = pendingDesignUpgrade
	designLoadIssueRef.current = designLoadIssue
	sidecarStatusRef.current = sidecarStatus
	conflictStateRef.current = conflictState
	magicProjectJsFileIdRef.current = magicProjectJsFileId
	accessModeRef.current = accessMode
	fileVersionsListRef.current = fileVersionsList
	fileVersionRef.current = fileVersion

	const updateDesignDataState = useCallback(
		(updater: (draft: DesignData) => void) => {
			const nextData = produce(designDataRef.current, updater)
			designDataRef.current = nextData
			updateDesignData(() => nextData)
		},
		[updateDesignData],
	)

	const stateBag: DesignProjectStateBag = useMemo(
		() => ({
			getDesignData: () => designDataRef.current,
			getElementDetailsProvenance: () => elementDetailsProvenanceRef.current,
			getPendingDesignUpgrade: () => pendingDesignUpgradeRef.current,
			getDesignLoadIssue: () => designLoadIssueRef.current,
			getSidecarStatus: () => sidecarStatusRef.current,
			getConflictState: () => conflictStateRef.current,
			getMagicProjectJsFileId: () => magicProjectJsFileIdRef.current,
			getPrevDesignDataFingerprint: () => prevDesignDataFingerprintRef.current,
			setPrevDesignDataFingerprint: (v) => {
				prevDesignDataFingerprintRef.current = v
			},
			getAccessMode: () => accessModeRef.current,
			setters: {
				setMagicProjectJsFileId,
				setDesignData: (data) => {
					designDataRef.current = data
					updateDesignData(() => data)
				},
				setElementDetailsProvenance: (provenance) => {
					elementDetailsProvenanceRef.current = provenance
					setElementDetailsProvenanceState(provenance)
				},
				setPendingDesignUpgrade: (upgrade) => {
					pendingDesignUpgradeRef.current = upgrade
					setPendingDesignUpgrade(upgrade)
				},
				setDesignLoadIssue: (issue) => {
					designLoadIssueRef.current = issue
					setDesignLoadIssueState(issue)
				},
				setSidecarStatus: (status) => {
					sidecarStatusRef.current = status
					setSidecarStatusState(status)
				},
				setIsInitialLoading,
				setIsSaving,
				setAccessMode: (v) => {
					accessModeRef.current = v
					setAccessMode(v)
				},
				setFileVersionsList,
				setFileVersion,
				setIsProcessingRevoke,
				setRevokeType,
				setConflictState: (v) => {
					conflictStateRef.current = v
					setConflictState(v)
				},
			},
		}),
		[updateDesignData],
	)

	const managerRef = useRef<DesignProjectManager | null>(null)
	if (!managerRef.current) {
		managerRef.current = new DesignProjectManager({
			stateBag,
			options: {
				...options,
				accessMode: resolveDesignAccessMode(options),
				isOffline: options.isOffline,
				getT: () => t,
				fileApi,
			},
			getFileVersionsList: () => fileVersionsListRef.current,
			getFileVersion: () => fileVersionRef.current,
		})
	}

	const manager = managerRef.current

	useLayoutEffect(() => {
		manager.updateOptions({
			...options,
			accessMode: resolveDesignAccessMode(options),
			isOffline: options.isOffline,
			getT: () => t,
			fileApi,
		})
	}, [manager, options, t, fileApi])

	useEffect(() => {
		if (options.isShareRoute || !magicProjectJsFileId) return
		manager.fetchFileVersions()
	}, [manager, magicProjectJsFileId, options.isShareRoute])

	useMount(() => {
		manager.getRemoteListener()?.mount()
	})

	useUnmount(() => {
		manager.getRemoteListener()?.unmount()
	})

	const updateDesignDataAndScheduleSave = useCallback(
		(updater: (draft: DesignData) => void, metadata?: DesignSaveMetadata) => {
			if (!manager.canUpdateCurrentDesignData()) {
				return
			}
			const previousData = designDataRef.current
			const nextData = produce(previousData, updater)
			designDataRef.current = nextData
			updateDesignData(() => nextData)
			manager.persistLocalDraft(nextData)
			manager.scheduleAutoSave({
				...metadata,
				beforeElementCount:
					metadata?.beforeElementCount ?? getTopLevelElementCount(previousData),
				nextElementCount: metadata?.nextElementCount ?? getTopLevelElementCount(nextData),
			})
		},
		[updateDesignData, manager],
	)

	const isNewestVersion = fileVersion === undefined

	const loadFromRemote = useCallback(() => manager.loadFromRemote(), [manager])
	const reloadPreservingLocalDraft = useCallback(
		() => manager.reloadPreservingLocalDraft(),
		[manager],
	)
	const reloadDiscardingLocalDraft = useCallback(
		() => manager.reloadDiscardingLocalDraft(),
		[manager],
	)

	return {
		magicProjectJsFileId,
		designData,
		elementDetailsProvenance,
		setElementDetailsProvenance: (provenance) => {
			elementDetailsProvenanceRef.current = provenance
			setElementDetailsProvenanceState(provenance)
		},
		updateDesignData: updateDesignDataState,
		updateDesignDataAndScheduleSave,

		isInitialLoading,
		isSaving,
		pendingDesignUpgrade,
		designLoadIssue,
		sidecarStatus,
		clearDesignLoadIssue: () => {
			designLoadIssueRef.current = undefined
			setDesignLoadIssueState(undefined)
		},

		scheduleAutoSave: (metadata) => manager.scheduleAutoSave(metadata),
		cancelAutoSave: () => manager.cancelAutoSave(),
		persistLocalDraft: (data, persistOptions) =>
			manager.persistLocalDraft(data, persistOptions),
		persistLocalDraftAndWait: (data, persistOptions) =>
			manager.persistLocalDraftAndWait(data, persistOptions),
		hasUnsavedChanges: (data) => manager.hasUnsavedChanges(data),
		manualSave: (data) => manager.manualSave(data),
		syncDesignData: (data) => manager.syncDesignData(data),
		persistPendingDesignUpgrade: () => manager.persistPendingDesignUpgrade(),

		loadFromRemote,
		reloadPreservingLocalDraft,
		reloadCurrentVersion: () => manager.reloadCurrentVersion(),
		reloadDiscardingLocalDraft,

		saveToRemote: () => manager.saveToRemote(),
		generateContent: (data) => manager.generateContent(data),

		loadWithVersion: (v) => manager.loadWithVersion(v),
		loadLatest: () => manager.loadLatest(),

		checkRemoteUpdate: () => manager.checkRemoteUpdate(),

		accessMode,
		setAccessMode: (v) => manager.setAccessMode(v),

		isProcessingRevoke,
		revokeType,
		conflictState,
		clearConflictState: () => manager.clearConflictState(),
		resolveBlockingConflictWithRemote: () => manager.resolveBlockingConflictWithRemote(),
		resolveBlockingConflictWithLocal: () => manager.resolveBlockingConflictWithLocal(),
		resolveElementConflictWithLocal: (elementId) =>
			manager.resolveElementConflictWithLocal(elementId),
		resolveElementConflictWithRemote: (elementId) =>
			manager.resolveElementConflictWithRemote(elementId),
		resolveConnectionConflictWithLocal: (connectionId) =>
			manager.resolveConnectionConflictWithLocal(connectionId),
		resolveConnectionConflictWithRemote: (connectionId) =>
			manager.resolveConnectionConflictWithRemote(connectionId),
		resolveEditedElementConflictsWithLocal: (elementIds, nextDesignData, metadata) =>
			manager.resolveEditedElementConflictsWithLocal(elementIds, nextDesignData, metadata),

		fileVersionsList,
		fileVersion,
		isNewestVersion,
		handleChangeFileVersion: (v, isNew) => manager.handleChangeFileVersion(v, isNew),
		handleReturnLatest: () => manager.handleReturnLatest(),
		handleVersionRollback: (ver) => manager.handleVersionRollback(ver),
		fetchFileVersions: () => manager.fetchFileVersions(),
	}
}
