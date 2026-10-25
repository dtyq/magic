import {
	findMagicProjectJsFile,
	resolveActualDesignCurrentFile,
	loadMagicProjectJsContent,
	resolveDesignDirectoryNameFromAttachments,
	resolveDesignProjectBasePathFromAttachments,
} from "../utils/utils"
import { hashDesignDataComparable } from "../utils/designContentHash"
import {
	resolveDesignAccessMode,
	getDesignRequestIdentity,
	type DesignProjectStateBag,
	type DesignProjectManagerOptions,
	type PendingDesignUpgrade,
	type DesignCurrentFileLoadResult,
	getDesignBaseAccessMode,
} from "./types"
import {
	DesignLoadError,
	loadDesignDataToRuntime,
	type DesignLoadIssue,
	type DesignSidecarStatus,
} from "../utils/designDataLoader"
import { MAGIC_PROJECT_VERSION_V3 } from "../utils/magicProjectCompression"
import { stringifyUnknownError } from "@/utils/error"

export interface DesignLoadResult {
	didLoad: boolean
	pendingUpgrade: PendingDesignUpgrade | null
	issue?: DesignLoadIssue
	sidecarStatus: DesignSidecarStatus
}

interface DesignLoadRequest {
	identityKey: string
	options: DesignProjectManagerOptions
	currentFile: { id: string; name: string }
}

interface PendingDesignLoad {
	identityKey: string
	promise: Promise<DesignLoadResult>
}

export class DesignLoadManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions
	private pendingLoad: PendingDesignLoad | null = null
	private lastLoadedIdentityKey: string | null = null
	private currentProjectId: string | null = null
	private lastLoadResult: DesignLoadResult | undefined

	constructor(stateBag: DesignProjectStateBag, options: DesignProjectManagerOptions) {
		this.stateBag = stateBag
		this.options = options
	}

	async readCurrentFile(
		fileId: string,
		requestOptions: DesignProjectManagerOptions,
	): Promise<DesignCurrentFileLoadResult> {
		const accessIdentity = getDesignRequestIdentity(requestOptions)
		if (getDesignBaseAccessMode(requestOptions) === "share" && !requestOptions.fileApi)
			throw new DesignLoadError({
				kind: "invalid-envelope",
				stage: "parse-envelope",
				message: "Shared Canvas requires its bound file client",
				fileId,
			})
		try {
			const content = await loadMagicProjectJsContent(fileId, {
				fileApi: requestOptions.fileApi,
				forceRefresh: true,
			})
			const loaded = await loadDesignDataToRuntime({
				content,
				nameOverride: resolveDesignDirectoryNameFromAttachments(requestOptions),
				elementDetailsContext: {
					attachments: requestOptions.attachments,
					flatAttachments: requestOptions.flatAttachments,
					mainFileId: fileId,
					projectId: requestOptions.projectId,
					fileApi: requestOptions.fileApi,
				},
				pathContext: {
					projectBasePath: resolveDesignProjectBasePathFromAttachments(requestOptions),
					flatAttachments: requestOptions.flatAttachments,
					attachmentIndex: requestOptions.attachmentIndex,
				},
				fileId,
			})
			return { fileId, accessIdentity, data: loaded.data, loadResult: loaded }
		} catch (error) {
			if (error instanceof DesignLoadError) throw error
			throw new DesignLoadError({
				kind: "invalid-envelope",
				stage: "parse-envelope",
				message: stringifyUnknownError(error),
				fileId,
			})
		}
	}

	updateOptions(options: DesignProjectManagerOptions) {
		const previousIdentityKey = this.getCurrentLoadIdentity()
		this.options = options
		if (previousIdentityKey !== this.getCurrentLoadIdentity()) {
			this.lastLoadedIdentityKey = null
		}
	}

	getCurrentLoadIdentity(): string | null {
		return this.createLoadRequest()?.identityKey ?? null
	}

	isCurrentLoadIdentity(identityKey: string | null): boolean {
		return !!identityKey && this.getCurrentLoadIdentity() === identityKey
	}

	async loadFromRemote(): Promise<boolean> {
		const request = this.createLoadRequest()
		if (!request) {
			this.lastLoadResult = { didLoad: false, pendingUpgrade: null, sidecarStatus: "missing" }
			return false
		}

		if (this.pendingLoad?.identityKey === request.identityKey) {
			const result = await this.pendingLoad.promise
			this.lastLoadResult = result
			return result.didLoad
		}

		const pendingLoad: PendingDesignLoad = {
			identityKey: request.identityKey,
			promise: this.loadFromRemoteInternal(request),
		}
		this.pendingLoad = pendingLoad
		try {
			const result = await pendingLoad.promise
			this.lastLoadResult = result
			return result.didLoad
		} finally {
			if (this.pendingLoad === pendingLoad) {
				this.pendingLoad = null
			}
		}
	}

	getLastLoadResult(): DesignLoadResult | undefined {
		return this.lastLoadResult
	}

	async resetAndReload(): Promise<boolean> {
		this.lastLoadedIdentityKey = null
		return this.loadFromRemote()
	}

	private createLoadRequest(): DesignLoadRequest | null {
		const {
			currentFile,
			attachments,
			flatAttachments,
			projectPath,
			projectId,
			attachmentsReady,
		} = this.options
		const actualCurrentFile = resolveActualDesignCurrentFile({
			currentFile,
			flatAttachments,
			attachments,
			projectPath,
		})
		if (
			!actualCurrentFile?.id ||
			!actualCurrentFile.name ||
			!attachments ||
			attachmentsReady === false
		) {
			return null
		}

		return {
			identityKey: JSON.stringify([
				projectId ?? null,
				actualCurrentFile.id,
				getDesignRequestIdentity(this.options),
			]),
			options: this.options,
			currentFile: actualCurrentFile,
		}
	}

	private isCurrentLoadRequest(request: DesignLoadRequest): boolean {
		return this.getCurrentLoadIdentity() === request.identityKey
	}

	private async loadFromRemoteInternal(request: DesignLoadRequest): Promise<DesignLoadResult> {
		const {
			options: { attachments, projectId },
			currentFile: { id: currentFileId, name: currentFileName },
		} = request
		if (!attachments) {
			return { didLoad: false, pendingUpgrade: null, sidecarStatus: "missing" }
		}

		const currentProjectId = projectId ?? null
		const accessMode = resolveDesignAccessMode(request.options)
		const hasProjectChanged =
			this.currentProjectId !== null && this.currentProjectId !== currentProjectId
		if (hasProjectChanged) {
			this.stateBag.setters.setAccessMode(accessMode)
		}
		this.currentProjectId = currentProjectId

		if (this.lastLoadedIdentityKey === request.identityKey) {
			return { didLoad: true, pendingUpgrade: null, sidecarStatus: "missing" }
		}

		let pendingUpgrade: PendingDesignUpgrade | null = null
		let sidecarStatus: DesignSidecarStatus = "missing"
		let loadIssue: DesignLoadIssue | undefined
		try {
			this.stateBag.setters.setIsInitialLoading(true)
			const result = await findMagicProjectJsFile({
				attachments,
				currentFileId,
				currentFileName,
				fileApi: request.options.fileApi,
			})
			if (!this.isCurrentLoadRequest(request)) {
				return { didLoad: false, pendingUpgrade: null, sidecarStatus }
			}
			if (!result?.fileId) {
				return { didLoad: false, pendingUpgrade: null, sidecarStatus }
			}

			const snapshot = await this.readCurrentFile(result.fileId, request.options)
			const loaded = snapshot.loadResult
			if (!snapshot.data || !loaded)
				return { didLoad: false, pendingUpgrade: null, sidecarStatus }
			if (!this.isCurrentLoadRequest(request)) {
				return { didLoad: false, pendingUpgrade: null, sidecarStatus }
			}

			const parsedData = loaded.data
			sidecarStatus = loaded.sidecarStatus
			loadIssue = loaded.issue
			if (loaded.needsPersist && sidecarStatus !== "unsupported") {
				pendingUpgrade = {
					reason: "legacy-dsl",
					createdAt: Date.now(),
					fileId: result.fileId,
					sourceVersion: loaded.sourceVersion,
					targetVersion: MAGIC_PROJECT_VERSION_V3,
				}
			}
			this.stateBag.setters.setMagicProjectJsFileId(result.fileId)
			this.stateBag.setters.setSidecarStatus?.(sidecarStatus)
			this.stateBag.setters.setDesignLoadIssue?.(loadIssue)
			this.stateBag.setters.setElementDetailsProvenance?.(
				loaded.elementDetailsProvenance ?? {},
			)
			this.stateBag.setters.setDesignData(parsedData)
			this.stateBag.setPrevDesignDataFingerprint(hashDesignDataComparable(parsedData))
			this.lastLoadedIdentityKey = request.identityKey
			this.stateBag.setters.setAccessMode(
				sidecarStatus === "unsupported" ? "readonly" : accessMode,
			)

			return { didLoad: true, pendingUpgrade, issue: loadIssue, sidecarStatus }
		} catch (error) {
			loadIssue =
				error instanceof DesignLoadError
					? error.issue
					: {
							kind: "invalid-envelope",
							stage: "parse-envelope",
							message: stringifyUnknownError(error),
						}
			if (this.isCurrentLoadRequest(request)) {
				this.stateBag.setters.setDesignLoadIssue?.(loadIssue)
			}
			return { didLoad: false, pendingUpgrade: null, issue: loadIssue, sidecarStatus }
		}
	}
}
