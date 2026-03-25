import type {
	AgentDetailResponse,
	AgentSkillItem,
	CrewI18nArrayText,
	CrewI18nText,
	CrewIconObject,
} from "@/apis/modules/crew"
import type { SceneItem } from "../components/StepDetailPanel/PlaybookPanel/types"
import {
	CREW_EDIT_ERROR,
	getCrewEditErrorMessage,
	type CrewEditErrorKey,
} from "../constants/errors"

/** Steps in the crew edit workflow */
export const CREW_EDIT_STEP = {
	Identity: "identity",
	KnowledgeBase: "knowledge-base",
	Skills: "skills",
	RunAndDebug: "run-and-debug",
	Publishing: "publishing",
	Playbook: "playbook",
	BuiltinSkills: "builtin-skills",
} as const

export type CrewEditStep = (typeof CREW_EDIT_STEP)[keyof typeof CREW_EDIT_STEP]

export const CREW_SKILLS_TAB = {
	Library: "library",
	MySkills: "my-skills",
} as const

export type CrewSkillsTab = (typeof CREW_SKILLS_TAB)[keyof typeof CREW_SKILLS_TAB]

export const CREW_SIDEBAR_TAB = {
	Files: "files",
	Advanced: "advanced",
} as const

export type CrewSidebarTab = (typeof CREW_SIDEBAR_TAB)[keyof typeof CREW_SIDEBAR_TAB]

export const CREW_PANEL_ENABLED = {
	[CREW_EDIT_STEP.Identity]: false,
	[CREW_EDIT_STEP.KnowledgeBase]: false,
	[CREW_EDIT_STEP.Skills]: true,
	[CREW_EDIT_STEP.RunAndDebug]: false,
	[CREW_EDIT_STEP.Publishing]: true,
	[CREW_EDIT_STEP.Playbook]: true,
	[CREW_EDIT_STEP.BuiltinSkills]: true,
	[CREW_SIDEBAR_TAB.Files]: true,
	[CREW_SIDEBAR_TAB.Advanced]: true,
} as const

/** Member identity aligned with AgentDetailResponse (name_i18n, role_i18n, etc). */
export interface CrewMemberData {
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
	icon: CrewIconObject | null
	prompt: string | null
	skills: AgentSkillItem[]
	scenes: SceneItem[]
}

/** Maps a step key to the detail panel it should render in the center column */
export type StepDetailKey = CrewEditStep | null

export function isCrewStepEnabled(step: CrewEditStep) {
	return CREW_PANEL_ENABLED[step]
}

export function isCrewSidebarTabEnabled(tab: CrewSidebarTab) {
	return CREW_PANEL_ENABLED[tab]
}

interface CrewEditErrorLike {
	code?: number
	message?: string
}

export interface CrewEditAsyncError {
	code: number | null
	message: string
}

export interface CrewCodeController {
	getCrewCode: () => string | null
	setCrewCode: (crewCode: string | null) => void
	markCrewUpdated?: (updatedAt?: string) => void
}

export function createEmptyMemberData(): CrewMemberData {
	return {
		name_i18n: { default: "" },
		role_i18n: {},
		description_i18n: { default: "" },
		icon: null,
		prompt: null,
		skills: [],
		scenes: [],
	}
}

export function mapAgentSkillItem(skill: AgentDetailResponse["skills"][number]): AgentSkillItem {
	return {
		id: skill.id,
		skill_id: skill.skill_id,
		skill_code: skill.skill_code,
		name_i18n: skill.name_i18n ?? { default: "" },
		description_i18n: skill.description_i18n ?? { default: "" },
		logo: skill.logo,
		sort_order: skill.sort_order,
	}
}

function isCrewEditErrorLike(error: unknown): error is CrewEditErrorLike {
	return typeof error === "object" && error !== null
}

export function resolveCrewEditError({
	error,
	fallbackKey,
}: {
	error: unknown
	fallbackKey: CrewEditErrorKey
}): CrewEditAsyncError {
	const fallbackMessage = getCrewEditErrorMessage(fallbackKey)
	const code = isCrewEditErrorLike(error) && typeof error.code === "number" ? error.code : null

	if (error instanceof Error) {
		return {
			code,
			message: error.message || fallbackMessage,
		}
	}

	if (isCrewEditErrorLike(error) && typeof error.message === "string" && error.message) {
		return {
			code,
			message: error.message,
		}
	}

	return {
		code,
		message: fallbackMessage,
	}
}

export function getCrewCodeRequiredMessage() {
	return getCrewEditErrorMessage(CREW_EDIT_ERROR.crewCodeRequired)
}
