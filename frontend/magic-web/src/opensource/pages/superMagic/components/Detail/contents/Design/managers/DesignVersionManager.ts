import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/opensource/apis"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { loadMagicProjectJsContent, parseMagicProjectJsContent } from "../utils/utils"
import {
	getDataToCompare,
	type DesignProjectStateBag,
	type DesignProjectManagerOptions,
} from "./types"
import type { DesignData } from "../types"
import type { DesignSaveManager } from "./DesignSaveManager"

export class DesignVersionManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private saveManager: DesignSaveManager

	private getFileVersionsList: () => FileHistoryVersion[]
	private getFileVersion: () => number | undefined

	constructor(
		stateBag: DesignProjectStateBag,
		options: DesignProjectManagerOptions,
		saveManager: DesignSaveManager,
		getFileVersionsList: () => FileHistoryVersion[],
		getFileVersion: () => number | undefined,
	) {
		this.stateBag = stateBag
		this.options = options
		this.saveManager = saveManager
		this.getFileVersionsList = getFileVersionsList
		this.getFileVersion = getFileVersion
	}

	updateOptions(options: DesignProjectManagerOptions) {
		this.options = options
	}

	async loadWithVersion(version: number): Promise<DesignData | null> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) return null

		const content = await loadMagicProjectJsContent(magicProjectJsFileId, {
			file_versions: { [magicProjectJsFileId]: version },
		})
		return parseMagicProjectJsContent(content)
	}

	async loadLatest(): Promise<{ data: DesignData | null; version: number | null }> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) return { data: null, version: null }

		const content = await loadMagicProjectJsContent(magicProjectJsFileId)
		const data = parseMagicProjectJsContent(content)

		let version: number | null = null
		if (!this.options.isShareRoute) {
			try {
				const fileInfo = await SuperMagicApi.getFileInfo({
					file_id: magicProjectJsFileId,
				})
				if (fileInfo?.version !== undefined) {
					version = fileInfo.version
					this.stateBag.setMagicProjectJsVersion(version)
				}
			} catch {
				// ignore
			}
		}

		return { data, version }
	}

	async fetchFileVersions(): Promise<FileHistoryVersion[]> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (this.options.isShareRoute || !magicProjectJsFileId) return []

		try {
			const res = await SuperMagicApi.getFileHistoryVersions({
				file_id: magicProjectJsFileId,
				page_size: 10,
			})
			const list = res?.list ?? []
			this.stateBag.setters.setFileVersionsList(list)
			return list
		} catch {
			return []
		}
	}

	applyVersionData(parsedDesignData: DesignData, isViewingHistory: boolean): void {
		this.saveManager.cancelAutoSave()
		this.stateBag.setters.setIsSaving(false)
		this.stateBag.setters.setDesignData(parsedDesignData)
		this.stateBag.setPrevDesignDataStr(JSON.stringify(getDataToCompare(parsedDesignData)))
		this.stateBag.setters.setIsReadOnly(
			!this.options.allowEdit ||
				this.options.isPlaybackMode ||
				isViewingHistory ||
				this.options.isShareRoute ||
				this.options.isMobile,
		)
		this.options.onVersionChange?.(parsedDesignData, isViewingHistory)
	}

	async handleChangeFileVersion(version: number, isNewestVersionTarget: boolean): Promise<void> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) return

		const fileVersion = this.getFileVersion()
		if (fileVersion === version && !isNewestVersionTarget) return
		if (!fileVersion && isNewestVersionTarget) return

		try {
			let parsedDesignData: DesignData | null
			if (isNewestVersionTarget) {
				const result = await this.loadLatest()
				parsedDesignData = result.data
			} else {
				parsedDesignData = await this.loadWithVersion(version)
			}

			if (parsedDesignData) {
				this.stateBag.setters.setFileVersion(isNewestVersionTarget ? undefined : version)
				this.applyVersionData(parsedDesignData, !isNewestVersionTarget)
			}
		} catch {
			// ignore
		}
	}

	handleReturnLatest(): void {
		const list = this.getFileVersionsList()
		if (list?.length > 0) {
			this.handleChangeFileVersion(list[0].version, true)
		} else {
			this.stateBag.setters.setFileVersion(undefined)
		}
	}

	async handleVersionRollback(version: number | undefined): Promise<void> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (this.options.isShareRoute || !magicProjectJsFileId || !version) return

		try {
			const res = await SuperMagicApi.rollbackFileVersion({
				file_id: magicProjectJsFileId,
				version,
			})
			if (res) {
				await this.fetchFileVersions()
				this.stateBag.setters.setFileVersion(undefined)
				const { data } = await this.loadLatest()
				if (data) {
					this.applyVersionData(data, false)
				}
				const t = this.options.getT?.() ?? ((k: string) => k)
				magicToast.success(t("common.rollbackSuccess"))
			}
		} catch {
			const t = this.options.getT?.() ?? ((k: string) => k)
			magicToast.error(t("design.errors.rollbackFailed"))
		}
	}
}
