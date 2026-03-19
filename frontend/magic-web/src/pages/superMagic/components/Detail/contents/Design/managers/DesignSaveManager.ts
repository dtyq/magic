import type { DesignData } from "../types"
import { generateMagicProjectJsContent } from "../utils/utils"
import { SuperMagicApi } from "@/apis"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import {
	getDataToCompare,
	type DesignProjectStateBag,
	type DesignProjectManagerOptions,
} from "./types"

const AUTO_SAVE_DEBOUNCE_MS = 2000

export class DesignSaveManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private fetchAndSetVersions: () => Promise<FileHistoryVersion[]>

	private debounceTimer: ReturnType<typeof setTimeout> | null = null

	constructor(
		stateBag: DesignProjectStateBag,
		options: DesignProjectManagerOptions,
		fetchAndSetVersions: () => Promise<FileHistoryVersion[]>,
	) {
		this.stateBag = stateBag
		this.options = options
		this.fetchAndSetVersions = fetchAndSetVersions
	}

	updateOptions(options: DesignProjectManagerOptions) {
		this.options = options
	}

	updateFetchAndSetVersions(fn: () => Promise<FileHistoryVersion[]>) {
		this.fetchAndSetVersions = fn
	}

	scheduleAutoSave(): void {
		this.runDebouncedSave()
	}

	cancelAutoSave(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		this.stateBag.setters.setIsSaving(false)
	}

	async manualSave(): Promise<void> {
		this.cancelAutoSave()
		this.stateBag.setters.setIsSaving(true)
		await this.commitSave()
		this.stateBag.setPrevDesignDataStr(
			JSON.stringify(getDataToCompare(this.stateBag.getDesignData())),
		)
	}

	syncDesignData(newDesignData: DesignData): void {
		this.stateBag.setPrevDesignDataStr(JSON.stringify(getDataToCompare(newDesignData)))
	}

	private runDebouncedSave(): void {
		const fileId = this.stateBag.getMagicProjectJsFileId()
		if (!fileId) return

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}

		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null
			const currentData = this.stateBag.getDesignData()
			const dataStr = JSON.stringify(getDataToCompare(currentData))

			if (!this.stateBag.getPrevDesignDataStr()) {
				this.stateBag.setPrevDesignDataStr(dataStr)
				return
			}
			if (this.stateBag.getPrevDesignDataStr() === dataStr) {
				this.stateBag.setters.setIsSaving(false)
				return
			}

			this.stateBag.setPrevDesignDataStr(dataStr)
			this.stateBag.setters.setIsSaving(true)
			this.commitSave()
		}, AUTO_SAVE_DEBOUNCE_MS)
	}

	async commitSave(): Promise<void> {
		if (this.stateBag.getIsReadOnly()) {
			this.stateBag.setters.setIsSaving(false)
			return
		}
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) {
			this.stateBag.setters.setIsSaving(false)
			return
		}

		try {
			const { hasUpdate, currentVersion } = await this.checkRemoteUpdate()
			if (hasUpdate) {
				if (currentVersion !== null) this.updateLocalVersion(currentVersion)
				this.stateBag.setters.setIsSaving(false)
				return
			}

			const content = generateMagicProjectJsContent(this.stateBag.getDesignData())
			if (!content?.trim()) {
				this.stateBag.setters.setIsSaving(false)
				return
			}

			await SuperMagicApi.saveFileContent([
				{ file_id: magicProjectJsFileId, content, enable_shadow: true },
			])

			if (!this.options.isShareRoute) {
				try {
					const fileInfo = await SuperMagicApi.getFileInfo({
						file_id: magicProjectJsFileId,
					})
					if (fileInfo?.version !== undefined) {
						this.stateBag.setMagicProjectJsVersion(fileInfo.version)
					}
				} catch {
					// ignore
				}
				await this.fetchAndSetVersions()
			}
		} finally {
			this.stateBag.setters.setIsSaving(false)
		}
	}

	async checkRemoteUpdate(): Promise<{ hasUpdate: boolean; currentVersion: number | null }> {
		if (this.options.isShareRoute) {
			return { hasUpdate: false, currentVersion: null }
		}
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) {
			return { hasUpdate: false, currentVersion: null }
		}

		try {
			const fileInfo = await SuperMagicApi.getFileInfo({ file_id: magicProjectJsFileId })
			if (fileInfo?.version === undefined) {
				return { hasUpdate: false, currentVersion: null }
			}

			const currentVersion = fileInfo.version
			const prevVersion = this.stateBag.getMagicProjectJsVersion()

			if (prevVersion === null) {
				this.stateBag.setMagicProjectJsVersion(currentVersion)
				return { hasUpdate: false, currentVersion }
			}

			return {
				hasUpdate: currentVersion > prevVersion,
				currentVersion,
			}
		} catch {
			return { hasUpdate: false, currentVersion: null }
		}
	}

	updateLocalVersion(version: number): void {
		this.stateBag.setMagicProjectJsVersion(version)
	}

	generateContent(data?: DesignData): string {
		return generateMagicProjectJsContent(data ?? this.stateBag.getDesignData())
	}
}
