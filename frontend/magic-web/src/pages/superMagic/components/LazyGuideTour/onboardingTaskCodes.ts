/**
 * The contract between the backend's task codes and this client's guided flows.
 *
 * The two sides name the same eight tasks differently — the backend speaks `super_magic_intro`
 * where the guide engine speaks `workbench` — so the mapping has to live *somewhere* explicit
 * instead of being re-derived with `code === "…"` comparisons at each call site. It lives here,
 * next to the flows it names, because the flow ids are this client's own vocabulary.
 *
 * The table is the single place a rename has to be made. Everything else reads through it, and a
 * code this build does not know (`getHomeOnboardingTaskIdByCode` → `null`) is surfaced as a reward
 * row without a guided flow rather than dropped: the backend may add a task before this client
 * learns its flow, and the user should still see what the deployment is offering.
 */
import type {
	OnboardingTask,
	OnboardingRewardStatus,
	OnboardingTaskStatusCode,
} from "@/apis/modules/onboarding"
import type { HomeOnboardingTaskId } from "./GuideTourManager"

/**
 * Task id → backend code, in the order the backend advertises them. Written as the *id* first
 * because the flow id is what the rest of the client keys off.
 */
export const HOME_ONBOARDING_TASK_CODE: Record<HomeOnboardingTaskId, string> = {
	"first-ai-work": "first_ai_work",
	workbench: "super_magic_intro",
	"create-ai-ppt": "ai_ppt",
	"audio-recording": "ai_recording",
	"hire-employee": "digital_employee",
	"manage-skill": "skill_management",
	"create-micro-app": "micro_app",
	"super-lobster": "magiclaw",
}

const TASK_ID_BY_CODE = new Map<string, HomeOnboardingTaskId>(
	Object.entries(HOME_ONBOARDING_TASK_CODE).map(([taskId, code]) => [
		code,
		taskId as HomeOnboardingTaskId,
	]),
)

/** `null` for a task this build has no guided flow for. The row is still shown, just without one. */
export function getHomeOnboardingTaskIdByCode(code: string): HomeOnboardingTaskId | null {
	return TASK_ID_BY_CODE.get(code) ?? null
}

/**
 * The one task the backend completes itself, off a "the user finished their first AI task" system
 * event. Calling completion for it answers `9303`, so the client must never offer the call — which
 * is a property of the task, not of the individual entry, and therefore lives here rather than at
 * the call site.
 */
const AUTO_COMPLETED_TASK_IDS: ReadonlySet<HomeOnboardingTaskId> = new Set(["first-ai-work"])

/** Whether finishing this task's flow is what completes the task, i.e. whether to claim on exit. */
export function canManuallyCompleteHomeOnboardingTask(taskId: HomeOnboardingTaskId) {
	return !AUTO_COMPLETED_TASK_IDS.has(taskId)
}

/**
 * One reward row, in this client's vocabulary. `taskId` is `null` for a backend task with no flow
 * here, which is what keeps an unknown code renderable instead of silently missing.
 */
export interface HomeOnboardingReward {
	taskId: HomeOnboardingTaskId | null
	code: string
	points: number
	validityDays: number
	status: OnboardingTaskStatusCode
	rewardStatus: OnboardingRewardStatus
	completedAt: string | null
	rewardGrantedAt: string | null
	expiresAt: string
}

export function toHomeOnboardingReward(task: OnboardingTask): HomeOnboardingReward {
	return {
		taskId: getHomeOnboardingTaskIdByCode(task.code),
		code: task.code,
		points: task.points,
		validityDays: task.validity_days,
		status: task.status,
		rewardStatus: task.reward_status,
		completedAt: task.completed_at,
		rewardGrantedAt: task.reward_granted_at,
		expiresAt: task.expires_at,
	}
}
