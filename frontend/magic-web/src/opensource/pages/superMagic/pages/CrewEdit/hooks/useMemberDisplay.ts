import { useTranslation } from "react-i18next"
import {
	type AgentSkillItem,
	type CrewI18nArrayText,
	type CrewI18nText,
	type CrewIconObject,
	resolveCrewI18nText,
	resolveCrewI18nArrayText,
	resolveCrewIconUrl,
} from "@/opensource/apis/modules/crew"

export interface MemberDisplaySource {
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
	icon: CrewIconObject | null
	prompt: string | null
	skills: AgentSkillItem[]
}

function resolveMemberText(text: MemberDisplaySource["name_i18n"], locale: string): string {
	return resolveCrewI18nText(text, locale)
}

function resolveMemberRole(text: MemberDisplaySource["role_i18n"], locale: string): string {
	return resolveCrewI18nArrayText(text, locale)
}

/**
 * Resolves member i18n fields to display strings for the current locale.
 */
export function useMemberDisplay(member: MemberDisplaySource) {
	const { i18n } = useTranslation()
	const locale = i18n.language ?? "en_US"

	// Do not memoize on `member` object identity: MobX updates nested fields
	// without changing the root reference, which can cause stale UI.
	return {
		name: resolveMemberText(member.name_i18n, locale),
		role: resolveMemberRole(member.role_i18n, locale),
		description: resolveMemberText(member.description_i18n, locale),
		avatarUrl: resolveCrewIconUrl(member.icon),
		prompt: typeof member.prompt === "string" ? member.prompt : "",
		skillName: (skill: (typeof member.skills)[number]) =>
			resolveCrewI18nText(skill.name_i18n, locale),
	}
}
