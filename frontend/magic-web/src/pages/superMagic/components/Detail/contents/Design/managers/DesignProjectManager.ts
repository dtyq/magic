import { SuperMagicApi } from "@/apis"
import type { DesignData } from "../types"
import { getDataToCompare } from "./types"
import type { DesignProjectStateBag, DesignProjectManagerOptions } from "./types"
import {
	DesignRemoteListenerOptions,
	DesignRemoteListener,
	LoadAndApplyRemoteFn,
	WaitForAttachmentsUpdateFn,
} from "./DesignRemoteListener"
import { DesignLoadManager } from "./DesignLoadManager"
import { DesignSaveManager } from "./DesignSaveManager"
import { DesignVersionManager } from "./DesignVersionManager"
import { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"

export interface DesignProjectManagerFactoryParams {
	stateBag: DesignProjectStateBag
	options: DesignProjectManagerOptions
	getFileVersionsList: () => FileHistoryVersion[]
	getFileVersion: () => number | undefined
	waitForAttachmentsUpdate: WaitForAttachmentsUpdateFn
}

export interface DesignProjectManagerAPI {
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

	getRemoteListener: () => DesignRemoteListener | null
}

export class DesignProjectManager implements DesignProjectManagerAPI {
	magicProjectJsFileId: string | null
	designData: DesignData
	updateDesignData: (updater: (draft: DesignData) => void) => void
	updateDesignDataAndScheduleSave: (updater: (draft: DesignData) => void) => void

	isInitialLoading: boolean
	isSaving: boolean

	fileVersionsList: FileHistoryVersion[]
	fileVersion: number | undefined
	isReadOnly: boolean
	isProcessingRevoke: boolean
	revokeType: "revoke" | "restore" | null

	private loadManager: DesignLoadManager
	private saveManager: DesignSaveManager
	private versionManager: DesignVersionManager
	private remoteListener: DesignRemoteListener | null = null

	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private getFileVersionsList: () => FileHistoryVersion[]
	private getFileVersion: () => number | undefined
	private getIsReadOnly: () => boolean

	constructor(params: DesignProjectManagerFactoryParams) {
		const { stateBag, options, getFileVersionsList, getFileVersion, waitForAttachmentsUpdate } =
			params

		this.stateBag = stateBag
		this.options = options
		this.getFileVersionsList = getFileVersionsList
		this.getFileVersion = getFileVersion
		this.getIsReadOnly = () => stateBag.getIsReadOnly()

		this.magicProjectJsFileId = null
		this.designData = {
			type: "design",
			name: "",
			version: "1.0.0",
			canvas: { elements: [] },
		}
		this.updateDesignData = () => { }
		this.updateDesignDataAndScheduleSave = () => { }
		this.isInitialLoading = true
		this.isSaving = false
		this.fileVersionsList = []
		this.fileVersion = undefined
		this.isReadOnly =
			!options.allowEdit || options.isPlaybackMode || options.isShareRoute || options.isMobile
		this.isProcessingRevoke = false
		this.revokeType = null

		this.loadManager = new DesignLoadManager(stateBag, options)
		this.saveManager = new DesignSaveManager(stateBag, options, async () => {
			// Will be set after versionManager is created
			return []
		})
		this.versionManager = new DesignVersionManager(
			stateBag,
			options,
			this.saveManager,
			getFileVersionsList,
			getFileVersion,
		)
		this.saveManager.updateFetchAndSetVersions(() => this.versionManager.fetchFileVersions())

		const loadAndApplyRemote: LoadAndApplyRemoteFn = async (
			updateType: "message" | "revoke" | "restore" = "message",
		) => {
			const fid = this.stateBag.getMagicProjectJsFileId()
			if (!fid) return

			try {
				const { data } = await this.versionManager.loadLatest()
				if (data) {
					const newData = JSON.parse(JSON.stringify(data)) as DesignData
					const oldData = this.stateBag.getDesignData()
					this.saveManager.cancelAutoSave()
					this.stateBag.setters.setIsSaving(false)
					this.stateBag.setters.setDesignData(newData)
					this.stateBag.setPrevDesignDataStr(JSON.stringify(getDataToCompare(newData)))
					this.options.onRemoteDesignDataUpdate?.(oldData, newData, updateType)
				}
			} catch {
				// ignore
			}
		}

		const listenerOptions: DesignRemoteListenerOptions = {
			...options,
			getMagicProjectJsFileId: () => this.stateBag.getMagicProjectJsFileId(),
			getDesignDataName: () => this.stateBag.getDesignData().name,
			fetchAndSetVersions: () => this.versionManager.fetchFileVersions(),
			loadAndApplyRemote,
			waitForAttachmentsUpdate,
			updateListenerDebounceMs: options.updateListenerDebounceMs ?? 200,
			setIsProcessingRevoke: (v) => this.stateBag.setters.setIsProcessingRevoke(v),
			setRevokeType: (v) => this.stateBag.setters.setRevokeType(v),
		}

		this.remoteListener = new DesignRemoteListener(listenerOptions)
	}

	updateOptions(options: DesignProjectManagerOptions): void {
		this.options = options
		this.loadManager.updateOptions(options)
		this.saveManager.updateOptions(options)
		this.versionManager.updateOptions(options)
		this.remoteListener?.updateOptions({
			...options,
			getMagicProjectJsFileId: () => this.stateBag.getMagicProjectJsFileId(),
			getDesignDataName: () => this.stateBag.getDesignData().name,
			fetchAndSetVersions: () => this.versionManager.fetchFileVersions(),
		})
	}

	scheduleAutoSave(): void {
		this.saveManager.scheduleAutoSave()
	}

	cancelAutoSave(): void {
		this.saveManager.cancelAutoSave()
	}

	async manualSave(): Promise<void> {
		await this.saveManager.manualSave()
	}

	syncDesignData(newDesignData: DesignData): void {
		this.saveManager.syncDesignData(newDesignData)
	}

	async loadFromRemote(): Promise<void> {
		await this.loadManager.loadFromRemote()
	}

	async resetAndReload(): Promise<void> {
		await this.loadManager.resetAndReload()
	}

	async saveToRemote(): Promise<void> {
		if (this.getIsReadOnly()) return
		const fid = this.stateBag.getMagicProjectJsFileId()
		if (!fid) return

		const content = this.saveManager.generateContent(this.stateBag.getDesignData())
		if (!content?.trim()) return

		await SuperMagicApi.saveFileContent([{ file_id: fid, content, enable_shadow: true }])

		if (!this.options.isShareRoute) {
			try {
				const fileInfo = await SuperMagicApi.getFileInfo({ file_id: fid })
				if (fileInfo?.version !== undefined) {
					this.stateBag.setMagicProjectJsVersion(fileInfo.version)
				}
			} catch {
				// ignore
			}
		}
	}

	generateContent(data?: DesignData): string {
		return this.saveManager.generateContent(data)
	}

	loadWithVersion(version: number): Promise<DesignData | null> {
		return this.versionManager.loadWithVersion(version)
	}

	loadLatest(): Promise<{ data: DesignData | null; version: number | null }> {
		return this.versionManager.loadLatest()
	}

	checkRemoteUpdate(): Promise<{ hasUpdate: boolean; currentVersion: number | null }> {
		return this.saveManager.checkRemoteUpdate()
	}

	updateLocalVersion(version: number): void {
		this.saveManager.updateLocalVersion(version)
	}

	get isNewestVersion(): boolean {
		const list = this.getFileVersionsList()
		const fileVersion = this.getFileVersion()
		if (!list?.length) return true
		if (!fileVersion) return true
		return fileVersion === list[0].version
	}

	handleChangeFileVersion(version: number, isNewestVersion: boolean): Promise<void> {
		return this.versionManager.handleChangeFileVersion(version, isNewestVersion)
	}

	handleReturnLatest(): void {
		this.versionManager.handleReturnLatest()
	}

	handleVersionRollback(version?: number): Promise<void> {
		return this.versionManager.handleVersionRollback(version)
	}

	fetchFileVersions(): Promise<FileHistoryVersion[]> {
		return this.versionManager.fetchFileVersions()
	}

	setIsReadOnly(value: boolean): void {
		this.stateBag.setters.setIsReadOnly(value)
	}

	getRemoteListener(): DesignRemoteListener | null {
		return this.remoteListener
	}
}
