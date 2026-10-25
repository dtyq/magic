import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import { STUDY_PHASE_KEYS, type StudyFile } from "../types"

/**
 * One status shared by the study list, studio header and stepper.
 *
 * | Kind          | When                                              |
 * | waiting_user  | the agent paused on ask_user (clarify / plan)     |
 * | running       | the topic task is running                         |
 * | done          | study.json phase is "done"                        |
 * | failed        | the topic task errored                            |
 * | conversation  | finished with no study.json (e.g. a template chat) |
 * | idle          | anything else (stopped midway, not started yet)   |
 *
 * Topic status wins over study.json so "waiting for you" shows even before the file updates.
 */
export type StudyStatusKind =
	"waiting_user" | "running" | "done" | "failed" | "conversation" | "idle"

export interface StudyStatus {
	kind: StudyStatusKind
	/** Phases finished or skipped, for the 0–6 progress bars. */
	completed: number
	total: number
}

export function resolveStudyStatus(
	topic: Pick<Topic, "task_status" | "status"> | null | undefined,
	study: StudyFile | null,
): StudyStatus {
	const total = STUDY_PHASE_KEYS.length
	const completed = study
		? study.phases.filter((phase) => phase.status === "done" || phase.status === "skipped")
				.length
		: 0
	const taskStatus = topic?.task_status || topic?.status
	let kind: StudyStatusKind = "idle"
	if (taskStatus === TaskStatus.WAITING_FOR_USER) kind = "waiting_user"
	else if (taskStatus === TaskStatus.RUNNING) kind = "running"
	else if (study?.phase === "done") kind = "done"
	else if (taskStatus === TaskStatus.ERROR) kind = "failed"
	// Topics that never created a study (report template chats) are plain conversations; a running
	// one stays "running" above so a study that is just starting still looks like one.
	else if (!study && taskStatus === TaskStatus.FINISHED) kind = "conversation"
	return { kind, completed: study?.phase === "done" ? total : completed, total }
}
