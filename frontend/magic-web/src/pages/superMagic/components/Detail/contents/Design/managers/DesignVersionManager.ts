import magicToast from "@/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/apis"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import {
	loadMagicProjectJsContent,
	resolveDesignProjectBasePathFromAttachments,
} from "../utils/utils"
import { hashDesignDataComparable } from "../utils/designContentHash"
import { getHydratedElementDetailsProvenance } from "../utils/elementDetailsIo"
import {
	getDesignBaseAccessMode,
	getDesignRequestIdentity,
	type DesignProjectStateBag,
	type DesignProjectManagerOptions,
	type DesignCurrentFileLoadResult,
} from "./types"
import type { DesignData } from "../types"
import type { DesignSaveManager } from "./DesignSaveManager"
import {
	DesignLoadError,
	loadDesignDataToRuntime,
	type LoadDesignDataToRuntimeResult,
} from "../utils/designDataLoader"
import { MAGIC_PROJECT_VERSION_V3 } from "../utils/magicProjectCompression"
import { stringifyUnknownError } from "@/utils/error"

export class DesignVersionManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private saveManager: DesignSaveManager

	private getFileVersion: () => number | undefined

	private getBaseAccessMode() {
		// `stateBag.getAccessMode()` is the transient effective mode and becomes
		// `history` while a historical version is displayed. The base mode must
		// come from the stable Design entry options so returning to latest can
		// restore edit/readonly/share correctly.
		return getDesignBaseAccessMode(this.options)
	}

	constructor(
		stateBag: DesignProjectStateBag,
		options: DesignProjectManagerOptions,
		saveManager: DesignSaveManager,
		getFileVersion: () => number | undefined,
		private readCurrentFile: (
			fileId: string,
			options: DesignProjectManagerOptions,
		) => Promise<DesignCurrentFileLoadResult>,
	) {
		this.stateBag = stateBag
		this.options = options
		this.saveManager = saveManager
		this.getFileVersion = getFileVersion
	}

	updateOptions(options: DesignProjectManagerOptions) {
		this.options = options
	}

	async loadWithVersion(version: number): Promise<DesignData | null> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId) return null

		const requestOptions = this.options
		let content: string
		try {
			content = await loadMagicProjectJsContent(magicProjectJsFileId, {
				file_versions: { [magicProjectJsFileId]: version },
				fileApi: requestOptions.fileApi,
			})
		} catch (error) {
			throw new DesignLoadError({
				kind: "invalid-envelope",
				stage: "parse-envelope",
				message: stringifyUnknownError(error),
				fileId: magicProjectJsFileId,
			})
		}
		const dslBase = resolveDesignProjectBasePathFromAttachments(requestOptions)
		const loaded = await loadDesignDataToRuntime({
			content,
			sidecarMode: "none",
			fileId: magicProjectJsFileId,
			pathContext: {
				projectBasePath: dslBase,
				flatAttachments: requestOptions.flatAttachments,
				attachmentIndex: requestOptions.attachmentIndex,
			},
		})
		if (
			magicProjectJsFileId !== this.stateBag.getMagicProjectJsFileId() ||
			getDesignRequestIdentity(requestOptions) !== getDesignRequestIdentity(this.options)
		)
			return null
		return loaded.data
	}

	async loadLatest(): Promise<DesignCurrentFileLoadResult> {
		const fileId = this.stateBag.getMagicProjectJsFileId()
		const requestOptions = this.options
		if (!fileId)
			return {
				fileId: null,
				accessIdentity: getDesignRequestIdentity(requestOptions),
				data: null,
			}
		return this.readCurrentFile(fileId, requestOptions)
	}

	/** 重新加载当前正在查看的历史版本，不能退回到最新版本。 */
	async reloadCurrentVersion(): Promise<void> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		const fileVersion = this.getFileVersion()
		if (!magicProjectJsFileId || fileVersion === undefined) return

		try {
			const parsedDesignData = await this.loadWithVersion(fileVersion)
			if (!parsedDesignData) return

			this.stateBag.setters.setFileVersion(fileVersion)
			this.applyVersionData(parsedDesignData, true)
		} catch (error) {
			if (error instanceof DesignLoadError) {
				this.stateBag.setters.setDesignLoadIssue?.(error.issue)
			}
		}
	}

	async fetchFileVersions(): Promise<FileHistoryVersion[]> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (this.getBaseAccessMode() === "share" || !magicProjectJsFileId) return []

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
		this.saveManager.clearRemoteConflict()
		this.stateBag.setters.setConflictState(null)
		this.stateBag.setters.setIsSaving(false)
		this.stateBag.setters.setElementDetailsProvenance?.(
			getHydratedElementDetailsProvenance(parsedDesignData) ?? {},
		)
		this.stateBag.setters.setDesignData(parsedDesignData)
		if (isViewingHistory) {
			this.stateBag.setters.setPendingDesignUpgrade?.(null)
			this.stateBag.setters.setDesignLoadIssue?.(undefined)
			this.stateBag.setters.setSidecarStatus?.("skipped-history")
		}
		if (!isViewingHistory)
			this.stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(parsedDesignData))
		this.stateBag.setters.setAccessMode(isViewingHistory ? "history" : this.getBaseAccessMode())
		this.options.onVersionChange?.(parsedDesignData, isViewingHistory)
	}

	async handleChangeFileVersion(
		version: number | undefined,
		isNewestVersionTarget: boolean,
	): Promise<boolean> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (!magicProjectJsFileId || (!isNewestVersionTarget && version === undefined)) return false

		const fileVersion = this.getFileVersion()
		if (fileVersion === version && !isNewestVersionTarget) return false

		try {
			let parsedDesignData: DesignData | null
			let latestLoadResult: LoadDesignDataToRuntimeResult | undefined
			if (isNewestVersionTarget) {
				const result = await this.loadLatest()
				if (
					result.fileId !== this.stateBag.getMagicProjectJsFileId() ||
					result.accessIdentity !== getDesignRequestIdentity(this.options)
				)
					return false
				parsedDesignData = result.data
				latestLoadResult = result.loadResult
				this.stateBag.setters.setDesignLoadIssue?.(result.loadResult?.issue)
				this.stateBag.setters.setSidecarStatus?.(
					result.loadResult?.sidecarStatus ?? "missing",
				)
				if (result.loadResult?.needsPersist) {
					this.stateBag.setters.setPendingDesignUpgrade?.({
						reason: "legacy-dsl",
						fileId: magicProjectJsFileId,
						sourceVersion: result.loadResult.sourceVersion,
						targetVersion: MAGIC_PROJECT_VERSION_V3,
						createdAt: Date.now(),
					})
				}
			} else {
				parsedDesignData = await this.loadWithVersion(version as number)
			}

			if (parsedDesignData) {
				this.stateBag.setters.setFileVersion(isNewestVersionTarget ? undefined : version)
				this.applyVersionData(parsedDesignData, !isNewestVersionTarget)
				if (isNewestVersionTarget && latestLoadResult?.sidecarStatus === "unsupported") {
					this.stateBag.setters.setAccessMode("readonly")
				}
				return true
			}
		} catch (error) {
			if (error instanceof DesignLoadError) {
				this.stateBag.setters.setDesignLoadIssue?.(error.issue)
			}
		}
		return false
	}

	async handleReturnLatest(): Promise<boolean> {
		return this.handleChangeFileVersion(undefined, true)
	}

	async handleVersionRollback(version: number | undefined): Promise<boolean> {
		const magicProjectJsFileId = this.stateBag.getMagicProjectJsFileId()
		if (this.getBaseAccessMode() === "share" || !magicProjectJsFileId || !version) return false

		try {
			const res = await SuperMagicApi.rollbackFileVersion({
				file_id: magicProjectJsFileId,
				version,
			})
			if (res) {
				await this.fetchFileVersions()
				const didApply = await this.handleReturnLatest()
				const t = this.options.getT?.() ?? ((k: string) => k)
				magicToast.success(t("common.rollbackSuccess"))
				return didApply
			}
		} catch {
			const t = this.options.getT?.() ?? ((k: string) => k)
			magicToast.error(t("design.errors.rollbackFailed"))
		}
		return false
	}
}
