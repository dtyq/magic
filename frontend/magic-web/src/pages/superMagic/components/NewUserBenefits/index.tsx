import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties } from "react"
import { Trans, useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import {
	BookOpen,
	Boxes,
	ChevronRight,
	ChevronUp,
	CircleUserRound,
	Gift,
	Grid2X2,
	Mic,
	MousePointerClick,
	Presentation,
	X,
} from "lucide-react"

import { MagiClaw, Skills } from "@/enhance/lucide-react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/utils/cn"
import { useUserInfo } from "@/models/user/hooks"
import { analyticsService } from "@/services/analytics"
import { useElementVisibility } from "@/pages/superMagic/hooks/useElementVisibility"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import {
	canManuallyCompleteHomeOnboardingTask,
	claimHomeOnboardingReward,
	ensureHomeOnboardingRewardList,
	getHomeOnboardingRewardList,
	getHomeOnboardingTaskEntryPage,
	homeOnboardingClaimFailureKey,
	HOME_ONBOARDING_STATE_EVENT,
	isHomeOnboardingRunBlocking,
	isReplayableHomeOnboardingTask,
	subscribeHomeOnboardingRun,
	consumeHomeOnboardingSurfaceExposure,
	refreshHomeOnboardingRewardList,
	startHomeOnboarding,
	type HomeOnboardingReward,
	type HomeOnboardingTaskId,
} from "../LazyGuideTour"
import { useCanHostHomeOnboarding } from "../LazyGuideTour/onboardingAvailability"
import { useHomeOnboardingPreludeHeld } from "../LazyGuideTour/onboardingPrelude"
import "./entry-transition.css"

/**
 * Source directory reserved for this feature's artwork. The current
 * implementation intentionally uses vector placeholders until the product
 * artwork is supplied.
 */
export const NEW_USER_BENEFITS_ASSET_DIR = "src/pages/superMagic/components/NewUserBenefits/assets/"

/**
 * Paid on top of the last row's own reward. The dialog spells the whole pot out ("完成第一次AI工作
 * +100 积分；其余每项 +50 积分；全部完成额外 +50 积分"), so the bonus lives here and every surface
 * reads it from the rows instead of restating the total as a literal.
 *
 * A **display** figure, not a payout rule: the bonus is granted by the backend off the same data
 * this card reads, so the client never works out *whether* to pay it — only what the row set plus
 * the documented bonus adds up to. Keeping it out of the sum would understate the pot under a
 * header that names it.
 */
const COMPLETION_BONUS = 50
const ONBOARDING_EXPOSURE_RATIO = 0.01
const ONBOARDING_EXPOSURE_THRESHOLDS = [0, ONBOARDING_EXPOSURE_RATIO]

/**
 * Where the folded state is remembered. Folding the card is not a per-visit toggle but a standing
 * answer to "how much of my workspace may this cover", so it outlives the visit that set it.
 */
const ENTRY_COLLAPSED_STORAGE_KEY = "magiFeatureEntryCollapsed"

/**
 * How long the open card is given to shrink away before the pill takes its place.
 *
 * The JS half of a two-part motion whose other half is `.nb-entry-leaving` in `entry-transition.css`:
 * the exit animation has to finish before the swap, or the card is cut off mid-shrink, and waiting
 * longer than it leaves the corner empty. The two values therefore have to agree, and a test reads
 * the stylesheet to check that they still do.
 */
export const ENTRY_FOLD_OUT_MS = 150

/**
 * Reading storage can throw outright rather than merely return null — Safari in private mode does —
 * so the card falls back to open instead of failing to render.
 */
function readEntryCollapsed() {
	try {
		return window.localStorage.getItem(ENTRY_COLLAPSED_STORAGE_KEY) === "1"
	} catch {
		return false
	}
}

/**
 * Whether the reader has asked for no motion. Only the fold needs to know: it is the one change the
 * card waits out, and with the animation switched off there would be nothing to wait for — just a
 * beat of empty corner before a pill appears. Answered at the moment of the click rather than
 * followed, because a mid-fold preference change is not worth a re-render.
 */
function prefersReducedMotion() {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * What a row can be asked to do, decided from the backend's two verdicts on it.
 *
 * - `start` — nothing has happened yet: the entry into the task's guided flow.
 * - `replay` — finished and paid, and the task's flow is a review of the product rather than a job;
 *   a second pass says so instead of promising the reward again.
 * - `retry` — the task is done but its points never landed. The completion call is idempotent, so
 *   asking again is the whole fix.
 * - `done` — finished, and there is nothing this client may call: either the points are in, or the
 *   task is one only a backend system event can complete.
 * - `expired` — past `expires_at`. No call can succeed, so the row is shown for what it is.
 */
type BenefitAction = "start" | "replay" | "retry" | "done" | "expired"

/** How each action looks. The two "there is nothing to do" entries share the muted, dead look. */
const ACTION_BUTTON_CLASS: Record<BenefitAction, string> = {
	start: "bg-[#171717] text-white hover:bg-[#2b2b2b]",
	retry: "bg-[#171717] text-white hover:bg-[#2b2b2b]",
	replay: "bg-[#dfe1e7] text-[#3d4048] hover:bg-[#ced3db]",
	done: "cursor-default bg-[#dfe1e7] text-[#969ba7]",
	expired: "cursor-default bg-[#dfe1e7] text-[#969ba7]",
}

/**
 * The weight a row's icon is drawn at, and the weight that same look costs on the sidebar's own two
 * icons.
 *
 * The sidebar's four product entries are the icons these rows are meant to read as, but they do not
 * share a drawing grid: `lucide` lays its shapes out in a 24-unit square, while `MagiClaw` and
 * `Skills` — the two the sidebar keeps for itself — use a 16-unit one. A stroke width is in the
 * icon's own units and is then scaled by the box it lands in, so one number handed to both would
 * draw the custom pair half again as thick at the row's 20px: `1.9` on a 16-unit grid comes out at
 * 2.38px, against 1.58px for every lucide icon beside it. The compensation below asks the custom
 * pair for the same *drawn* line instead of the same number.
 */
const ICON_STROKE_WIDTH = 1.9
const ICON_STROKE_WIDTH_16 = (ICON_STROKE_WIDTH * 16) / 24

interface BenefitRow {
	/** The backend's code, which is what makes a row unique across a renamed flow. */
	id: string
	taskId: HomeOnboardingTaskId
	title: string
	description: string
	icon: LucideIcon
	strokeWidth: number
	points: number
	/** The backend's verdict on the task itself. */
	completed: boolean
	/** The points actually landed in the account. Not the same as `completed`. */
	granted: boolean
	recommended: boolean
	action: BenefitAction
	/** A completion call is in flight for this row, so its button is spent until it answers. */
	busy: boolean
	onAction?: () => void
}

/**
 * One row of the benefits dialog, in the state the backend last reported.
 *
 * The label is resolved with a chain of literal keys rather than a lookup table, and the row's copy
 * lives in the component below rather than in a module-level record, because tooling has to be able
 * to see every i18n key statically (see `AGENTS.md`). The cost is a handful of extra lines; the
 * alternative is keys assembled at run time that nothing can check.
 */
function NewUserBenefitsTaskRow({ row }: { row: BenefitRow }) {
	const { t } = useTranslation("super/guideTour")
	const Icon = row.icon
	const label =
		row.action === "start"
			? t("newUserBenefits.task.start")
			: row.action === "retry"
				? t("newUserBenefits.task.claimRetry")
				: row.action === "replay"
					? t("newUserBenefits.task.replay")
					: row.action === "expired"
						? t("newUserBenefits.task.expired")
						: t("newUserBenefits.task.done")
	/**
	 * The announced name of the button, built from the visible label: the wording of an action and
	 * the action itself are one fact, and restating it in a second key is how the two drift.
	 */
	const actionAriaLabel = t("newUserBenefits.task.actionAria", {
		action: label,
		title: row.title,
	})
	const actionable = Boolean(row.onAction) && !row.busy

	return (
		/*
		 * The row's identity and its state are on the row and on its button, not only in the label:
		 * a test that reads `data-task-code` keeps working when the copy changes, and the one that
		 * reads `data-task-action` answers "is this row re-watchable" without matching a translation.
		 * `row.id` is the backend's code, which is what survives a renamed flow.
		 */
		<div
			className={cn(
				"grid grid-cols-[36px_minmax(0,1fr)_78px] items-center gap-3 border-b border-[#ececec] px-0 py-3 last:border-b-0",
				row.completed && "opacity-[0.65]",
			)}
			data-task-action={row.action}
			data-task-code={row.id}
			data-testid="guide-task-row"
		>
			<div
				className={cn(
					"grid size-9 place-items-center rounded-lg bg-[#f3f3f3] text-[#171717]",
					row.completed && "text-[#8c8c8c]",
				)}
			>
				<Icon aria-hidden="true" className="size-5" strokeWidth={row.strokeWidth} />
			</div>
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<h3 className="truncate text-[15px] font-bold leading-5 text-[#171717]">
						{row.title}
					</h3>
					{row.recommended && (
						<span className="shrink-0 text-[11px] font-semibold text-[#777]">
							{t("newUserBenefits.task.recommended")}
						</span>
					)}
				</div>
				<p className="mt-1 truncate text-[12px] leading-5 text-[#666]">{row.description}</p>
				<div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#888]">
					<span>{t("newUserBenefits.task.duration")}</span>
					{/*
					 * The reward is the row's one emphasised segment: the points a completion pays,
					 * which is the backend's figure. It used to carry an expiry window beside it; the
					 * product dropped the window, so the row no longer mentions one.
					 */}
					<span className="font-bold text-[#20a66a]">
						{t("newUserBenefits.task.reward", { points: row.points })}
					</span>
				</div>
			</div>
			{/*
			 * A real `disabled` (not just a muted look) keeps a settled row from being re-entered —
			 * unless it can still be acted on, where the muted look keeps the hover affordance.
			 */}
			<button
				aria-busy={row.busy || undefined}
				aria-label={actionAriaLabel}
				className={cn(
					"h-9 rounded-[10px] px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/30",
					ACTION_BUTTON_CLASS[row.action],
				)}
				data-task-action={row.action}
				data-task-code={row.id}
				data-testid="guide-task-row-action"
				disabled={!actionable}
				onClick={actionable ? row.onAction : undefined}
				type="button"
			>
				{label}
			</button>
		</div>
	)
}

/**
 * The card itself, mounted only where the feature exists.
 *
 * Its effects ask the backend for the reward list and follow the answer, so the guard has to sit
 * outside it rather than return `null` from within: a card that mounts and then hides has already
 * made the request it was supposed to skip.
 */
function NewUserBenefitsCard() {
	const { t } = useTranslation("super/guideTour")
	const { userInfo } = useUserInfo()
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const cardContainerRef = useRef<HTMLDivElement>(null)
	const [dialogNode, setDialogNode] = useState<HTMLDivElement | null>(null)
	const dialogExposed = useRef(false)

	/**
	 * The backend's answer for this account. Read through the manager, which owns the cache, and
	 * re-read off every state change: a claim, a refresh or the first load all announce themselves
	 * the same way. The manager hands back the same object while nothing has changed, so a re-read
	 * that finds nothing new is not a re-render.
	 */
	const [rewardList, setRewardList] = useState(() =>
		getHomeOnboardingRewardList(userInfo?.magic_id),
	)
	/**
	 * Which row is waiting on a completion call. Only ever set for a row the backend can complete on
	 * request, and cleared however the call ends, so a slow network cannot leave a button spent.
	 */
	const [claiming, setClaiming] = useState<HomeOnboardingTaskId | null>(null)
	/**
	 * Whether a guided run has reserved or currently holds the screen. `useSyncExternalStore` closes
	 * the render-to-subscribe gap: a lazy fallback can reserve the screen during this component's
	 * commit without letting the card install an observer from a stale `false` snapshot.
	 */
	const runBlocking = useSyncExternalStore(
		subscribeHomeOnboardingRun,
		isHomeOnboardingRunBlocking,
		isHomeOnboardingRunBlocking,
	)

	/**
	 * Whether the entry card is folded down to its pill. Read once on mount so a stored preference
	 * applies from the first paint rather than after a visible re-open.
	 */
	const [collapsed, setCollapsed] = useState(readEntryCollapsed)

	/**
	 * Whether the open card is on its way out. The card keeps its place for one animation's worth of
	 * time so the shrink can be watched, and only then does the pill take over — a fold that swapped
	 * in a single frame is what made folding read as the card being yanked away.
	 *
	 * Nothing renders off this on its own: it is the beat *before* `collapsed`, which stays the one
	 * answer to "is this card folded".
	 */
	const [foldingOut, setFoldingOut] = useState(false)

	useEffect(() => {
		// Remembered from the moment the fold is asked for rather than when it lands, so a card taken
		// off the page mid-animation still remembers a fold the user did ask for.
		try {
			window.localStorage.setItem(
				ENTRY_COLLAPSED_STORAGE_KEY,
				collapsed || foldingOut ? "1" : "",
			)
		} catch {
			// Nothing to remember if storage refuses the write; the card still folds this session.
		}
	}, [collapsed, foldingOut])

	/**
	 * Ends the fold the card is in the middle of.
	 *
	 * A timer rather than the exit animation's own `animationend`, because the card's children
	 * animate too and their events bubble: the first grid cell to finish would otherwise declare the
	 * whole fold over. The length is the stylesheet's, kept in step by a test.
	 */
	useEffect(() => {
		if (!foldingOut) return
		const timer = window.setTimeout(() => {
			setCollapsed(true)
			setFoldingOut(false)
		}, ENTRY_FOLD_OUT_MS)
		return () => window.clearTimeout(timer)
	}, [foldingOut])

	useEffect(() => {
		const userMagicId = userInfo?.magic_id
		if (!userMagicId) return
		const syncStatus = () => setRewardList(getHomeOnboardingRewardList(userMagicId))
		syncStatus()
		// The list is the card's only source of truth, so it is asked for as soon as the card is up
		// and then followed: the tour reports its own outcome through the same event, and the rows
		// and counters update as soon as a guided flow closes.
		void ensureHomeOnboardingRewardList(userMagicId)
		window.addEventListener(HOME_ONBOARDING_STATE_EVENT, syncStatus)
		return () => window.removeEventListener(HOME_ONBOARDING_STATE_EVENT, syncStatus)
	}, [userInfo?.magic_id])

	/**
	 * The task centre asks for the account's progress again every time it is opened.
	 *
	 * The cache below is deliberately never re-fetched once the backend has answered
	 * (`ensureHomeOnboardingRewardList` returns early on a settled list), which is right for the
	 * card's own reasons — a finished tour cannot become unfinished — but it also makes the list as
	 * old as the page. A task finished after that answer landed (the first AI work is the one that
	 * always is: the backend completes it by itself while the user is still on the project page)
	 * would then read as pending for the whole visit, and the dialog is exactly where the user looks
	 * to see it. Opening the dialog is the one moment the answer has to be current, so the ask is
	 * repeated here rather than trusted to a mount that happened long ago.
	 */
	useEffect(() => {
		if (!open) return
		void refreshHomeOnboardingRewardList(userInfo?.magic_id)
	}, [open, userInfo?.magic_id])

	/**
	 * Opens a task's guided flow — both the "开始体验" of an unfinished task and the "回看" of a
	 * finished one. The dialog is closed first on purpose: while a modal dialog is open Radix
	 * disables pointer events on `body`, so a tour overlay mounted behind it would be rendered but
	 * not interactive.
	 */
	const openTask = useCallback(
		(task: HomeOnboardingTaskId, isReplay: boolean) => {
			setOpen(false)
			// A task belongs to the page that carries its anchors. This card sits on the home page,
			// so a task whose steps live on a route of its own has to be navigated to — the entry is
			// then served by that page's own tour, and the home tour ignores it. A task that spans
			// routes opens on the first of them and walks the rest itself.
			const page = getHomeOnboardingTaskEntryPage(task)
			if (page === "magi-claw") navigate({ name: RouteName.MagiClaw })
			else if (page === "crew-market") navigate({ name: RouteName.CrewMarketCrew })
			else if (page === "skill-market") navigate({ name: RouteName.CrewMarketSkills })
			else if (page === "micro-apps") navigate({ name: RouteName.MicroApps })
			else if (page === "slides-templates") navigate({ name: RouteName.SuperSlidesTemplates })
			else if (page === "recordings") navigate({ name: RouteName.AudioRecordings })
			// The account is named so the entry can spend this account's introduction: from the
			// moment a task is opened from the card, the dialog is behind it for good.
			startHomeOnboarding(task, userInfo?.magic_id, isReplay)
		},
		[navigate, userInfo?.magic_id],
	)

	/**
	 * Asking for a task's points again, for a row the backend reports as done but unpaid.
	 *
	 * Nothing is recorded locally here: the manager only marks a task finished once the backend says
	 * the grant went through, so a failure simply leaves this row as it was — still claimable — which
	 * is what makes the retry the user's to make rather than something the card swallows.
	 *
	 * A grant is announced here for the same reason the tour announces one: points landing in an
	 * account is worth a word, and the row's own state change is easy to miss under a dialog.
	 */
	const claimReward = useCallback(
		async (task: HomeOnboardingTaskId) => {
			const userMagicId = userInfo?.magic_id
			if (!userMagicId) return
			setClaiming(task)
			const result = await claimHomeOnboardingReward(userMagicId, task)
			setClaiming(null)
			if (result.ok) {
				magicToast.success({
					content: t("homeOnboarding.claim.granted", { points: result.points }),
					duration: 3000,
				})
				return
			}
			const copy = homeOnboardingClaimFailureKey(result.code)
			if (copy) magicToast.error({ content: t(copy), duration: 3000 })
		},
		[t, userInfo?.magic_id],
	)

	/**
	 * What each row says, still keyed by the *flow* id rather than the backend code: the backend
	 * decides which tasks exist, in what order, what they are worth and where they stand, while the
	 * copy and the icon are this client's own and are written out here so every i18n key is a
	 * literal.
	 *
	 * The four rows that exist as an entry in the sidebar's own menu — AI PPT, the claw, skills and
	 * micro apps — are drawn with that menu's icon, so a task reads as the product it opens rather
	 * than as a second, private picture of it. `baseMarketMenuItems.ts` and
	 * `MicroAppsSidebarMenuItem` are where those choices live; taking one from here instead is how
	 * the two drift apart. `strokeWidth` is the grid compensation above, not taste.
	 */
	const rowPresentation: Record<
		HomeOnboardingTaskId,
		{
			title: string
			description: string
			icon: LucideIcon
			strokeWidth?: number
			recommended?: boolean
		}
	> = {
		"first-ai-work": {
			title: t("newUserBenefits.tasks.firstAiWork.title"),
			description: t("newUserBenefits.tasks.firstAiWork.description"),
			icon: BookOpen,
			// The task to start with, and the only one worth more than the rest.
			recommended: true,
		},
		workbench: {
			title: t("newUserBenefits.tasks.workbench.title"),
			description: t("newUserBenefits.tasks.workbench.description"),
			icon: Grid2X2,
		},
		"create-ai-ppt": {
			title: t("newUserBenefits.tasks.aiPpt.title"),
			description: t("newUserBenefits.tasks.aiPpt.description"),
			icon: Presentation,
		},
		"audio-recording": {
			title: t("newUserBenefits.tasks.recording.title"),
			description: t("newUserBenefits.tasks.recording.description"),
			icon: Mic,
		},
		"hire-employee": {
			title: t("newUserBenefits.tasks.employees.title"),
			description: t("newUserBenefits.tasks.employees.description"),
			icon: CircleUserRound,
		},
		"manage-skill": {
			title: t("newUserBenefits.tasks.skills.title"),
			description: t("newUserBenefits.tasks.skills.description"),
			// The sidebar's own mark for "数字员工・技能・连接器", which this row's tour leads into.
			icon: Skills as LucideIcon,
			strokeWidth: ICON_STROKE_WIDTH_16,
		},
		"create-micro-app": {
			title: t("newUserBenefits.tasks.microapps.title"),
			description: t("newUserBenefits.tasks.microapps.description"),
			icon: Boxes,
		},
		"super-lobster": {
			title: t("newUserBenefits.tasks.superLobster.title"),
			description: t("newUserBenefits.tasks.superLobster.description"),
			// The claw the sidebar shows for the product, drawn on its own 16-unit grid.
			icon: MagiClaw as LucideIcon,
			strokeWidth: ICON_STROKE_WIDTH_16,
		},
	}

	/**
	 * The rows, straight off the backend's list and in the order it sent them — it is authoritative
	 * for order and for count, and a user whose progress predates a task keeps the shorter list.
	 *
	 * A code this build has no copy for is skipped rather than rendered blank: the backend may add a
	 * task before this client learns its row, and a nameless row with no flow behind it is worse than
	 * one that appears after the next release. (The manager keeps such a row, so nothing else has to
	 * throw it away.)
	 */
	const rows: BenefitRow[] = rewardList.rewards.flatMap((reward: HomeOnboardingReward) => {
		const taskId = reward.taskId
		if (!taskId) return []
		const presentation = rowPresentation[taskId]
		const granted = reward.rewardStatus === "GRANTED"
		const completed = reward.status === "COMPLETED"
		const expired = reward.status === "EXPIRED"
		const replayable = granted && isReplayableHomeOnboardingTask(taskId)
		/**
		 * Done but unpaid. The completion call is idempotent, so asking again is how the points are
		 * collected — but only for a task the backend lets a client complete: the AI-work task is
		 * finished by a system event and answers `9303` to anyone who asks, so its row is shown for
		 * what it is instead of offering a call that cannot work.
		 */
		const claimable = completed && !granted && canManuallyCompleteHomeOnboardingTask(taskId)

		const action: BenefitAction = expired
			? "expired"
			: granted
				? replayable
					? "replay"
					: "done"
				: claimable
					? "retry"
					: completed
						? "done"
						: "start"

		const onAction =
			action === "start" || action === "replay"
				? () => {
						analyticsService.report("onboarding_task_click", {
							taskId,
							action: action === "replay" ? "review" : "start",
							isRecommended: presentation.recommended === true,
						})
						openTask(taskId, action === "replay")
					}
				: action === "retry"
					? () => void claimReward(taskId)
					: undefined

		return [
			{
				id: reward.code,
				taskId,
				title: presentation.title,
				description: presentation.description,
				icon: presentation.icon,
				strokeWidth: presentation.strokeWidth ?? ICON_STROKE_WIDTH,
				points: reward.points,
				completed,
				granted,
				recommended: presentation.recommended === true,
				action,
				busy: claiming === taskId,
				onAction,
			},
		]
	})

	/**
	 * The card is a promotional surface, so it only exists once there is something to promote: while
	 * the list is on its way it would be a card whose numbers are all zero, and on a deployment that
	 * does not offer the feature (`9300`/`9301`) or a failed fetch there is nothing to show at all.
	 * Waiting costs a beat; guessing costs a wrong number in front of the user.
	 */
	const totalTasks = rows.length
	const completedTasks = rows.filter((row) => row.completed)
	const remainingTasks = rows.filter((row) => !row.completed)
	const completedCount = completedTasks.length
	const remainingCount = remainingTasks.length
	/**
	 * How much of the connector is lit: the nodes sit on a line, and two finished tasks have to read
	 * as one run of progress rather than as two islands with grey between them. The line is divided
	 * into one segment per gap — `nodes - 1` of them — and a finished task lights the segment behind
	 * it, so `n` finished tasks light `n - 1` segments and the last one lights the lot.
	 *
	 * A fraction of the *line's* length, not of the track box it is drawn in. The two are not the
	 * same length and the difference is a node: the nodes' centres sit half a node in from either
	 * edge, which is what the line is inset by, so the track box is 12px longer at 8 nodes. Handing
	 * this ratio to a `width` resolved against the box therefore overshoots by
	 * `(1 - ratio) × 12px` — nothing at one task, 6px at five, a whole 12px once every row is
	 * finished, which is the stub that hung past the last node. The lit run is scaled *inside* the
	 * line's own box instead (see the track below), so this stays a plain 0–1 progress figure and
	 * nothing here has to know how wide either box is.
	 */
	const trackSegments = totalTasks - 1
	const litTrackRatio =
		trackSegments > 0
			? Math.min(Math.max(completedCount - 1, 0), trackSegments) / trackSegments
			: 0
	/**
	 * The corner dot is a call to action, not decoration: it advertises that this card still has
	 * something to hand out. Once the last task is done there is nothing left to point at, so the
	 * dot goes with it rather than staying on a finished card.
	 */
	const hasUnfinishedTasks = remainingCount > 0
	const recommendedTaskId = rows.find((row) => row.recommended)?.taskId
	const cardVisible = useElementVisibility(cardContainerRef, {
		enabled: Boolean(rows.length) && !open && !runBlocking,
		minimumIntersectionRatio: ONBOARDING_EXPOSURE_RATIO,
		requireDocumentVisible: true,
		threshold: ONBOARDING_EXPOSURE_THRESHOLDS,
	})
	const dialogVisible = useElementVisibility(dialogNode, {
		enabled: open && Boolean(rows.length),
		minimumIntersectionRatio: ONBOARDING_EXPOSURE_RATIO,
		requireDocumentVisible: true,
		threshold: ONBOARDING_EXPOSURE_THRESHOLDS,
	})

	useEffect(() => {
		if (!cardVisible || !consumeHomeOnboardingSurfaceExposure("floating_card")) return
		analyticsService.report("onboarding_floating_card_exposure", {
			completedCount,
			totalTasks,
			collapsed,
			hasRedDot: hasUnfinishedTasks && !collapsed,
		})
	}, [cardVisible, completedCount, totalTasks, collapsed, hasUnfinishedTasks])

	useEffect(() => {
		if (!open) {
			dialogExposed.current = false
			return
		}
		if (!dialogVisible || dialogExposed.current) return
		dialogExposed.current = true
		analyticsService.report("onboarding_task_center_exposure", {
			completedCount,
			totalTasks,
			recommendedTaskId,
		})
	}, [open, dialogVisible, completedCount, totalTasks, recommendedTaskId])

	if (rows.length === 0) return null
	/**
	 * Whether the account has finished every tour this deployment offered it, which is a state of
	 * its own rather than "the best progress there is".
	 *
	 * Read off the row statuses rather than off a count of claims: the finished card reports the
	 * *work* ("已完成全部 8 项核心能力"), and a task the backend calls `COMPLETED` is done whether or
	 * not its points have been collected — a row that is done but unpaid still offers to collect
	 * them. `rows` is never empty by the time this is read (the card returns above), so "nothing left
	 * unfinished" and "everything finished" are the same claim and the negation is honest.
	 */
	const allTasksCompleted = !hasUnfinishedTasks
	/*
	 * The pot both surfaces advertise, summed from the rows rather than taken as a flat per-task
	 * figure plus a made-up total. `first-ai-work` pays double, so the old `TOTAL_TASKS * 50 + 50`
	 * understated the card and the pill beneath it by 50 points while the dialog header promised
	 * 500. The per-task figures are the backend's; the completion bonus is the documented figure.
	 */
	const maxPoints = rows.reduce((total, row) => total + row.points, 0) + COMPLETION_BONUS
	const earnedPoints = rows
		.filter((row) => row.granted)
		.reduce((total, row) => total + row.points, 0)
	const remainingPoints = maxPoints - earnedPoints

	/**
	 * Folding is asked for rather than applied: the card plays its exit first and the fold lands when
	 * that is over. Unfolding has no such beat — a box growing back out of the corner needs no exit
	 * to explain it, which is why the two directions are not the same code.
	 */
	const foldCard = () => {
		analyticsService.report("onboarding_floating_card_click", {
			action: "collapse",
			completedCount,
			totalTasks,
			hasRedDot: hasUnfinishedTasks && !collapsed,
		})
		if (prefersReducedMotion()) {
			setCollapsed(true)
			return
		}
		setFoldingOut(true)
	}

	const unfoldCard = () => setCollapsed(false)

	/**
	 * A folded card has room for one target, and the design gives it to unfolding: the pill's
	 * chevron points right and the whole pill is the button, so a click anywhere on it opens the
	 * card again. The dialog is still one click away once it is open.
	 *
	 * A card already on its way out is let go rather than reversed. Its pointer events are off while
	 * it leaves (see the wrapper), but it is still the button it was, so a keyboard activation could
	 * reach this — and it must not open the dialog of a card that is disappearing.
	 */
	const handleCardClick = () => {
		if (foldingOut) return
		analyticsService.report("onboarding_floating_card_click", {
			action: collapsed ? "expand" : "enter_task_center",
			completedCount,
			totalTasks,
			hasRedDot: hasUnfinishedTasks && !collapsed,
		})
		if (collapsed) unfoldCard()
		else setOpen(true)
	}

	/*
	 * The open card and the folded pill are two different boxes rather than one box with a
	 * modifier: open is a 310px grid of four rows, folded an auto-width pill. Neither `width: auto`
	 * nor a `display` swap interpolates, so the two are separate class sets — the CSS in
	 * `entry-transition.css` carries the motion the size change cannot. Folding is the half of that
	 * pair with a beat behind it: this box plays its exit animation first, and the swap waits for it
	 * out (`foldingOut`).
	 *
	 * The fold control is a sibling of the card rather than a child of it: the card is itself a
	 * button, and a button inside a button is invalid. The wrapper below is what pins the pair to
	 * the corner — absolutely positioned and shrink-to-fit, it is exactly as wide as whichever box
	 * is rendered, so the control can hang off that box's own top-right corner. It is also what the
	 * exit animation is applied to, so the card and the control leave together.
	 */
	return (
		<>
			{/*
			 * The wrapper carries three things the card itself cannot:
			 *
			 * - The lift. The design's control lives inside the card, so the card's own
			 *   `translateY(-2px)` carries it along for free; here the control has to be a sibling (a
			 *   button inside a button is invalid), so the hover moves up to the box holding both. One
			 *   hover region and one transform, and the control cannot drift away from its card.
			 * - The desktop gate. `hidden` is the base and `md:block` lifts it, so the card is up
			 *   only while nothing else is using the page: opening this card's own dialog drops the
			 *   last rule that lifts it, and so does a guided run — the introduction dialog of a
			 *   first visit, or the step overlays of any task entered from here. Both paint over the
			 *   whole window, and a card left underneath is one a screen reader keeps reading while a
			 *   pointer cannot reach it. Closing either returns the card.
			 * - The fold, while it is leaving. The exit animation rides here so that the fold control
			 *   goes with the card, and so does `pointer-events-none` — a card on its way out has
			 *   nothing left to be clicked for, and the control that asked for the fold is about to
			 *   unmount under the user's pointer.
			 *
			 * The gate is a display swap rather than a conditional render on purpose: `hidden` keeps
			 * the card mounted, and the two boxes below carry the fold and the unfold animation. A
			 * card that comes back from the dead would replay the wrong half of that pair.
			 */}
			<div
				ref={cardContainerRef}
				className={cn(
					"absolute right-4 top-20 z-30 hidden hover:-translate-y-0.5",
					/*
					 * Dropped for the fraction of a second the card is leaving, on purpose: the exit
					 * animation is what moves this box then, and a transform transition left on would
					 * start up off the animation's last keyframe the moment the animation is taken
					 * away — the pill would then grow under two transforms at once.
					 */
					!foldingOut && "transition-transform duration-200",
					!open && !runBlocking && "md:block",
					foldingOut && "nb-entry-leaving pointer-events-none",
				)}
			>
				<button
					/*
					 * Folded, the card no longer opens the dialog — it unfolds — so the announced
					 * action follows the state instead of promising a dialog it will not show. The
					 * design moves the "展开" / "收起" wording onto the fold control; with the control
					 * unmounted while folded, that wording lives here.
					 */
					aria-haspopup={collapsed ? undefined : "dialog"}
					aria-label={
						collapsed
							? t("newUserBenefits.entry.expand")
							: t("newUserBenefits.entry.ariaLabel")
					}
					className={cn(
						/*
						 * No `hover:-translate-y-0.5` here: the lift belongs to the wrapper, so that
						 * the fold control hanging off this card's corner travels with it.
						 */
						"group relative border border-[#292a2e] bg-[radial-gradient(circle_at_76%_36%,rgba(255,181,35,0.09),transparent_28%),linear-gradient(145deg,#151619_0%,#0c0d0f_68%,#151516_100%)] text-left text-white shadow-[0_2px_5px_rgba(0,0,0,0.18),0_18px_42px_rgba(15,15,18,0.28)] transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb523]/70",
						collapsed
							? "nb-entry-fold inline-flex w-auto min-w-0 items-center gap-3 rounded-full p-[8px_10px_8px_8px] hover:border-[#5a4e33] hover:shadow-[0_4px_9px_rgba(0,0,0,0.2),0_22px_50px_rgba(15,15,18,0.34),0_0_0_3px_rgba(255,181,35,0.14)]"
							: "nb-entry-unfold grid w-[310px] min-w-[310px] grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-[17px] p-[13px_15px_12px] hover:border-[#4a4231]",
					)}
					/*
					 * The card's state belongs on the card rather than in the counter's text: the
					 * count is a fact the whole card carries, and the fold decides what a click
					 * does — folded, it unfolds instead of opening the dialog. Both are read here so
					 * a test can ask for progress and for the fold without parsing a translation,
					 * and can find the numbers whether or not the counter is on screen.
					 */
					data-collapsed={collapsed ? "true" : "false"}
					data-completed={completedCount}
					data-total={totalTasks}
					data-testid="guide-task-entry"
					onClick={handleCardClick}
					type="button"
				>
					{/* Shown while any task is still unfinished; a fully finished or folded card loses it. */}
					{hasUnfinishedTasks && !collapsed ? (
						<span
							aria-hidden="true"
							className="pointer-events-none absolute -right-[5px] -top-[5px] size-[10px] rounded-full bg-[#ff5b0a] shadow-[0_0_0_2px_rgba(255,91,10,0.12)]"
						/>
					) : null}
					{collapsed ? (
						/*
						 * The pill is the whole card here, and the button already announces the action,
						 * so its pieces are decoration — nothing in it is a fact the button does not
						 * already carry.
						 */
						<span
							aria-hidden="true"
							className="nb-entry-pill-in inline-flex items-center gap-3"
						>
							<span className="grid size-[38px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_34%,rgba(255,181,35,0.38),rgba(255,181,35,0.05)_74%)] text-[#ffc43c]">
								<Gift aria-hidden="true" className="size-5" strokeWidth={1.9} />
							</span>
							<strong className="whitespace-nowrap text-[16px] font-extrabold">
								{/*
								 * Folded, this badge is the whole headline: the pill has no room
								 * for a title, so a finished set says so here. The open card keeps
								 * "新手福利" on the chip and reports the finish in its title, which
								 * is what the design does.
								 */}
								{t(
									allTasksCompleted
										? "newUserBenefits.entry.badgeDone"
										: "newUserBenefits.entry.badge",
								)}
							</strong>
							{/*
							 * The folded card advertises the pot, not the progress: it has no room for
							 * a count, and the pot is what it is offering. `em` is italic by default,
							 * hence `not-italic`.
							 */}
							<em className="whitespace-nowrap text-[16px] font-extrabold not-italic text-[#ffb523]">
								{t("newUserBenefits.entry.pillReward", { points: maxPoints })}
							</em>
							<span className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white/[0.17]">
								<ChevronRight
									aria-hidden="true"
									className="size-[15px] transition-transform group-hover:translate-x-0.5"
									strokeWidth={2.4}
								/>
							</span>
						</span>
					) : (
						<>
							{/*
							 * `pr-8` reserves the corner the fold control sits in, so the counter stops
							 * where the control begins instead of running under it.
							 */}
							<span className="col-span-2 flex items-center justify-between gap-3 pr-8">
								<span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[#ffbe3e]/20 bg-[#6f4e19]/80 px-2.5 text-[11px] font-bold text-[#fff6db]">
									<span className="size-2 rounded-full bg-[#f5b817] shadow-[0_0_9px_rgba(245,184,23,0.58)]" />
									{t("newUserBenefits.entry.badge")}
								</span>
								<strong
									className="text-[15px] font-[780] leading-none tracking-[-0.02em]"
									data-completed={completedCount}
									data-testid="guide-task-entry-progress"
									data-total={totalTasks}
								>
									{completedCount}/{totalTasks}
								</strong>
							</span>
							<span className="col-start-1 row-start-2 flex min-h-12 flex-col justify-center gap-1">
								<strong className="text-[15px] font-extrabold leading-tight">
									{/*
									 * Three headlines, one per state of the set. A finished set reports
									 * itself — there is no next tour to sell and no count left to
									 * improve, so "继续体验" would be the one thing that is not true.
									 * With nothing finished the card sells the whole pot instead of
									 * reporting progress: "继续体验" reads as a lie before the first
									 * task, and "已完成 0 项" as a discouragement. The two spans of
									 * that version are `whitespace-nowrap` so the break falls on the
									 * comma — Chinese otherwise wraps between any two glyphs, which
									 * left "领" stranded at the end of the first line.
									 */}
									{allTasksCompleted ? (
										t("newUserBenefits.entry.titleDone")
									) : completedCount === 0 ? (
										<Trans
											components={{
												line1: <span className="whitespace-nowrap" />,
												line2: <span className="whitespace-nowrap" />,
											}}
											i18nKey="newUserBenefits.entry.titleFresh"
											ns="super/guideTour"
											values={{ points: maxPoints, total: totalTasks }}
										/>
									) : (
										t("newUserBenefits.entry.title")
									)}
								</strong>
								{/*
								 * Nothing to report before the first task, so the headline stands alone.
								 * A finished set does report: how many tours there were, which is the
								 * one figure that still means something once every row is done.
								 */}
								{completedCount > 0 ? (
									<small className="text-[11px] font-medium leading-tight text-[#b9bbc1]">
										{allTasksCompleted
											? t("newUserBenefits.entry.metaDone", {
													total: totalTasks,
												})
											: t("newUserBenefits.entry.meta", {
													completed: completedCount,
													remaining: remainingCount,
												})}
									</small>
								) : null}
							</span>
							<div
								aria-hidden="true"
								className="col-start-2 row-span-2 row-start-2 grid size-[70px] place-items-center text-[#f7b42a]"
								data-assets-directory={NEW_USER_BENEFITS_ASSET_DIR}
							>
								<svg
									aria-hidden="true"
									className="h-[60px] w-[70px] -translate-y-1 drop-shadow-[0_8px_12px_rgba(245,168,25,0.16)]"
									viewBox="0 0 120 96"
								>
									<defs>
										<linearGradient
											id="newUserBenefitsEntryGold"
											x1="0"
											y1="0"
											x2="1"
											y2="1"
										>
											<stop offset="0" stopColor="#FFF09A" />
											<stop offset=".35" stopColor="#FFC43C" />
											<stop offset=".72" stopColor="#E99A13" />
											<stop offset="1" stopColor="#FFD86A" />
										</linearGradient>
									</defs>
									<path
										d="M37 18h46v29c0 17-10 29-23 29S37 64 37 47V18Z"
										fill="url(#newUserBenefitsEntryGold)"
									/>
									<path
										d="M37 27H24c0 20 8 29 22 31M83 27h13c0 20-8 29-22 31"
										fill="none"
										stroke="#F5B323"
										strokeLinecap="round"
										strokeWidth="7"
									/>
									<circle cx="60" cy="43" r="9" fill="#E29A17" />
									<circle cx="60" cy="43" r="5" fill="#FFC942" />
									<path
										d="M55 74h10v9H55zM43 83h34v8H43z"
										fill="url(#newUserBenefitsEntryGold)"
									/>
									<path
										d="M24 60c-8-3-13-9-16-17M96 60c8-3 13-9 16-17M17 66l-8-2M15 72l-8 2M103 66l8-2M105 72l8 2"
										fill="none"
										stroke="#B87B0D"
										strokeLinecap="round"
										strokeWidth="3"
									/>
								</svg>
							</div>
							{/*
							 * The track is a 2px hairline — the height the design gives it
							 * (`.feature-entry-nodes::before{height:2px}`). At 4px it read as a bar as heavy as
							 * the 12px nodes it links, so the nodes stopped standing out against it.
							 *
							 * A node is lit off the *count* of finished tasks, filling from the left, and
							 * deliberately not off the row sitting at its own index. Painting each node from
							 * its row told the truth about which task was done, and that is what read as
							 * broken: taking the second task first left the track with its second node lit and
							 * its first dark, which looks like a skipped step rather than progress. The track
							 * is a gauge here, not a checklist — the rows below it are the checklist, and they
							 * already say which task is which.
							 *
							 * Both halves of the line are pseudo-elements of this one box and carry the
							 * same insets, so they are the same line: half a node in from either edge at
							 * both ends, which is what puts each end on a node's centre and stops the
							 * grey run from poking out past the outer two nodes.
							 *
							 * The lit half is that same line *scaled* from its left end rather than given
							 * a width of its own. A width would be a percentage of this box — the longer
							 * of the two, by half a node at each end — so every partial fill overshot the
							 * node it was supposed to stop on, and a finished track ran a whole 12px past
							 * the last node. Scaling shares the grey run's box exactly instead of
							 * restating its insets in a `calc()`, and `--nb-entry-track-lit` is a plain 0–1
							 * progress figure, handed over inline because it is the only part of the
							 * drawing that depends on the account's progress.
							 */}
							<div
								className="relative col-start-1 row-start-3 flex w-[92%] items-center justify-between gap-1 before:absolute before:left-1.5 before:right-1.5 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#55575c] after:absolute after:left-1.5 after:right-1.5 after:top-1/2 after:h-0.5 after:origin-left after:-translate-y-1/2 after:scale-x-[var(--nb-entry-track-lit)] after:rounded-full after:bg-[#e7a91a]"
								style={
									{
										"--nb-entry-track-lit": String(litTrackRatio),
									} as CSSProperties
								}
							>
								{rows.map((row, index) => (
									<span
										aria-hidden="true"
										className={cn(
											"relative z-10 size-3 rounded-full border-2 border-[#111215] bg-[#777a80]",
											index < completedCount && "bg-[#e7a91a]",
										)}
										key={row.id}
									/>
								))}
							</div>
							{/*
							 * `justify-self-start` keeps the pill at content width — a grid item stretches to
							 * its whole column otherwise, and `self-end` only aligns it on the block axis.
							 */}
							<span className="col-start-1 row-start-4 inline-flex h-[26px] items-center gap-1.5 self-end justify-self-start rounded-full border border-[#ffbc34]/15 bg-[#684615]/55 px-2.5 text-[11px] font-[760] text-[#f6b92b]">
								<Gift
									aria-hidden="true"
									className="size-[14px]"
									strokeWidth={1.8}
								/>
								{/*
								 * "还差多少" while there is something to do, "已获得多少" once there is
								 * not: the same pill, told which of the two it is reporting.
								 *
								 * The finished figure is the whole pot rather than a sum of the rows the
								 * backend says it paid. It sits beside "已完成全部 8 项", and the two have
								 * to agree with each other — a sum would report the completion bonus
								 * alone whenever a finished tour's reward had not been collected yet,
								 * and would contradict the folded pill, which advertises the pot. The
								 * per-row ledger is the dialog's job: a row says "领取" for exactly the
								 * rewards still to collect, and the card points at that dialog.
								 */}
								{allTasksCompleted
									? t("newUserBenefits.entry.earnedReward", {
											points: maxPoints,
										})
									: t("newUserBenefits.entry.remainingReward", {
											points: remainingPoints,
										})}
							</span>
							<span className="col-start-2 row-start-4 grid size-9 place-items-center self-end justify-self-end rounded-full bg-gradient-to-br from-[#ffc44d] to-[#f4a928] text-[#171717] shadow-[0_7px_16px_rgba(244,169,40,0.24)]">
								<MousePointerClick
									aria-hidden="true"
									className="size-5"
									strokeWidth={1.8}
								/>
							</span>
						</>
					)}
				</button>
				{/*
				 * Only the open card carries the control. Folded, the pill has no room for a second
				 * target and needs none — being the one target is what it is for.
				 *
				 * 15px, not the design's 14px: the design hangs the control inside the card, so its
				 * 14px is measured from the card's padding box and the card's 1px border sits outside
				 * it — 15px from the outer edge, which is what the design renders as. This control's
				 * containing block is the borderless wrapper above, so the border has to be counted
				 * here instead.
				 */}
				{!collapsed ? (
					<button
						aria-expanded="true"
						aria-label={t("newUserBenefits.entry.collapse")}
						className="absolute right-[15px] top-[15px] grid size-[22px] place-items-center rounded-full bg-white/[0.08] text-[#c9cdd6] transition-colors hover:bg-white/[0.18] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb523]/70"
						onClick={foldCard}
						title={t("newUserBenefits.entry.collapse")}
						type="button"
					>
						<ChevronUp aria-hidden="true" className="size-[13px]" strokeWidth={2.2} />
					</button>
				) : null}
			</div>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent
					ref={setDialogNode}
					/*
					 * 800px now, after 920 then 860: at 920 the dialog all but filled the viewport it
					 * was reviewed in and the rows read as loose, because the flexible middle column
					 * had ~220px of slack. 800 still clears the widest intrinsic line by a wide
					 * margin — the summary explanation plus its counter is about 610px including the
					 * side padding — so nothing re-wraps.
					 */
					className="!max-w-[800px] overflow-hidden rounded-[20px] border-0 bg-white p-0 text-[#171717] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
					data-testid="guide-task-center"
					overlayClassName="bg-black/50"
					showCloseButton={false}
				>
					<DialogTitle className="sr-only">
						{t("newUserBenefits.dialog.title")}
					</DialogTitle>
					<DialogDescription className="sr-only">
						{t("newUserBenefits.dialog.description")}
					</DialogDescription>
					<div className="flex h-[min(720px,calc(100vh-64px))] min-h-0 flex-col">
						<header className="flex shrink-0 items-start justify-between border-b border-[#e7e7e7] px-8 pb-4 pt-6">
							<div>
								<h2 className="text-[30px] font-extrabold leading-none tracking-[-0.04em]">
									{t("newUserBenefits.dialog.title")}
								</h2>
								{/*
								 * The dialog's secondary copy is deliberately a step darker than the
								 * first draft: `#666` for the three description lines and `#888` for a
								 * row's duration. At the old `#777` / `#999` these sizes read too
								 * faint against white, and the duration stays the lighter of the two
								 * so the row keeps its own hierarchy.
								 */}
								<p className="mt-3 text-[14px] text-[#666]">
									{/*
									 * The reward is the headline of the dialog, so the amount and its unit
									 * are emphasised together. `Trans` keeps the emphasis inside the
									 * translation — "500 积分" and "500 points" highlight as one phrase.
									 */}
									<Trans
										components={{
											strong: <strong className="font-bold text-[#20a66a]" />,
										}}
										i18nKey="newUserBenefits.dialog.maxReward"
										ns="super/guideTour"
										values={{ points: maxPoints }}
									/>
								</p>
							</div>
							<button
								aria-label={t("newUserBenefits.dialog.close")}
								className="grid size-10 place-items-center rounded-[12px] border border-[#dedede] text-[#4c4c4c] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/30"
								data-testid="guide-task-center-close"
								onClick={() => setOpen(false)}
								type="button"
							>
								<X aria-hidden="true" className="size-6" strokeWidth={1.8} />
							</button>
						</header>

						<ScrollArea className="min-h-0 flex-1 px-8">
							{/*
							 * The heading, its explanation and the counter are the whole summary: the
							 * progress bar and the extra note are gone now that each row states its own
							 * reward and window. `items-center` keeps the counter centred on the
							 * two-line block the way the design reads it.
							 *
							 * The block is asymmetric on purpose: the design leaves only half as much
							 * room under the explanation as above the heading (`pb-3` against `pt-6`),
							 * so the divider sits close to the text instead of floating in whitespace.
							 */}
							<div className="border-b border-[#e7e7e7] pb-3 pt-6">
								<div className="flex items-center justify-between gap-6">
									<div>
										<h3 className="text-[15px] font-[750] leading-tight">
											{t("newUserBenefits.summary.title", {
												total: totalTasks,
												points: maxPoints,
											})}
										</h3>
										<p className="mt-2 text-[13px] text-[#666]">
											{t("newUserBenefits.summary.description")}
										</p>
									</div>
									<strong
										className="shrink-0 text-[14px] font-[750]"
										data-completed={completedCount}
										data-testid="guide-task-summary-progress"
										data-total={totalTasks}
									>
										{t("newUserBenefits.summary.progress", {
											completed: completedCount,
											total: totalTasks,
										})}
									</strong>
								</div>
							</div>

							<section className="py-5" data-testid="guide-task-section-pending">
								<h3 className="mb-2 flex items-center gap-3 text-[15px] font-[750]">
									{t("newUserBenefits.section.incomplete")}
									{/*
									 * `size-6` (24px) rather than the `size-8` first draft: at 32px the
									 * counter read as a second heading instead of a marker beside the
									 * 16px heading type. The "completed" section below uses the same
									 * badge.
									 */}
									<span className="grid size-6 place-items-center rounded-full bg-[#f0f0f0] text-[12px] text-[#666]">
										{remainingCount}
									</span>
								</h3>
								{remainingTasks.map((row) => (
									<NewUserBenefitsTaskRow key={row.id} row={row} />
								))}
							</section>

							{/*
							 * Nothing is finished yet, so the section — heading, counter and its
							 * divider — is dropped entirely instead of rendering an empty list.
							 */}
							{completedTasks.length > 0 && (
								<section
									className="border-t border-[#e7e7e7] py-5"
									data-testid="guide-task-section-completed"
								>
									<h3 className="mb-2 flex items-center gap-3 text-[15px] font-[750]">
										{t("newUserBenefits.section.complete")}
										<span className="grid size-6 place-items-center rounded-full bg-[#f0f0f0] text-[12px] text-[#666]">
											{completedCount}
										</span>
									</h3>
									{completedTasks.map((row) => (
										<NewUserBenefitsTaskRow key={row.id} row={row} />
									))}
								</section>
							)}
						</ScrollArea>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}

/**
 * The benefits card's entry point, and the one place both of the card's reasons to be off the screen
 * are read.
 *
 * The whole new-user onboarding is a SaaS personal-plan feature, so on a private deployment or in a
 * team organization this returns `null` without mounting the card above — nothing is rendered, no
 * reward list is asked for, and the card's own chunk is never pulled.
 *
 * The card also waits behind the dialogs that come before it: the profile one a brand-new account is
 * asked to fill in, and the daily reward one. They own the screen first, and a card underneath them
 * is one nobody can reach — as is its dialog, whose overlay would land on top of theirs. Both
 * answers are read before either return, so nothing here exists while either says no, and releasing
 * a hold brings the card back on the same mount rather than needing a reload.
 */
export default function NewUserBenefits() {
	const canHostFeature = useCanHostHomeOnboarding()
	const preludeHeld = useHomeOnboardingPreludeHeld()

	if (!canHostFeature || preludeHeld) return null

	return <NewUserBenefitsCard />
}
