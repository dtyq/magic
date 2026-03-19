import i18next from "i18next"

/** Error keys for CrewEdit. Used with getCrewEditErrorMessage(). */
export const CREW_EDIT_ERROR = {
	crewCodeRequired: "errors.crewCodeRequired",
	loadScenesFailed: "errors.loadScenesFailed",
	saveSkillsFailed: "errors.saveSkillsFailed",
	toggleSceneFailed: "errors.toggleSceneFailed",
	deleteSceneFailed: "errors.deleteSceneFailed",
	reorderScenesFailed: "errors.reorderScenesFailed",
	createSceneFailed: "errors.createSceneFailed",
	updateSceneFailed: "errors.updateSceneFailed",
	saveCrewFailed: "errors.saveCrewFailed",
	loadAgentFailed: "errors.loadAgentFailed",
} as const

export type CrewEditErrorKey = (typeof CREW_EDIT_ERROR)[keyof typeof CREW_EDIT_ERROR]

/** Resolve translated error message for CrewEdit (crew/create namespace). */
export function getCrewEditErrorMessage(key: CrewEditErrorKey): string {
	return i18next.t(key, { ns: "crew/create" })
}
