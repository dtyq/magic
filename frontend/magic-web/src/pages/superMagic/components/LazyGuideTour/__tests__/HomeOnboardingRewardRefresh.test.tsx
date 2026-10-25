import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { OnboardingTask, OnboardingTaskListData } from "@/apis/modules/onboarding"

import NewUserBenefits from "../../NewUserBenefits"

/**
 * The task centre's own ask, and the one thing it must not do to the list underneath it.
 *
 * Opening the benefits dialog is the moment the account's progress is asked for again — the cache
 * is right to be stale, because a task finished after it landed (the first AI work always is) would
 * otherwise read as pending for the whole visit. But the ask is a *refresh*: the rows on screen are
 * yesterday's answer, not a blank slate. Publishing an empty list for the duration of the round trip
 * is not a quiet internal detail — the card renders **nothing** without rows, so the entry card and
 * the dialog that had just been opened are both torn out of the page, and the dialog that comes back
 * when the answer lands is a fresh mount that replays its whole entrance. On screen that is the
 * dialog blinking: it appears, vanishes, and fades in again a beat later, which is fast enough to
 * read as a rendering glitch rather than as anything the user did.
 *
 * So these cases pin the list's behaviour across the ask: what the manager publishes while the
 * request is out (nothing shorter than what was already on screen), and what the card does with it
 * (keeps its dialog, and its rows, until the new answer replaces them).
 *
 * The reward rows come from the backend and are read here through the manager itself — only the two
 * HTTP calls are replaced, so the cache, the publishing and the card are all the real ones.
 */
const { getOnboardingTasks } = vi.hoisted(() => ({ getOnboardingTasks: vi.fn() }))

vi.mock("@/apis/modules/onboarding", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/apis/modules/onboarding")>()
	return { ...actual, getOnboardingTasks }
})

/**
 * The signed-in account, moved on before each case: every piece of the manager's memory is keyed by
 * it, so a fresh name is what keeps one case's list out of the next one's way without resetting the
 * module — the card below has to be the same instance the manager publishes to.
 */
const account = { magicId: "reward-refresh-0" }

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: { magic_id: account.magicId } }),
	/*
	 * The card asks whether this deployment and this organization are the ones the feature belongs
	 * to before it mounts at all — see `onboardingAvailability`. Here the answer is the one that
	 * gets it on screen; which environments answer no is the gate's own subject.
	 */
	useOrganization: () => ({ organizationListReady: true, isPersonalOrganization: true }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))

vi.mock("@/services/analytics", () => ({ analyticsService: { report: vi.fn() } }))

vi.mock("@/utils/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/env")>()),
	isPrivateDeployment: () => false,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock("react-i18next", () => ({
	// The key is handed back rather than a sentence: these are contract checks, and the wording of
	// any of it is the locale's business. `Trans` renders its key for the same reason.
	useTranslation: () => ({ i18n: { language: "zh_CN" }, t: (key: string) => key }),
	Trans: (props: { i18nKey: string }) => props.i18nKey,
}))

let accountSequence = 0

function nextAccount() {
	accountSequence += 1
	account.magicId = `reward-refresh-${accountSequence}`
	return account.magicId
}

/** One row as the backend tabulates it, with every code this client has a flow for. */
function taskRow(code: string, points: number): OnboardingTask {
	return {
		code,
		points,
		validity_days: 7,
		status: "PENDING",
		reward_status: "PENDING",
		completed_at: null,
		reward_granted_at: null,
		expires_at: "2026-10-21T09:12:33+00:00",
	}
}

/** The eight rows the contract's appendix lists, which is what the card expects to be handed. */
const ALL_ROWS: Array<[string, number]> = [
	["first_ai_work", 100],
	["super_magic_intro", 50],
	["ai_ppt", 50],
	["ai_recording", 50],
	["digital_employee", 50],
	["skill_management", 50],
	["micro_app", 50],
	["magiclaw", 50],
]

function answer(rows: Array<[string, number]>): OnboardingTaskListData {
	return {
		participant_type: "new_register",
		tasks: rows.map(([code, points]) => taskRow(code, points)),
	}
}

/** A promise the case decides when to settle, so the in-flight window can be looked at. */
function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((settle, fail) => {
		resolve = settle
		reject = fail
	})
	return { promise, resolve, reject }
}

beforeEach(() => {
	getOnboardingTasks.mockReset()
})

describe("home onboarding reward list, asked again", () => {
	it("keeps the rows already on screen for as long as the ask is out", async () => {
		const manager = await import("../GuideTourManager")
		const magicId = nextAccount()
		getOnboardingTasks.mockResolvedValue(answer(ALL_ROWS.slice(0, 2)))
		await manager.ensureHomeOnboardingRewardList(magicId)
		expect(manager.getHomeOnboardingRewardList(magicId).rewards).toHaveLength(2)

		/*
		 * What the card would render from, recorded on every announcement the manager makes — the
		 * card reads the cache each time one lands and renders nothing at all when it finds no rows.
		 */
		const published: number[] = []
		const record = () =>
			published.push(manager.getHomeOnboardingRewardList(magicId).rewards.length)
		window.addEventListener(manager.HOME_ONBOARDING_STATE_EVENT, record)

		const held = deferred<OnboardingTaskListData>()
		getOnboardingTasks.mockReturnValueOnce(held.promise)
		const asking = manager.refreshHomeOnboardingRewardList(magicId)

		// Only the window the request is out in is recorded; everything it says after it lands is the
		// new answer's business.
		window.removeEventListener(manager.HOME_ONBOARDING_STATE_EVENT, record)

		held.resolve(answer(ALL_ROWS.slice(0, 3)))
		await asking

		expect(published).not.toContain(0)
		expect(published[0]).toBe(2)
		expect(manager.getHomeOnboardingRewardList(magicId).rewards).toHaveLength(3)
	})

	it("keeps them when the ask fails, rather than emptying the card", async () => {
		const manager = await import("../GuideTourManager")
		const magicId = nextAccount()
		getOnboardingTasks.mockResolvedValue(answer(ALL_ROWS.slice(0, 2)))
		await manager.ensureHomeOnboardingRewardList(magicId)

		getOnboardingTasks.mockRejectedValueOnce(new Error("offline"))
		await manager.refreshHomeOnboardingRewardList(magicId)

		const list = manager.getHomeOnboardingRewardList(magicId)
		expect(list.status).toBe("failed")
		expect(list.rewards).toHaveLength(2)
	})
})

/**
 * The row titles the dialog is showing, in the order it renders them — empty when there is no
 * dialog, which is the state this case has to be able to look at.
 */
function rowTitles() {
	return screen
		.queryAllByRole("heading", { level: 3 })
		.map((heading) => heading.textContent ?? "")
		.filter((text) => text.startsWith("newUserBenefits.tasks."))
}

describe("home onboarding task centre, while the list is asked again", () => {
	it("keeps the dialog it just opened up, instead of tearing it down and rebuilding it", async () => {
		// A fresh account: the card reads it through `useUserInfo`, which answers with this name.
		nextAccount()
		getOnboardingTasks.mockResolvedValue(answer(ALL_ROWS))

		render(<NewUserBenefits />)
		const entry = await screen.findByLabelText("newUserBenefits.entry.ariaLabel")
		expect(rowTitles()).toHaveLength(0)

		// The account's progress is asked for again as the dialog opens; here it is held open so the
		// frame or two the user would have seen could be inspected.
		const held = deferred<OnboardingTaskListData>()
		getOnboardingTasks.mockReturnValueOnce(held.promise)
		fireEvent.click(entry)

		/*
		 * The card is still on the page, and the dialog it just opened is still up with the rows the
		 * account came in with. The card renders *nothing* without rows, so a list published empty
		 * for the length of the ask takes both of them off the screen at once — this is the frame the
		 * user sees as a blink.
		 */
		expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeTruthy()
		expect(screen.getByRole("dialog")).toBeTruthy()
		expect(rowTitles()).toHaveLength(8)

		await act(async () => {
			held.resolve(answer(ALL_ROWS.slice(0, 1)))
			await held.promise
		})

		// The answer lands on the open dialog rather than replacing it.
		await waitFor(() => expect(rowTitles()).toHaveLength(1))
		expect(screen.getByRole("dialog")).toBeTruthy()
	})
})
