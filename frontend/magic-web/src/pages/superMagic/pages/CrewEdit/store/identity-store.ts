import { debounce } from "lodash-es"
import { makeAutoObservable, reaction, runInAction } from "mobx"
import type { IReactionDisposer } from "mobx"
import {
	buildCrewI18nText,
	resolveCrewIconUrl,
	type CrewI18nArrayText,
	type CrewI18nText,
	type CrewIconObject,
} from "@/apis/modules/crew"
import { crewService } from "@/services/crew/CrewService"
import {
	encodeCrewAgentPrompt,
	resolveCrewAgentPromptText,
	type CrewAgentPrompt,
} from "@/services/crew/agent-prompt"
import { CREW_EDIT_ERROR } from "../constants/errors"
import { type CrewCodeController, resolveCrewEditError } from "./shared"

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

	crewSaving = false
	crewSaveError: string | null = null

	private _suppressAutoSave = false
	private _pendingSave = false
	private _debouncedSave: ReturnType<typeof debounce>
	private readonly _getCrewCode: CrewCodeController["getCrewCode"]
	private readonly _setCrewCode: CrewCodeController["setCrewCode"]
	private readonly _saveDisposer: IReactionDisposer

	constructor({ getCrewCode, setCrewCode }: CrewCodeController) {
		this._getCrewCode = getCrewCode
		this._setCrewCode = setCrewCode
		this._debouncedSave = debounce(() => {
			if (this._getCrewCode() && !this._suppressAutoSave) void this.saveIdentity()
		}, 1500)

		makeAutoObservable<
			this,
			| "_suppressAutoSave"
			| "_pendingSave"
			| "_debouncedSave"
			| "_getCrewCode"
			| "_setCrewCode"
			| "_saveDisposer"
		>(
			this,
			{
				_suppressAutoSave: false,
				_pendingSave: false,
				_debouncedSave: false,
				_getCrewCode: false,
				_setCrewCode: false,
				_saveDisposer: false,
			},
			{ autoBind: true },
		)

		this._saveDisposer = reaction(
			() => this.memberInfoSnapshot,
			() => {
				if (!this._suppressAutoSave) this._debouncedSave()
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
		this.runWithoutAutoSave(() => {
			this.name_i18n = data.name_i18n ?? { default: "" }
			this.role_i18n = data.role_i18n ?? {}
			this.description_i18n = data.description_i18n ?? { default: "" }
			this.icon = data.icon ?? null
			this.prompt = resolveCrewAgentPromptText(data.prompt ?? null)
			this.crewSaveError = null
		})
	}

	setName(name: string) {
		this.name_i18n = { ...this.name_i18n, default: name }
	}

	setRole(role: string) {
		this.role_i18n = {
			...this.role_i18n,
			default: role ? [role] : [],
		}
	}

	setDescription(description: string) {
		this.description_i18n = { ...this.description_i18n, default: description }
	}

	setAvatarUrl(url: string) {
		this.icon = url ? { type: "Image", value: url } : { value: "" }
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
			} else {
				await crewService.updateAgentInfo(crewCode, {
					name_i18n: nameI18n,
					role_i18n: roleI18n,
					description_i18n: descI18n,
					icon: iconUrl ? { type: "Image", value: iconUrl } : { value: "" },
					icon_type: iconUrl ? 2 : undefined,
				})
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
		this.name_i18n = { default: "" }
		this.role_i18n = {}
		this.description_i18n = { default: "" }
		this.icon = null
		this.prompt = null
		this.crewSaving = false
		this.crewSaveError = null
		this._suppressAutoSave = false
		this._pendingSave = false
	}

	dispose() {
		this._debouncedSave.cancel()
		this._saveDisposer()
	}

	private runWithoutAutoSave(task: () => void) {
		this._suppressAutoSave = true
		task()
		this._debouncedSave.cancel()
		this._suppressAutoSave = false
	}
}
