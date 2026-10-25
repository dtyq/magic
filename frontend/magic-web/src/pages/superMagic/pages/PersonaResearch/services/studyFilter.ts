import type { StudyStatusKind } from "./studyStatus"

/**
 * Status groups for the home study filter. Fewer groups than status kinds: a study waiting for
 * the user is still under way, and a failed one is stopped like a paused one.
 *
 * | Group        | Kinds                 |
 * | active       | running, waiting_user |
 * | done         | done                  |
 * | stopped      | idle, failed          |
 * | conversation | conversation          |
 */
export type StudyGroup = "active" | "done" | "stopped" | "conversation"
export type StudyGroupFilter = StudyGroup | "all"

export const STUDY_GROUPS: StudyGroup[] = ["active", "done", "stopped", "conversation"]

export function studyGroupOf(kind: StudyStatusKind): StudyGroup {
	if (kind === "running" || kind === "waiting_user") return "active"
	if (kind === "done") return "done"
	if (kind === "conversation") return "conversation"
	return "stopped"
}

export interface StudyFilterItem<T> {
	item: T
	title: string
	kind: StudyStatusKind
}

/** Items in the group whose title contains the keyword, ignoring case; order is kept. */
export function filterStudies<T>(
	items: StudyFilterItem<T>[],
	group: StudyGroupFilter,
	keyword: string,
): T[] {
	const query = keyword.trim().toLowerCase()
	return items
		.filter(({ kind }) => group === "all" || studyGroupOf(kind) === group)
		.filter(({ title }) => !query || title.toLowerCase().includes(query))
		.map(({ item }) => item)
}

/** How many items fall in each group, for the counts on the filter chips. */
export function countStudyGroups(kinds: StudyStatusKind[]): Record<StudyGroup, number> {
	const counts: Record<StudyGroup, number> = { active: 0, done: 0, stopped: 0, conversation: 0 }
	for (const kind of kinds) counts[studyGroupOf(kind)] += 1
	return counts
}
