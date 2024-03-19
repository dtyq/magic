import { makeAutoObservable } from "mobx"
import type { AgentSkillItem, CrewI18nText } from "@/opensource/apis/modules/crew"
import { crewService } from "@/opensource/services/crew/CrewService"
import { CREW_EDIT_ERROR } from "../constants/errors"
import { type CrewCodeController, getCrewCodeRequiredMessage, resolveCrewEditError } from "./shared"

interface AddSkillParams {
	skill_code: string
	name_i18n: CrewI18nText
	description_i18n: CrewI18nText
	logo: string | null
}

export class CrewSkillsStore {
	skills: AgentSkillItem[] = []

	private readonly _getCrewCode: CrewCodeController["getCrewCode"]

	constructor({ getCrewCode }: CrewCodeController) {
		this._getCrewCode = getCrewCode

		makeAutoObservable(this, { _getCrewCode: false }, { autoBind: true })
	}

	hydrate(skills: AgentSkillItem[]) {
		this.skills = skills
	}

	addSkill(skill: AddSkillParams) {
		this.skills.push({
			id: 0,
			skill_id: 0,
			skill_code: skill.skill_code,
			name_i18n: skill.name_i18n,
			description_i18n: skill.description_i18n,
			logo: skill.logo,
			sort_order: this.skills.length,
		})
	}

	removeSkill(skillCode: string) {
		this.skills = this.skills.filter((skill) => skill.skill_code !== skillCode)
	}

	async saveSkills(): Promise<void> {
		const crewCode = this._getCrewCode()
		if (!crewCode) throw new Error(getCrewCodeRequiredMessage())

		try {
			await crewService.updateAgentSkills(crewCode, {
				skill_codes: this.skills.map((skill) => skill.skill_code),
			})
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveSkillsFailed,
			})
			throw new Error(message)
		}
	}

	async addSkillToAgent(skillCode: string): Promise<void> {
		const crewCode = this._getCrewCode()
		if (!crewCode) throw new Error(getCrewCodeRequiredMessage())

		try {
			await crewService.addAgentSkills(crewCode, { skill_codes: [skillCode] })
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveSkillsFailed,
			})
			throw new Error(message)
		}
	}

	async removeSkillFromAgent(skillCode: string): Promise<void> {
		const crewCode = this._getCrewCode()
		if (!crewCode) throw new Error(getCrewCodeRequiredMessage())

		try {
			await crewService.deleteAgentSkills(crewCode, { skill_codes: [skillCode] })
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.saveSkillsFailed,
			})
			throw new Error(message)
		}
	}

	reset() {
		this.skills = []
	}
}
