import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useImmer } from "use-immer"
import { useMount, useUnmount } from "ahooks"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { DesignData } from "../types"
import {
	DesignProjectManager,
	type DesignProjectManagerOptions,
	type DesignProjectStateBag,
} from "../managers"
import type { WaitForAttachmentsUpdateFn } from "../managers/DesignRemoteListener"

export interface UseDesignProjectManagerOptions extends DesignProjectManagerOptions {
	/** 等待附件列表更新完成的回调函数 */
	waitForAttachmentsUpdate: WaitForAttachmentsUpdateFn
}

export interface UseDesignProjectManagerReturn {
	magicProjectJsFileId: string | null
	designData: DesignData
	updateDesignData: (updater: (draft: DesignData) => void) => void
	updateDesignDataAndScheduleSave: (updater: (draft: DesignData) => void) => void

	isInitialLoading: boolean
	isSaving: boolean

	scheduleAutoSave: () => void
	cancelAutoSave: () => void
	manualSave: () => Promise<void>
	syncDesignData: (newDesignData: DesignData) => void

	loadFromRemote: () => Promise<void>
	resetAndReload: () => Promise<void>

	saveToRemote: () => Promise<void>
	generateContent: (data?: DesignData) => string

	loadWithVersion: (version: number) => Promise<DesignData | null>
	loadLatest: () => Promise<{ data: DesignData | null; version: number | null }>

	checkRemoteUpdate: () => Promise<{ hasUpdate: boolean; currentVersion: number | null }>
	updateLocalVersion: (version: number) => void

	isReadOnly: boolean
	setIsReadOnly: (value: boolean) => void

	isProcessingRevoke: boolean
	revokeType: "revoke" | "restore" | null

	fileVersionsList: FileHistoryVersion[]
	fileVersion: number | undefined
	isNewestVersion: boolean
	handleChangeFileVersion: (version: number, isNewestVersion: boolean) => Promise<void>
	handleReturnLatest: () => void
	handleVersionRollback: (version?: number) => Promise<void>
	fetchFileVersions: () => Promise<FileHistoryVersion[]>
}

const INITIAL_DESIGN_DATA: DesignData = {
	type: "design",
	name: "",
	version: "1.0.0",
	canvas: { elements: [] },
}

export function useDesignProjectManager(
	options: UseDesignProjectManagerOptions,
): UseDesignProjectManagerReturn {
	const { t } = useTranslation("super")

	const [magicProjectJsFileId, setMagicProjectJsFileId] = useState<string | null>(null)
	const [designData, updateDesignData] = useImmer<DesignData>(INITIAL_DESIGN_DATA)
	const [isInitialLoading, setIsInitialLoading] = useState(true)
	const [isReadOnly, setIsReadOnly] = useState(
		!options.allowEdit || options.isPlaybackMode || options.isShareRoute || options.isMobile,
	)
	const [isSaving, setIsSaving] = useState(false)
	const [fileVersionsList, setFileVersionsList] = useState<FileHistoryVersion[]>([])
	const [fileVersion, setFileVersion] = useState<number | undefined>(undefined)
	const [isProcessingRevoke, setIsProcessingRevoke] = useState(false)
	const [revokeType, setRevokeType] = useState<"revoke" | "restore" | null>(null)

	const designDataRef = useRef(designData)
	const magicProjectJsFileIdRef = useRef<string | null>(null)
	const isReadOnlyRef = useRef(isReadOnly)
	const magicProjectJsVersionRef = useRef<number | null>(null)
	const prevDesignDataStrRef = useRef<string>("")
	const fileVersionsListRef = useRef<FileHistoryVersion[]>([])
	const fileVersionRef = useRef<number | undefined>(undefined)

	designDataRef.current = designData
	magicProjectJsFileIdRef.current = magicProjectJsFileId
	isReadOnlyRef.current = isReadOnly
	fileVersionsListRef.current = fileVersionsList
	fileVersionRef.current = fileVersion

	const stateBag: DesignProjectStateBag = useMemo(
		() => ({
			getDesignData: () => designDataRef.current,
			getMagicProjectJsFileId: () => magicProjectJsFileIdRef.current,
			getMagicProjectJsVersion: () => magicProjectJsVersionRef.current,
			setMagicProjectJsVersion: (v) => {
				magicProjectJsVersionRef.current = v
			},
			getPrevDesignDataStr: () => prevDesignDataStrRef.current,
			setPrevDesignDataStr: (v) => {
				prevDesignDataStrRef.current = v
			},
			getIsReadOnly: () => isReadOnlyRef.current,
			setters: {
				setMagicProjectJsFileId,
				setDesignData: (data) => updateDesignData(() => data),
				setIsInitialLoading,
				setIsSaving,
				setIsReadOnly: (v) => {
					isReadOnlyRef.current = v
					setIsReadOnly(v)
				},
				setFileVersionsList,
				setFileVersion,
				setIsProcessingRevoke,
				setRevokeType,
			},
		}),
		[updateDesignData],
	)

	const { waitForAttachmentsUpdate, ...managerOptions } = options

	const managerRef = useRef<DesignProjectManager | null>(null)
	if (!managerRef.current) {
		managerRef.current = new DesignProjectManager({
			stateBag,
			options: { ...managerOptions, getT: () => t },
			getFileVersionsList: () => fileVersionsListRef.current,
			getFileVersion: () => fileVersionRef.current,
			waitForAttachmentsUpdate,
		})
	}

	const manager = managerRef.current

	useEffect(() => {
		manager.updateOptions({ ...managerOptions, getT: () => t })
	}, [manager, managerOptions, t])

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
		(updater: (draft: DesignData) => void) => {
			updateDesignData(updater)
			manager.scheduleAutoSave()
		},
		[updateDesignData, manager],
	)

	const isNewestVersion = useMemo(() => {
		if (!fileVersionsList?.length) return true
		if (!fileVersion) return true
		return fileVersion === fileVersionsList[0].version
	}, [fileVersion, fileVersionsList])

	return {
		magicProjectJsFileId,
		designData,
		updateDesignData,
		updateDesignDataAndScheduleSave,

		isInitialLoading,
		isSaving,

		scheduleAutoSave: () => manager.scheduleAutoSave(),
		cancelAutoSave: () => manager.cancelAutoSave(),
		manualSave: () => manager.manualSave(),
		syncDesignData: (data) => manager.syncDesignData(data),

		loadFromRemote: () => manager.loadFromRemote(),
		resetAndReload: () => manager.resetAndReload(),

		saveToRemote: () => manager.saveToRemote(),
		generateContent: (data) => manager.generateContent(data),

		loadWithVersion: (v) => manager.loadWithVersion(v),
		loadLatest: () => manager.loadLatest(),

		checkRemoteUpdate: () => manager.checkRemoteUpdate(),
		updateLocalVersion: (v) => manager.updateLocalVersion(v),

		isReadOnly,
		setIsReadOnly: (v) => manager.setIsReadOnly(v),

		isProcessingRevoke,
		revokeType,

		fileVersionsList,
		fileVersion,
		isNewestVersion,
		handleChangeFileVersion: (v, isNew) => manager.handleChangeFileVersion(v, isNew),
		handleReturnLatest: () => manager.handleReturnLatest(),
		handleVersionRollback: (ver) => manager.handleVersionRollback(ver),
		fetchFileVersions: () => manager.fetchFileVersions(),
	}
}
