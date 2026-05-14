import { debounce } from "lodash-es"
import { makeAutoObservable, reaction, runInAction } from "mobx"
import type { IReactionDisposer } from "mobx"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	buildCrewI18nText,
	normalizeCrewI18nArrayValue,
	resolveCrewIconUrl,
	type CrewI18nArrayText,
	type CrewI18nText,
	type CrewIconObject,
} from "@/apis/modules/crew"
import { SuperMagicApi } from "@/apis"
import { crewService } from "@/services/crew/CrewService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	encodeCrewAgentPrompt,
	resolveCrewAgentPromptText,
	type CrewAgentPrompt,
} from "@/services/crew/agent-prompt"
import { CREW_EDIT_ERROR, getCrewEditErrorMessage } from "../constants/errors"
import {
	MAGIC_ROOT_DIRECTORY_NAME,
	IDENTITY_MARKDOWN_FILE_NAME,
	buildIdentityMarkdown,
	normalizeWorkspaceRelativePath,
	syncIdentityMarkdownContent,
	type IdentityMarkdownData,
	updateIdentityMarkdownContent,
} from "../utils/identity-markdown"
import { type CrewCodeController, resolveCrewEditError } from "./shared"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"

const MAGIC_FOLDER_NAME = MAGIC_ROOT_DIRECTORY_NAME
const DUPLICATE_REMOTE_FILE_CODE = SuperMagicApiErrorCode.DuplicateFile
const MAGIC_FOLDER_RESOLVE_RETRY_MS = 200
const MAGIC_FOLDER_RESOLVE_MAX_RETRIES = 8

type AttachmentPathFields = AttachmentItem & {
	file_path?: string
	file_type?: string
	type?: string
}

interface CrewIdentityStoreDeps extends CrewCodeController {
	getProjectId?: () => string | undefined
	getWorkspaceFilesList?: () => AttachmentItem[]
	getWorkspaceFileTree?: () => AttachmentItem[]
}

async function resolveMagicFolderParentId(options: {
	projectId: string
	getFlat: () => AttachmentItem[]
	getTree: () => AttachmentItem[]
}): Promise<string | number | null> {
	const { projectId, getFlat, getTree } = options

	const tryFind = () => findRootMagicFolderId({ flatList: getFlat(), tree: getTree() })

	let parentId = tryFind()
	if (parentId) return parentId

	try {
		const res = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: "",
			file_name: MAGIC_FOLDER_NAME,
			is_directory: true,
		})
		if (res?.file_id) return res.file_id
		return null
	} catch (error) {
		const code = (error as { code?: number })?.code
		if (code !== DUPLICATE_REMOTE_FILE_CODE) return null

		pubsub.publish(PubSubEvents.Update_Attachments)
		for (let i = 0; i < MAGIC_FOLDER_RESOLVE_MAX_RETRIES; i++) {
			await new Promise((r) => setTimeout(r, MAGIC_FOLDER_RESOLVE_RETRY_MS))
			parentId = tryFind()
			if (parentId) return parentId
		}
		return null
	}
}

function isDirectoryAttachment(item: AttachmentPathFields): boolean {
	return Boolean(item.is_directory || item.type === "directory" || item.file_type === "directory")
}

function findRootMagicFolderId(options: {
	flatList: AttachmentItem[]
	tree: AttachmentItem[]
}): string | undefined {
	const { flatList, tree } = options

	for (const item of flatList) {
		const ext = item as AttachmentPathFields
		if (!isDirectoryAttachment(ext)) continue
		const path = normalizeWorkspaceRelativePath(
			ext.relative_file_path ?? ext.file_path ?? ext.path ?? "",
		)
		if (path !== MAGIC_FOLDER_NAME) continue
		if (ext.file_id != null && `${ext.file_id}` !== "") return String(ext.file_id)
	}

	const magicRoot = tree.find((item) => {
		const ext = item as AttachmentPathFields
		if (!isDirectoryAttachment(ext)) return false
		return (ext.file_name ?? ext.name ?? ext.filename ?? "").trim() === MAGIC_FOLDER_NAME
	})
	if (!magicRoot?.file_id) return undefined

	return String(magicRoot.file_id)
}

interface CrewIdentityHydration {
	name_i18n?: CrewI18nText
	role_i18n?: CrewI18nArrayText
	description_i18n?: CrewI18nText
	icon?: CrewIconObject | null
	prompt?: string | CrewAgentPrompt | null
}

export class CrewIdentityStore {
	name_i18n: CrewI18nText = { default: "" }
	role_i18n: CrewI18nArrayText = {}
	description_i18n: CrewI18nText = { default: "" }
	icon: CrewIconObject | null = null
	prompt: string | null = null
	identityMarkdownFileId: string | null = null
	identityMarkdownData: IdentityMarkdownData | null = null
	identityMarkdownRawContent: string | null = null

	crewSaving = false
	crewSaveError: string | null = null

	private _suppressAutoSave = false
	// Hydrate guard: pending reactions flush when outer action ends (inBatch
	// drops to 0). Depth stays >0 for that sync flush; microtask then clears.
	private _hydrateReactionBlockDepth = 0
	private _pendingSave = false
	private _debouncedSave: ReturnType<typeof debounce>
	private readonly _getCrewCode: CrewCodeController["getCrewCode"]
	private readonly _setCrewCode: CrewCodeController["setCrewCode"]
	private readonly _markCrewUpdated?: CrewCodeController["markCrewUpdated"]
	private readonly _getProjectId?: () => string | undefined
	private readonly _getWorkspaceFilesList?: () => AttachmentItem[]
	private readonly _getWorkspaceFileTree?: () => AttachmentItem[]
	private readonly _saveDisposer: IReactionDisposer

	constructor({
		getCrewCode,
		setCrewCode,
		markCrewUpdated,
		getProjectId,
		getWorkspaceFilesList,
		getWorkspaceFileTree,
	}: CrewIdentityStoreDeps) {
		this._getCrewCode = getCrewCode
		this._setCrewCode = setCrewCode
		this._markCrewUpdated = markCrewUpdated
		this._getProjectId = getProjectId
		this._getWorkspaceFilesList = getWorkspaceFilesList
		this._getWorkspaceFileTree = getWorkspaceFileTree
		this._debouncedSave = debounce(() => {
			// Skip flush if hydrate guard still active (edge timing vs. reaction).
			if (
				this._getCrewCode() &&
				!this._suppressAutoSave &&
				this._hydrateReactionBlockDepth === 0
			)
				void this.saveIdentity()
		}, 1500)

		makeAutoObservable<
			this,
			| "_suppressAutoSave"
			| "_hydrateReactionBlockDepth"
			| "_pendingSave"
			| "_debouncedSave"
			| "_getCrewCode"
			| "_setCrewCode"
			| "_markCrewUpdated"
			| "_getProjectId"
			| "_getWorkspaceFilesList"
			| "_getWorkspaceFileTree"
			| "_saveDisposer"
		>(
			this,
			{
				_suppressAutoSave: false,
				_hydrateReactionBlockDepth: false,
				_pendingSave: false,
				_debouncedSave: false,
				_getCrewCode: false,
				_setCrewCode: false,
				_markCrewUpdated: false,
				_getProjectId: false,
				_getWorkspaceFilesList: false,
				_getWorkspaceFileTree: false,
				_saveDisposer: false,
			},
			{ autoBind: true },
		)

		this._saveDisposer = reaction(
			() => this.memberInfoSnapshot,
			() => {
				// Ignore server/applied hydrate; only user edits should debounce-save.
				if (this._suppressAutoSave || this._hydrateReactionBlockDepth > 0) return
				this._debouncedSave()
			},
		)
	}

	private get memberInfoSnapshot() {
		return {
			name_i18n: this.name_i18n,
			role_i18n: this.role_i18n,
			description_i18n: this.description_i18n,
			icon: this.icon,
		}
	}

	hydrate(data: CrewIdentityHydration) {
		// _suppressAutoSave cannot cover this: hydrate() returns before batch ends.
		this._hydrateReactionBlockDepth++
		try {
			this.name_i18n = data.name_i18n ?? { default: "" }
			this.role_i18n = data.role_i18n ?? {}
			this.description_i18n = data.description_i18n ?? { default: "" }
			this.icon = data.icon ?? null
			this.prompt = resolveCrewAgentPromptText(data.prompt ?? null)
			this.crewSaveError = null
		} finally {
			this._debouncedSave.cancel()
			queueMicrotask(() => {
				// After sync reaction run; user edits must autosave again.
				this._hydrateReactionBlockDepth--
			})
		}
	}

	async setName(name: string): Promise<void> {
		await this.saveNameAndDescriptionToIdentityMarkdown({
			name,
			description: this.description_i18n.default ?? "",
		})
	}

	setRole(role: string) {
		this.role_i18n = {
			...this.role_i18n,
			default: role ? [role] : [],
		}
	}

	async setDescription(description: string): Promise<void> {
		await this.saveNameAndDescriptionToIdentityMarkdown({
			name: this.name_i18n.default ?? "",
			description,
		})
	}

	setAvatarUrl(url: string) {
		this.icon = url ? { type: "Image", value: url } : { value: "" }
	}

	async saveRoleI18n(role_i18n: CrewI18nArrayText): Promise<boolean> {
		const previousRole = this.role_i18n
		const crewCode = this._getCrewCode()

		this._suppressAutoSave = true
		this._debouncedSave.cancel()
		this.role_i18n = role_i18n
		this.crewSaveError = null

		if (!crewCode) {
			this._suppressAutoSave = false
			return true
		}

		try {
			await crewService.updateAgentInfo(crewCode, { role_i18n })
			this._markCrewUpdated?.()
			return true
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
			})

			runInAction(() => {
				this.role_i18n = previousRole
				this.crewSaveError = message
			})
			return false
		} finally {
			this._suppressAutoSave = false
		}
	}

	setIdentityMarkdownFileId(fileId: string | null) {
		this.identityMarkdownFileId = fileId
	}

	setIdentityMarkdownRawContent(content: string | null) {
		this.identityMarkdownRawContent = content
	}

	clearIdentityMarkdownSnapshot() {
		this.identityMarkdownFileId = null
		this.identityMarkdownData = null
		this.identityMarkdownRawContent = null
	}

	applyIdentityMarkdown(identityMarkdownData: IdentityMarkdownData) {
		const {
			name,
			description,
			nameCn,
			nameEn,
			role,
			roleCn,
			roleEn,
			descriptionCn,
			descriptionEn,
		} = identityMarkdownData

		this._hydrateReactionBlockDepth++
		try {
			this.identityMarkdownData = {
				...this.identityMarkdownData,
				...identityMarkdownData,
			}
			this.name_i18n = buildNextTextI18n({
				currentValue: this.name_i18n,
				defaultValue: name,
				enValue: nameEn,
				zhValue: nameCn,
			})
			this.role_i18n = buildNextArrayI18n({
				currentValue: this.role_i18n,
				defaultValue: role,
				enValue: roleEn,
				zhValue: roleCn,
			})
			this.description_i18n = buildNextTextI18n({
				currentValue: this.description_i18n,
				defaultValue: description,
				enValue: descriptionEn,
				zhValue: descriptionCn,
			})
		} finally {
			this._debouncedSave.cancel()
			queueMicrotask(() => {
				this._hydrateReactionBlockDepth--
			})
		}
	}

	clearIdentityMarkdownError() {
		if (
			this.crewSaveError ===
				getCrewEditErrorMessage(CREW_EDIT_ERROR.identityMarkdownMissing) ||
			this.crewSaveError ===
				getCrewEditErrorMessage(CREW_EDIT_ERROR.loadIdentityMarkdownFailed)
		) {
			this.crewSaveError = null
		}
	}

	setIdentityMarkdownMissingError() {
		this.crewSaveError = getCrewEditErrorMessage(CREW_EDIT_ERROR.identityMarkdownMissing)
	}

	setIdentityMarkdownLoadError() {
		this.crewSaveError = getCrewEditErrorMessage(CREW_EDIT_ERROR.loadIdentityMarkdownFailed)
	}

	private async ensureIdentityMarkdownFileForData({
		name_i18n,
		role_i18n,
		description_i18n,
	}: {
		name_i18n: CrewI18nText
		role_i18n: CrewI18nArrayText
		description_i18n: CrewI18nText
	}): Promise<boolean> {
		if (this.identityMarkdownFileId) return true

		const projectId = this._getProjectId?.()
		if (!projectId) {
			this.setIdentityMarkdownMissingError()
			return false
		}

		return this.ensureIdentityMarkdownFile({
			projectId,
			name_i18n,
			role_i18n,
			description_i18n,
		})
	}

	async saveNameAndDescriptionToIdentityMarkdown({
		name,
		description,
	}: IdentityMarkdownData): Promise<boolean> {
		const nextName = name.trim()
		const nextDescription = description.trim()
		const nextNameI18n: CrewI18nText = {
			...this.name_i18n,
			default: nextName,
		}
		const nextDescriptionI18n: CrewI18nText = {
			...this.description_i18n,
			default: nextDescription,
		}

		const isFileReady = await this.ensureIdentityMarkdownFileForData({
			name_i18n: nextNameI18n,
			role_i18n: this.role_i18n,
			description_i18n: nextDescriptionI18n,
		})
		if (!isFileReady || !this.identityMarkdownFileId) {
			return false
		}

		this.crewSaving = true
		this.crewSaveError = null

		try {
			const nextIdentityMarkdownData: IdentityMarkdownData = {
				...(this.identityMarkdownData ?? {}),
				name: nextName,
				description: nextDescription,
			}
			const rawContent = this.identityMarkdownRawContent
			const updateResult = rawContent
				? updateIdentityMarkdownContent({
						originalContent: rawContent,
						nextData: nextIdentityMarkdownData,
						previousData: this.identityMarkdownData,
					})
				: {
						content: buildIdentityMarkdown(nextIdentityMarkdownData),
						updatedName: true,
						updatedDescription: true,
					}

			const nameChanged =
				(this.identityMarkdownData?.name?.trim() ?? "") !== nextIdentityMarkdownData.name
			const descriptionChanged =
				(this.identityMarkdownData?.description?.trim() ?? "") !==
				nextIdentityMarkdownData.description
			const hasUnpatchableChanges =
				(nameChanged && !updateResult.updatedName) ||
				(descriptionChanged && !updateResult.updatedDescription)

			if (hasUnpatchableChanges) {
				this.crewSaveError = getCrewEditErrorMessage(CREW_EDIT_ERROR.saveCrewFailed)
				return false
			}

			await SuperMagicApi.saveFileContent([
				{
					file_id: this.identityMarkdownFileId,
					content: updateResult.content,
				},
			])
			this.identityMarkdownRawContent = updateResult.content
			this.applyIdentityMarkdown(nextIdentityMarkdownData)
			this._markCrewUpdated?.()
			return true
		} catch {
			this.crewSaveError = getCrewEditErrorMessage(CREW_EDIT_ERROR.saveCrewFailed)
			return false
		} finally {
			runInAction(() => {
				this.crewSaving = false
			})
		}
	}

	async syncI18nFieldsToIdentityMarkdown({
		name_i18n,
		role_i18n,
		description_i18n,
	}: {
		name_i18n: CrewI18nText
		role_i18n: CrewI18nArrayText
		description_i18n: CrewI18nText
	}): Promise<boolean> {
		const isFileReady = await this.ensureIdentityMarkdownFileForData({
			name_i18n,
			role_i18n,
			description_i18n,
		})
		if (!isFileReady || !this.identityMarkdownFileId) return false

		const nextIdentityMarkdownData = buildIdentityMarkdownDataFromI18n({
			previousData: this.identityMarkdownData,
			name_i18n,
			role_i18n,
			description_i18n,
		})

		const nextContent = this.identityMarkdownRawContent
			? syncIdentityMarkdownContent({
					originalContent: this.identityMarkdownRawContent,
					nextData: nextIdentityMarkdownData,
				})
			: buildIdentityMarkdown(nextIdentityMarkdownData)

		try {
			await SuperMagicApi.saveFileContent([
				{
					file_id: this.identityMarkdownFileId,
					content: nextContent,
				},
			])
			runInAction(() => {
				this.identityMarkdownRawContent = nextContent
				this.applyIdentityMarkdown(nextIdentityMarkdownData)
			})
			this._markCrewUpdated?.()
			return true
		} catch {
			return false
		}
	}

	async ensureIdentityMarkdownFile({
		projectId,
		name_i18n = this.name_i18n,
		role_i18n = this.role_i18n,
		description_i18n = this.description_i18n,
	}: {
		projectId?: string
		name_i18n?: CrewI18nText
		role_i18n?: CrewI18nArrayText
		description_i18n?: CrewI18nText
	}): Promise<boolean> {
		if (this.identityMarkdownFileId) return true
		if (!projectId) return false

		const nextIdentityMarkdownData = buildIdentityMarkdownDataFromI18n({
			previousData: this.identityMarkdownData,
			name_i18n,
			role_i18n,
			description_i18n,
		})
		const nextContent = buildIdentityMarkdown(nextIdentityMarkdownData)

		try {
			const magicParentId = await resolveMagicFolderParentId({
				projectId,
				getFlat: () => this._getWorkspaceFilesList?.() ?? [],
				getTree: () => this._getWorkspaceFileTree?.() ?? [],
			})
			if (magicParentId == null) return false

			const fileResponse = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: magicParentId,
				file_name: IDENTITY_MARKDOWN_FILE_NAME,
				is_directory: false,
			})
			if (!fileResponse?.file_id) return false

			await SuperMagicApi.saveFileContent([
				{
					file_id: fileResponse.file_id,
					content: nextContent,
				},
			])
			runInAction(() => {
				this.identityMarkdownFileId = fileResponse.file_id
				this.identityMarkdownRawContent = nextContent
				this.applyIdentityMarkdown(nextIdentityMarkdownData)
			})
			pubsub.publish(PubSubEvents.Update_Attachments)
			return true
		} catch {
			return false
		}
	}

	async savePrompt(prompt: string): Promise<void> {
		const previousPrompt = this.prompt
		this.prompt = prompt

		const crewCode = this._getCrewCode()
		if (!crewCode) return

		try {
			await crewService.updateAgentInfo(crewCode, {
				prompt_shadow: encodeCrewAgentPrompt(prompt),
			})
			this._markCrewUpdated?.()
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
			})

			runInAction(() => {
				this.prompt = previousPrompt
				this.crewSaveError = message
			})
		}
	}

	/**
	 * Update i18n identity fields with optimistic update + rollback on failure.
	 * Cancels any pending debounced save and immediately persists to the backend.
	 */
	async setI18nFields(update: {
		name_i18n: CrewI18nText
		role_i18n: CrewI18nArrayText
		description_i18n: CrewI18nText
	}): Promise<void> {
		const crewCode = this._getCrewCode()
		if (!crewCode) return

		const previousValue = {
			name_i18n: this.name_i18n,
			role_i18n: this.role_i18n,
			description_i18n: this.description_i18n,
		}

		this._suppressAutoSave = true
		this._debouncedSave.cancel()

		this.name_i18n = update.name_i18n
		this.role_i18n = update.role_i18n
		this.description_i18n = update.description_i18n

		const iconUrl = resolveCrewIconUrl(this.icon)

		try {
			await crewService.updateAgentInfo(crewCode, {
				name_i18n: update.name_i18n,
				role_i18n: update.role_i18n,
				description_i18n: update.description_i18n,
				icon: iconUrl ? { type: "Image", value: iconUrl } : { value: "" },
			})
			this._markCrewUpdated?.()
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
			})

			runInAction(() => {
				this.name_i18n = previousValue.name_i18n
				this.role_i18n = previousValue.role_i18n
				this.description_i18n = previousValue.description_i18n
				this.crewSaveError = message
			})
		} finally {
			this._suppressAutoSave = false
		}
	}

	/**
	 * Create or update the crew.
	 * Tracks pending saves so the latest local state is flushed after in-flight writes.
	 */
	async saveIdentity(): Promise<void> {
		if (this.crewSaving) {
			this._pendingSave = true
			return
		}

		this._pendingSave = false
		this.crewSaving = true
		this.crewSaveError = null

		const nameI18n = this.name_i18n?.default ? this.name_i18n : buildCrewI18nText("")
		const roleI18n = Object.keys(this.role_i18n || {}).length
			? this.role_i18n
			: { default: [], en_US: [], zh_CN: [] }
		const descI18n = this.description_i18n?.default
			? this.description_i18n
			: buildCrewI18nText("")
		const iconUrl = resolveCrewIconUrl(this.icon)
		const crewCode = this._getCrewCode()

		try {
			if (!crewCode) {
				const { code } = await crewService.createAgent({
					name_i18n: nameI18n,
					role_i18n: roleI18n,
					description_i18n: descI18n,
					icon: iconUrl ? { type: "Image", value: iconUrl } : undefined,
					icon_type: iconUrl ? 2 : undefined,
					prompt: this.prompt ? encodeCrewAgentPrompt(this.prompt) : undefined,
				})

				runInAction(() => {
					this._setCrewCode(code)
				})
				this._markCrewUpdated?.()
			} else {
				await crewService.updateAgentInfo(crewCode, {
					name_i18n: nameI18n,
					role_i18n: roleI18n,
					description_i18n: descI18n,
					icon: iconUrl ? { type: "Image", value: iconUrl } : { value: "" },
					icon_type: iconUrl ? 2 : undefined,
				})
				this._markCrewUpdated?.()
			}
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveCrewFailed,
			})

			runInAction(() => {
				this.crewSaveError = message
			})
		} finally {
			runInAction(() => {
				this.crewSaving = false
			})

			if (this._pendingSave && !this._suppressAutoSave) {
				this._pendingSave = false
				void this.saveIdentity()
			}
		}
	}

	reset() {
		this._debouncedSave.cancel()
		// Clear hydrate guard so a new store session cannot leak depth.
		this._hydrateReactionBlockDepth = 0
		this.name_i18n = { default: "" }
		this.role_i18n = {}
		this.description_i18n = { default: "" }
		this.icon = null
		this.prompt = null
		this.identityMarkdownFileId = null
		this.identityMarkdownData = null
		this.identityMarkdownRawContent = null
		this.crewSaving = false
		this.crewSaveError = null
		this._suppressAutoSave = false
		this._pendingSave = false
	}

	dispose() {
		this._debouncedSave.cancel()
		// Avoid stale microtasks touching depth after teardown.
		this._hydrateReactionBlockDepth = 0
		this._saveDisposer()
	}
}

function buildNextTextI18n({
	currentValue,
	defaultValue,
	enValue,
	zhValue,
}: {
	currentValue: CrewI18nText
	defaultValue: string
	enValue?: string
	zhValue?: string
}): CrewI18nText {
	const nextValue: CrewI18nText = {
		...currentValue,
		default: defaultValue,
	}

	if (enValue) nextValue.en_US = enValue
	else delete nextValue.en_US

	if (zhValue) nextValue.zh_CN = zhValue
	else delete nextValue.zh_CN

	return nextValue
}

function buildIdentityMarkdownDataFromI18n({
	previousData,
	name_i18n,
	role_i18n,
	description_i18n,
}: {
	previousData?: IdentityMarkdownData | null
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
}): IdentityMarkdownData {
	return {
		...(previousData ?? {}),
		name: name_i18n.default?.trim() ?? "",
		nameEn: name_i18n.en_US?.trim() ?? "",
		nameCn: name_i18n.zh_CN?.trim() ?? "",
		role: normalizeCrewI18nArrayValue(role_i18n.default).trim(),
		roleEn: normalizeCrewI18nArrayValue(role_i18n.en_US).trim(),
		roleCn: normalizeCrewI18nArrayValue(role_i18n.zh_CN).trim(),
		description: description_i18n.default?.trim() ?? "",
		descriptionEn: description_i18n.en_US?.trim() ?? "",
		descriptionCn: description_i18n.zh_CN?.trim() ?? "",
	}
}

function buildNextArrayI18n({
	currentValue,
	defaultValue,
	enValue,
	zhValue,
}: {
	currentValue: CrewI18nArrayText
	defaultValue?: string
	enValue?: string
	zhValue?: string
}): CrewI18nArrayText {
	const nextValue: CrewI18nArrayText = {
		...currentValue,
		default: defaultValue ? [defaultValue] : [],
	}

	if (enValue) nextValue.en_US = [enValue]
	else delete nextValue.en_US

	if (zhValue) nextValue.zh_CN = [zhValue]
	else delete nextValue.zh_CN

	return nextValue
}
