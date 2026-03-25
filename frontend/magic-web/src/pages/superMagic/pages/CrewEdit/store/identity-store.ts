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
	// Hydrate guard: pending reactions flush when outer action ends (inBatch
	// drops to 0). Depth stays >0 for that sync flush; microtask then clears.
	private _hydrateReactionBlockDepth = 0
	private _pendingSave = false
	private _debouncedSave: ReturnType<typeof debounce>
	private readonly _getCrewCode: CrewCodeController["getCrewCode"]
	private readonly _setCrewCode: CrewCodeController["setCrewCode"]
	private readonly _markCrewUpdated?: CrewCodeController["markCrewUpdated"]
	private readonly _saveDisposer: IReactionDisposer

	constructor({ getCrewCode, setCrewCode, markCrewUpdated }: CrewCodeController) {
		this._getCrewCode = getCrewCode
		this._setCrewCode = setCrewCode
		this._markCrewUpdated = markCrewUpdated
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
