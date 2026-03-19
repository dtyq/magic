import { useCallback } from "react"
import type { ImportSkillResponse } from "@/apis/modules/skills"
import { buildCrewI18nText } from "@/apis/modules/crew"
import magicToast from "@/components/base/MagicToaster/utils"
import { skillsService } from "@/services/skills/SkillsService"
import { useCrewEditStore } from "../context"
import { CREW_SKILLS_TAB } from "../store"

interface InstallImportedSkillOptions {
	openSkillsStep?: boolean
	onInstalled?: () => void | Promise<void>
}

export function useInstallImportedSkill() {
	const store = useCrewEditStore()
	const { layout, skills } = store

	return useCallback(
		async (result: ImportSkillResponse, options?: InstallImportedSkillOptions) => {
			const installedSkillCode = result.skill_code
			const alreadyInstalled = skills.skills.some(
				(skill) => skill.skill_code === installedSkillCode,
			)

			try {
				if (!alreadyInstalled) {
					const detail = await skillsService.getSkillDetail(installedSkillCode)
					const skillCode = detail.code || installedSkillCode

					skills.addSkill({
						skill_code: skillCode,
						name_i18n: detail.name_i18n ?? buildCrewI18nText(""),
						description_i18n: detail.description_i18n ?? buildCrewI18nText(""),
						logo: detail.logo || null,
					})

					try {
						await skills.addSkillToAgent(skillCode)
					} catch (error) {
						skills.removeSkill(skillCode)
						throw error
					}
				}

				if (options?.openSkillsStep) {
					layout.openSkillsPanel(CREW_SKILLS_TAB.MySkills)
				}

				await options?.onInstalled?.()
			} catch (error) {
				const message = error instanceof Error ? error.message : null
				if (message) magicToast.error(message)
			}
		},
		[layout, skills],
	)
}
