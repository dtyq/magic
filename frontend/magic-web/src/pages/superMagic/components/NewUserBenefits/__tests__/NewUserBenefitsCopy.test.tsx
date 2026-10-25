import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { ComponentType } from "react"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Boxes } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enGuideTour from "@/assets/locales/en_US/super/guideTour.json"
import zhGuideTour from "@/assets/locales/zh_CN/super/guideTour.json"
import { BASE_MARKET_MENU_ITEMS } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/baseMarketMenuItems"

/*
 * The verdict is handed over directly rather than through the barrel the component imports: only a
 * tour ever writes it, so the barrel has no reason to pass the writer on to the product.
 */
import {
	setHomeOnboardingAnalyticsScope,
	setHomeOnboardingRunActive,
	setHomeOnboardingRunPending,
} from "../../LazyGuideTour/GuideTourManager"
import {
	holdHomeOnboardingPrelude,
	releaseHomeOnboardingPrelude,
} from "../../LazyGuideTour/onboardingPrelude"
import {
	type HomeOnboardingReward,
	type HomeOnboardingRewardList,
	type HomeOnboardingTaskId,
} from "../../LazyGuideTour"
import NewUserBenefits, { ENTRY_FOLD_OUT_MS } from "../index"

const { analyticsReport } = vi.hoisted(() => ({ analyticsReport: vi.fn() }))
vi.mock("@/services/analytics", () => ({
	analyticsService: { report: analyticsReport },
}))

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * What the 新手福利 dialog promises, as the latest design states it.
 *
 * The design dropped the dialog-wide countdown in favour of a 7-day window on every row, and
 * simplified the summary down to a heading, its explanation and the counter. Both are easy to
 * "restore" by accident, because nothing else in the dialog would look wrong — so this file pins
 * them: the header asks for the reward line and no longer for a countdown, the summary block holds
 * nothing but that one row, the section follows it directly, and every row still carries its
 * duration, reward and window.
 *
 * Copy itself is not asserted: the mock hands back the key, so these are contract checks that
 * survive wording changes. It still records what every slot was rendered with — the interpolated
 * numbers and the markup the wording rides on — which is how the point total and the card's forced
 * line break stay pinned without the copy being restated here.
 */
const { calls, translate } = vi.hoisted(() => {
	const calls: Array<{
		key: string
		/** The named slots `Trans` was handed, as `[name, className]` pairs. */
		slots: Array<[string, string]>
		values?: Record<string, unknown>
	}> = []
	return {
		calls,
		translate: (key: string, values?: Record<string, unknown>) => {
			calls.push({ key, slots: [], values })
			return key
		},
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ i18n: { language: "en_US" }, t: translate }),
	// The real one interpolates markup; here the key alone is enough to name the string a slot uses.
	Trans: (props: {
		components?: Record<string, unknown>
		i18nKey: string
		values?: Record<string, unknown>
	}) => {
		calls.push({
			key: props.i18nKey,
			slots: Object.entries(props.components ?? {}).map(([name, node]) => [
				name,
				(node as { props?: { className?: string } })?.props?.className ?? "",
			]),
			values: props.values,
		})
		return props.i18nKey
	},
}))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: { magic_id: "magic-benefits-copy" } }),
	/*
	 * The card asks whether this deployment and this organization are the ones the feature belongs
	 * to before it mounts at all — see `onboardingAvailability`. This file is about the card's own
	 * contract, so the answer here is the one that gets it on screen: a SaaS personal organization.
	 * Which environments answer no is the gate's subject, and is covered where the gate lives.
	 */
	useOrganization: () => ({ organizationListReady: true, isPersonalOrganization: true }),
}))

vi.mock("@/utils/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/env")>()),
	isPrivateDeployment: () => false,
}))

/** What the card said to the user, oldest first — every toast is captured rather than rendered. */
const { toasts } = vi.hoisted(() => ({
	toasts: [] as Array<{ type: "error" | "success"; content: string }>,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: (options: { content: string }) => {
			toasts.push({ type: "error", content: options.content })
		},
		success: (options: { content: string }) => {
			toasts.push({ type: "success", content: options.content })
		},
	},
}))

/**
 * The backend's answer, as this card sees it.
 *
 * The rows are the eight the contract's appendix lists, in the order it lists them, with the
 * documented points — so the card is exercised against the real shape rather than a fixture shaped
 * to flatter it. Two sets stand in for what the user has done, and the factory below turns them
 * into `status`/`reward_status` the way the backend would.
 *
 * The code → flow mapping is deliberately *not* restated here: it is read off the module under
 * test, so a row the card cannot place would fail these tests the same way it would fail the app.
 */
const {
	TASK_ROWS,
	listState,
	unpaidRows,
	paidRows,
	claimReward,
	refreshRewardList,
	buildRewardList,
} = vi.hoisted(() => {
	/** `code` and `points`, exactly as the contract's appendix tabulates them. */
	const TASK_ROWS: Array<{ code: string; points: number }> = [
		{ code: "first_ai_work", points: 100 },
		{ code: "super_magic_intro", points: 50 },
		{ code: "ai_ppt", points: 50 },
		{ code: "ai_recording", points: 50 },
		{ code: "digital_employee", points: 50 },
		{ code: "skill_management", points: 50 },
		{ code: "micro_app", points: 50 },
		{ code: "magiclaw", points: 50 },
	]
	/** What the account has done, by code: done-but-unpaid and done-and-paid. */
	const unpaidRows = new Set<string>()
	const paidRows = new Set<string>()
	const claimReward = vi.fn()
	/** The ask the card makes when its task centre is opened — see the case below. */
	const refreshRewardList = vi.fn()
	/**
	 * The three answers a deployment can give that are not a full list: no feature, nothing to
	 * show yet, and a task this build has no row for.
	 */
	const listState = { empty: false, extraCode: null as string | null }

	return {
		TASK_ROWS,
		listState,
		unpaidRows,
		paidRows,
		claimReward,
		refreshRewardList,
		buildRewardList,
	}

	function buildRewardList(
		toTaskId: (code: string) => HomeOnboardingTaskId | null,
	): HomeOnboardingRewardList {
		if (listState.empty) return { status: "ready", rewards: [] }

		const rows = listState.extraCode
			? [...TASK_ROWS, { code: listState.extraCode, points: 50 }]
			: TASK_ROWS

		const rewards: HomeOnboardingReward[] = rows.map(({ code, points }) => {
			const done = paidRows.has(code) || unpaidRows.has(code)
			return {
				taskId: toTaskId(code),
				code,
				points,
				validityDays: 7,
				status: done ? "COMPLETED" : "PENDING",
				rewardStatus: paidRows.has(code) ? "GRANTED" : "PENDING",
				completedAt: null,
				rewardGrantedAt: null,
				expiresAt: "2026-10-06T09:12:33+00:00",
			}
		})

		return { status: "ready", rewards }
	}
})

vi.mock("../../LazyGuideTour", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../LazyGuideTour")>()
	return {
		...actual,
		// The card reads the list through the manager, which owns the cache; here it is a fixture.
		getHomeOnboardingRewardList: () => buildRewardList(actual.getHomeOnboardingTaskIdByCode),
		ensureHomeOnboardingRewardList: () => Promise.resolve(),
		/*
		 * Recorded rather than stubbed away: the ask the card makes when its task centre is opened
		 * is one of the behaviours this file pins — see "the task centre asks again". It stands in
		 * for the round trip, so the case can assert the ask without a network behind it.
		 */
		refreshHomeOnboardingRewardList: refreshRewardList,
		claimHomeOnboardingReward: claimReward,
	}
})

/** The pot the design pays out once every tour is done. */
const MAX_POINTS = 500

/** Where the design stores the folded state; a rename here would silently forget it. */
const COLLAPSED_KEY = "magiFeatureEntryCollapsed"

beforeEach(() => {
	analyticsReport.mockClear()
	calls.length = 0
	toasts.length = 0
	paidRows.clear()
	unpaidRows.clear()
	listState.empty = false
	listState.extraCode = null
	claimReward.mockReset()
	claimReward.mockResolvedValue({ ok: true, points: 50 })
	refreshRewardList.mockReset()
	// The card reads its folded state on mount, and jsdom keeps storage for the whole file — so a
	// test that folds the card would otherwise decide the state every later test starts in.
	window.localStorage.clear()
	// Likewise for the run signal: it lives in the tour's module, which this file does not reset, so
	// a test that hands the screen to a run would otherwise hide the card for every later one.
	setHomeOnboardingRunActive(false)
	setHomeOnboardingRunPending(false)
	// And for the holds that put a dialog in front of the card, which live in their own module for
	// the same reason.
	releaseHomeOnboardingPrelude("user-profile-dialog")
	releaseHomeOnboardingPrelude("daily-reward-dialog")
	releaseHomeOnboardingPrelude("daily-reward-claim")
})

/** Every render of the slot named by `key`, oldest first. */
function rendersOf(key: string) {
	return calls.filter((call) => call.key === key)
}

/** The content of every notice of one kind, oldest first. */
function notices(type: "error" | "success") {
	return toasts.filter((toast) => toast.type === type).map((toast) => toast.content)
}

/**
 * How much of the card's connector is lit, as the 0–1 figure the lit run is scaled by.
 *
 * It travels as a CSS custom property rather than a class, because it is the one part of the
 * drawing that follows the account's progress — and the lit run is a pseudo-element, so there is no
 * box to read a width or a scale off. A bare number, not a percentage: the lit run is a fraction of
 * the *line*, and the line is shorter than the track box it is drawn in (half a node at each end),
 * so a percentage of the box would overshoot the node it stops on — least visibly at one task, by a
 * whole node once every row is finished.
 */
function litTrackRatio() {
	const card = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
	const track = card.querySelector('[class*="55575c"]') as HTMLElement
	return Number.parseFloat(track.style.getPropertyValue("--nb-entry-track-lit"))
}

/** The order the design lists the eight tours in — the order the backend advertises them in too. */
const ROW_ORDER = [
	"firstAiWork",
	"workbench",
	"aiPpt",
	"recording",
	"employees",
	"skills",
	"microapps",
	"superLobster",
]

/** The tour names, in the order the dialog renders them. */
function rowTitles() {
	return screen
		.getAllByRole("heading", { level: 3 })
		.map((heading) => heading.textContent ?? "")
		.filter((text) => text.startsWith("newUserBenefits.tasks."))
		.map((text) => text.replace("newUserBenefits.tasks.", "").replace(".title", ""))
}

/** Opens the dialog the way the card's entry button does. */
function openDialog() {
	render(<NewUserBenefits />)
	fireEvent.click(screen.getByLabelText("newUserBenefits.entry.ariaLabel"))
}

/** The bordered block that holds the heading, its explanation and the counter. */
function summaryBlock() {
	// <p> → the title/description column → the row holding the counter → the bordered block.
	const column = screen.getByText("newUserBenefits.summary.description")
		.parentElement as HTMLElement
	const summaryRow = column.parentElement as HTMLElement
	return { column, summaryRow, block: summaryRow.parentElement as HTMLElement }
}

/** The action button of the row whose title slot is `titleKey`: `<h3>` → text column → row. */
function rowAction(titleKey: string) {
	const title = screen.getByText(`newUserBenefits.tasks.${titleKey}.title`)
	const row = title.parentElement?.parentElement?.parentElement as HTMLElement
	return row.querySelector("button") as HTMLButtonElement
}

describe("NewUserBenefits dialog copy", () => {
	it("states the reward in the header instead of a dialog-wide countdown", () => {
		openDialog()

		expect(screen.getByText("newUserBenefits.dialog.maxReward")).toBeTruthy()
		expect(screen.queryByText("newUserBenefits.dialog.expiry")).toBeNull()
	})

	it("keeps the summary to one row and lets the task list follow it", () => {
		openDialog()

		const { summaryRow, block } = summaryBlock()
		// The row is the text column plus the counter. The bar and the note used to follow it inside
		// the block, so both would break either assertion below.
		expect(summaryRow.children).toHaveLength(2)
		expect(block.children).toHaveLength(1)
		expect(block.nextElementSibling?.tagName).toBe("SECTION")

		const summary = block.textContent ?? ""
		expect(summary).toContain("newUserBenefits.summary.title")
		expect(summary).toContain("newUserBenefits.summary.progress")
		expect(screen.queryByText("newUserBenefits.summary.note")).toBeNull()
	})

	it("hangs the divider just under the explanation", () => {
		openDialog()

		// The block is deliberately asymmetric: the design leaves about half as much room under the
		// explanation as above the heading, so the divider does not float in whitespace. A plain
		// `py-*` would restore the even spacing and the gap the user asked to tighten.
		const { block } = summaryBlock()
		const classes = block.className.split(/\s+/)
		expect(classes).toContain("pt-6")
		expect(classes).toContain("pb-3")
		expect(classes).not.toContain("py-6")
	})

	it("keeps the section counters in a compact badge", () => {
		openDialog()

		// 24px next to 16px heading type. At the 32px it started at, the counter read as a second
		// heading rather than a marker. The "completed" section is dropped while nothing is
		// finished, so only the "remaining" counter is on screen; both share the class.
		const counters = screen
			.getAllByRole("heading", { level: 3 })
			.filter((heading) => (heading.textContent ?? "").startsWith("newUserBenefits.section."))
		expect(counters).toHaveLength(1)

		const badge = counters[0].querySelector("span") as HTMLElement
		const classes = badge.className.split(/\s+/)
		expect(classes).toContain("size-6")
		expect(classes).not.toContain("size-7")
		expect(classes).not.toContain("size-8")
	})

	it("keeps the secondary copy a shade darker than the first draft", () => {
		openDialog()

		/*
		 * The four pieces of secondary copy the user asked to deepen: the header line, the summary
		 * explanation, a row's description and a row's duration. The first three used to sit at
		 * `#777` and the duration at `#999` — both too faint at 11–14px against white. The
		 * "recommended" tag next to a title is deliberately left at `#777`: it was not in the set.
		 */
		const headerLine = screen.getByText("newUserBenefits.dialog.maxReward")
		const summaryLine = screen.getByText("newUserBenefits.summary.description")
		const rowDescriptions = screen.getAllByText(/^newUserBenefits\.tasks\..+\.description$/)
		const rowDurations = screen.getAllByText("newUserBenefits.task.duration")

		expect(rowDescriptions).toHaveLength(ROW_ORDER.length)
		expect(rowDurations).toHaveLength(ROW_ORDER.length)

		for (const line of [headerLine, summaryLine, ...rowDescriptions]) {
			const classes = line.className.split(/\s+/)
			expect(classes).toContain("text-[#666]")
			expect(classes).not.toContain("text-[#777]")
		}

		// The duration span carries no colour of its own — the row's meta line does.
		for (const duration of rowDurations) {
			const metaLine = (duration.parentElement as HTMLElement).className.split(/\s+/)
			expect(metaLine).toContain("text-[#888]")
			expect(metaLine).not.toContain("text-[#999]")
		}
	})

	it("keeps the dialog narrower than the first draft", () => {
		openDialog()

		/*
		 * 800px, after a 920px first draft and an intermediate 860px. At 920 the dialog all but
		 * filled the viewport it was reviewed in — barely 20px of margin a side — and the rows read
		 * as loose, because the flexible middle column had ~220px of slack. The widest intrinsic
		 * line is the summary explanation plus its counter at about 610px including the side
		 * padding, so the narrower frame does not make anything re-wrap.
		 */
		const dialog = screen.getByRole("dialog")
		const classes = dialog.className.split(/\s+/)
		expect(classes).toContain("!max-w-[800px]")
		expect(classes).not.toContain("!max-w-[860px]")
		expect(classes).not.toContain("!max-w-[920px]")
	})

	it("lists the tours in the order the backend sends them", () => {
		openDialog()

		expect(rowTitles()).toEqual(ROW_ORDER)
	})

	it("recommends the first tour and no other", () => {
		openDialog()

		const badge = screen.getByText("newUserBenefits.task.recommended")
		expect(badge.parentElement?.textContent).toContain(
			"newUserBenefits.tasks.firstAiWork.title",
		)
	})

	it("gives every row its duration and reward", () => {
		openDialog()

		expect(screen.getAllByText("newUserBenefits.task.duration")).toHaveLength(ROW_ORDER.length)
		expect(screen.getAllByText("newUserBenefits.task.reward")).toHaveLength(ROW_ORDER.length)

		/*
		 * The reward is the row's last word. It used to trail an expiry window
		 * (`task.validity`), which the product dropped, so the row must not render one — and the
		 * keys have to leave both locales rather than merely stop being referenced: a translation
		 * left behind is what the next person wires back in when they want a label.
		 */
		expect(screen.queryByText("newUserBenefits.task.validity")).toBeNull()

		for (const locale of [zhGuideTour, enGuideTour]) {
			expect(locale.newUserBenefits.task).not.toHaveProperty("validity")
		}
	})
})

describe("NewUserBenefits rows come from the backend", () => {
	it("draws one row and one progress node per task the backend advertises", () => {
		openDialog()

		expect(rowTitles()).toHaveLength(TASK_ROWS.length)
		expect(screen.getByText(`0/${TASK_ROWS.length}`)).toBeTruthy()
	})

	it("marks a paid task done, and offers the review rather than the reward again", () => {
		paidRows.add("ai_ppt")
		openDialog()

		const action = rowAction("aiPpt")
		expect(action.textContent).toBe("newUserBenefits.task.replay")
		// Paid and re-watchable, so the button opens the review; the reward is not on offer twice.
		expect(action.disabled).toBe(false)
	})

	it("offers the review on every finished tour but the AI-work one", () => {
		/*
		 * The reported bug: a finished 了解超级龙虾如何使用 stayed a dead "已完成" while every other
		 * finished tour offered 回看. Its tour only points at parts of the MagiClaw page — a demo,
		 * like the crew-market one — so it belongs in the reviewable set whatever route serves it.
		 *
		 * All eight rows at once, because the rule is about the task and not about the row: the
		 * only one that may not be watched again is the flow that walks a real piece of work.
		 */
		for (const { code } of TASK_ROWS) paidRows.add(code)
		openDialog()

		const labels = ROW_ORDER.map((title) => rowAction(title).textContent)
		expect(labels).toEqual([
			"newUserBenefits.task.done",
			...ROW_ORDER.slice(1).map(() => "newUserBenefits.task.replay"),
		])
	})

	it("never offers to claim the AI-work task, which only a system event can finish", () => {
		paidRows.add("first_ai_work")
		openDialog()

		const action = rowAction("firstAiWork")
		expect(action.textContent).toBe("newUserBenefits.task.done")
		expect(action.disabled).toBe(true)
	})

	it("offers a retry for a task that is done but was never paid", () => {
		unpaidRows.add("ai_ppt")
		openDialog()

		const action = rowAction("aiPpt")
		expect(action.textContent).toBe("newUserBenefits.task.claimRetry")
		expect(action.disabled).toBe(false)
	})

	it("keeps a done-but-unpaid AI-work task dead rather than offering a call it cannot make", () => {
		// The backend answers `9303` to any manual completion of this one, so an unpaid row must
		// still show as finished instead of a retry that is guaranteed to fail.
		unpaidRows.add("first_ai_work")
		openDialog()

		expect(rowAction("firstAiWork").textContent).toBe("newUserBenefits.task.done")
		expect(rowAction("firstAiWork").disabled).toBe(true)
	})

	it("re-asks for the points when a retry is clicked, and keeps the row if it fails", async () => {
		unpaidRows.add("ai_ppt")
		claimReward.mockResolvedValue({
			ok: false,
			code: 9306,
			retryable: true,
			message: "ignored",
		})
		openDialog()

		await act(async () => {
			fireEvent.click(rowAction("aiPpt"))
		})

		expect(claimReward).toHaveBeenCalledWith("magic-benefits-copy", "create-ai-ppt")
		// The row is exactly as it was: still claimable, which is what makes the retry the user's.
		expect(rowAction("aiPpt").textContent).toBe("newUserBenefits.task.claimRetry")
		expect(rowAction("aiPpt").disabled).toBe(false)
		// Our own copy, not the backend's `message`: the endpoint does no language negotiation.
		expect(notices("error")).toEqual(["homeOnboarding.claim.retry"])
	})

	it("announces the points a retry finally granted", async () => {
		unpaidRows.add("ai_ppt")
		claimReward.mockResolvedValue({ ok: true, points: 50 })
		openDialog()

		await act(async () => {
			fireEvent.click(rowAction("aiPpt"))
		})

		/*
		 * A grant used to be silent here, and silence is indistinguishable from a failure: the row
		 * would flip to "已完成" and the counter would move, but the user clicked a button that
		 * promised points and got no word about them.
		 *
		 * The figure is the backend's own, not the row's advertised price — same number today, but
		 * the one that actually landed is the one worth saying.
		 */
		expect(notices("success")).toEqual(["homeOnboarding.claim.granted"])
		expect(rendersOf("homeOnboarding.claim.granted")[0]?.values).toEqual({ points: 50 })
		expect(notices("error")).toEqual([])
	})

	it("says nothing when the deployment stops offering the feature mid-claim", async () => {
		unpaidRows.add("ai_ppt")
		claimReward.mockResolvedValue({ ok: false, code: 9301, retryable: false, message: null })
		openDialog()

		await act(async () => {
			fireEvent.click(rowAction("aiPpt"))
		})

		expect(toasts).toEqual([])
	})

	it("drops a code this build has no row for, keeping the rest", () => {
		// The backend may add a task before this client learns its copy; a nameless, flow-less row
		// would be worse than one that appears with the next release.
		listState.extraCode = "brand_new_task"
		openDialog()

		expect(rowTitles()).toEqual(ROW_ORDER)
		expect(screen.queryByText(/brand_new_task/)).toBeNull()
	})
})

/**
 * The card asks the backend for the account's progress every time its task centre is opened, rather
 * than showing whatever the page's first answer left behind.
 *
 * The manager deliberately never re-fetches a settled list (`ensureHomeOnboardingRewardList` returns
 * early on one), and that rule is exactly why this matters: a task finished after that answer landed
 * — the first AI work is the one that always is, because the backend completes that row on its own
 * while the user is still on the project page — would read as pending for the rest of the visit, in
 * the one place the user goes to check it.
 */
describe("NewUserBenefits task centre asks again", () => {
	it("asks for the latest progress when it is opened, and not while it is closed", () => {
		render(<NewUserBenefits />)

		// On the page but unopened: the mount's own ask is `ensureHomeOnboardingRewardList`, which
		// is a no-op once the list has settled, and nothing has been re-asked for on the card's
		// behalf yet.
		expect(refreshRewardList).not.toHaveBeenCalled()

		fireEvent.click(screen.getByLabelText("newUserBenefits.entry.ariaLabel"))

		expect(refreshRewardList).toHaveBeenCalledTimes(1)
		expect(refreshRewardList).toHaveBeenCalledWith("magic-benefits-copy")
	})

	it("asks again on the next opening rather than reusing the first answer", () => {
		openDialog()
		expect(refreshRewardList).toHaveBeenCalledTimes(1)

		// Closed and opened again: what is on screen is as old as the last opening, so the second
		// one adds its own ask instead of inheriting the first.
		fireEvent.click(screen.getByLabelText("newUserBenefits.dialog.close"))
		fireEvent.click(screen.getByLabelText("newUserBenefits.entry.ariaLabel"))

		expect(refreshRewardList).toHaveBeenCalledTimes(2)
	})
})

describe("NewUserBenefits row icons", () => {
	/**
	 * The rows whose task is a product the sidebar's menu also lists, and the key the sidebar
	 * declares that entry under.
	 *
	 * Read off the sidebar's own table rather than restated: `BASE_MARKET_MENU_ITEMS` is where the
	 * three market entries choose their icon, so swapping one there fails here instead of leaving
	 * the card drawing a second, private picture of the same product. Micro apps has its own menu
	 * item rather than a market entry, and is compared against that component's icon instead.
	 */
	const SHARED_WITH_SIDEBAR: Array<[row: string, sidebarTitleKey: string]> = [
		["aiPpt", "sidebar:slidesTemplates.title"],
		["skills", "sidebar:skillsLibrary.title"],
		["superLobster", "sidebar:superLobster.title"],
	]

	/** The shape an icon draws, under the name lucide stamps on it — one name for both sides. */
	function shapeOf(className: string) {
		return (
			className
				.split(/\s+/)
				.find((name) => name.startsWith("lucide-") && name.length > "lucide-".length) ?? ""
		)
	}

	/** The icon component a sidebar market entry uses. */
	function sidebarIcon(titleKey: string) {
		const item = BASE_MARKET_MENU_ITEMS.find((entry) => entry.titleKey === titleKey)
		if (!item) throw new Error(`the sidebar no longer lists ${titleKey}`)
		return item.Icon
	}

	/** A component's own shape name, taken from its markup. */
	function componentShape(Icon: ComponentType) {
		return shapeOf(renderToStaticMarkup(<Icon />).match(/class="([^"]*)"/)?.[1] ?? "")
	}

	/** The `<svg>` a row draws: the title heading → text column → row. */
	function rowIcon(row: string) {
		const title = screen.getByText(`newUserBenefits.tasks.${row}.title`)
		const svg = (
			title.parentElement?.parentElement?.parentElement as HTMLElement
		).querySelector("svg")
		if (!svg) throw new Error(`the ${row} row draws no icon`)
		return svg
	}

	function rowShape(row: string) {
		return shapeOf(rowIcon(row).getAttribute("class") ?? "")
	}

	/**
	 * The weight a row's shape is drawn at. Read off whichever element declares it: lucide puts it
	 * on the root `<svg>`, while the sidebar's two custom icons put it on the path itself.
	 */
	function rowStrokeWidth(row: string) {
		const svg = rowIcon(row)
		const declared =
			svg.getAttribute("stroke-width") ??
			svg.querySelector("path")?.getAttribute("stroke-width")
		if (declared == null) throw new Error(`the ${row} row declares no stroke width`)
		return Number(declared)
	}

	it("draws the four product rows with the icons the sidebar uses for them", () => {
		openDialog()

		for (const [row, sidebarTitleKey] of SHARED_WITH_SIDEBAR) {
			expect(rowShape(row)).toBe(componentShape(sidebarIcon(sidebarTitleKey)))
		}

		// A product the card lists but the market table does not: its menu item is the only place
		// that picks this one.
		expect(rowShape("microapps")).toBe(componentShape(Boxes))
	})

	it("draws the two custom marks at the row's weight, not at its number", () => {
		/*
		 * The sidebar keeps `MagiClaw` and `Skills` on a 16-unit drawing grid while lucide uses 24,
		 * so a stroke width is not comparable between them: handed the same number the custom pair
		 * comes out half again as thick once both are scaled into the row's 20px box, which is what
		 * made them read as a heavier set than the rows around them.
		 */
		openDialog()

		const lucide = rowStrokeWidth("aiPpt")
		const custom = rowStrokeWidth("skills")

		expect(custom).toBeLessThan(lucide)
		// The drawn line is what has to agree: each is scaled by its own grid into the same box.
		expect(custom / 16).toBeCloseTo(lucide / 24, 6)
		// And the rule holds for the other custom mark, so neither can drift on its own.
		expect(rowStrokeWidth("superLobster")).toBeCloseTo(custom, 6)
	})
})

describe("NewUserBenefits entry card", () => {
	it("does not expose the card while the lazy tour has reserved the screen", async () => {
		setHomeOnboardingAnalyticsScope("magic-benefits-copy")
		setHomeOnboardingRunPending(true)
		const observe = vi.fn()
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(() => ({ disconnect: vi.fn(), observe })),
		)

		try {
			render(<NewUserBenefits />)
			await act(async () => Promise.resolve())

			// The loading fallback has claimed the upcoming paint, so the card must not even start
			// observing itself; otherwise a fast observer callback can spend the one-shot exposure.
			expect(observe).not.toHaveBeenCalled()
			expect(analyticsReport).not.toHaveBeenCalledWith(
				"onboarding_floating_card_exposure",
				expect.anything(),
			)
			const cardWrapper = screen.getByLabelText(
				"newUserBenefits.entry.ariaLabel",
			).parentElement
			expect(cardWrapper?.className.split(/\s+/)).not.toContain("md:block")
		} finally {
			act(() => setHomeOnboardingRunPending(false))
			vi.unstubAllGlobals()
		}
	})

	it("reports only actually visible card and dialog content", async () => {
		setHomeOnboardingAnalyticsScope("other-user", "other-org")
		// Isolated card tests seed the scope normally owned by GuideTourWrapper.
		setHomeOnboardingAnalyticsScope("magic-benefits-copy")
		const observations: Array<{
			callback: IntersectionObserverCallback
			target: Element | null
		}> = []
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: IntersectionObserverCallback) => {
				const observation = { callback, target: null as Element | null }
				observations.push(observation)
				return {
					disconnect: vi.fn(),
					observe: vi.fn((target: Element) => {
						observation.target = target
					}),
				}
			}),
		)
		const exposeLatest = () => {
			const observation = observations.at(-1)
			if (!observation?.target) throw new Error("Expected an observed onboarding surface")
			observation.callback(
				[
					{
						intersectionRatio: 1,
						isIntersecting: true,
						target: observation.target,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		}
		try {
			render(<NewUserBenefits />)
			await waitFor(() => expect(observations.length).toBeGreaterThan(0))
			act(exposeLatest)
			await waitFor(() =>
				expect(analyticsReport).toHaveBeenCalledWith("onboarding_floating_card_exposure", {
					completedCount: 0,
					totalTasks: 8,
					collapsed: false,
					hasRedDot: true,
				}),
			)
			fireEvent.click(screen.getByLabelText("newUserBenefits.entry.ariaLabel"))
			await waitFor(() => expect(observations.length).toBeGreaterThan(1))
			act(exposeLatest)
			await waitFor(() =>
				expect(analyticsReport).toHaveBeenCalledWith("onboarding_task_center_exposure", {
					completedCount: 0,
					totalTasks: 8,
					recommendedTaskId: "first-ai-work",
				}),
			)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it("reports the card entrance and the clicked recommended task from rendered rows", () => {
		openDialog()
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_floating_card_click", {
			action: "enter_task_center",
			completedCount: 0,
			totalTasks: 8,
			hasRedDot: true,
		})
		fireEvent.click(rowAction("firstAiWork"))
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_task_click", {
			taskId: "first-ai-work",
			action: "start",
			isRecommended: true,
		})
	})

	it("sells the whole pot until the first task is finished", () => {
		render(<NewUserBenefits />)

		/*
		 * With nothing done the card advertises the pot instead of reporting progress: "继续体验"
		 * reads as a lie before the first task, and "已完成 0 项" as a discouragement. The break falls
		 * on the comma because both halves are `whitespace-nowrap` — Chinese otherwise wraps between
		 * any two glyphs, which stranded "领" at the end of the first line. The slot names matter as
		 * much as the classes: `Trans` only lines a slot up with a translation that names it.
		 */
		const [headline] = rendersOf("newUserBenefits.entry.titleFresh")
		expect(headline?.slots.map(([name]) => name)).toEqual(["line1", "line2"])
		for (const [, className] of headline?.slots ?? []) {
			expect(className.split(/\s+/)).toContain("whitespace-nowrap")
		}

		expect(screen.queryByText("newUserBenefits.entry.title")).toBeNull()
		// There are no counts to report yet, so the headline stands alone.
		expect(screen.queryByText("newUserBenefits.entry.meta")).toBeNull()
	})

	it("goes back to reporting progress once a task is done", () => {
		paidRows.add("first_ai_work")
		render(<NewUserBenefits />)

		expect(screen.getByText("newUserBenefits.entry.title")).toBeTruthy()
		expect(screen.getByText("newUserBenefits.entry.meta")).toBeTruthy()
		expect(rendersOf("newUserBenefits.entry.titleFresh")).toHaveLength(0)
	})

	it("reports the finished set instead of selling the next tour", () => {
		/*
		 * Every tour done, which is a state of its own rather than the best progress there is: there
		 * is no next tour to sell and no count left to improve, so "继续体验" would be the one thing
		 * on the card that is not true, and "还剩 0 项待体验" the other. The chip keeps the product
		 * name and the counter keeps its 8/8 — the design changes the headline, the line under it and
		 * the reward pill, and nothing else.
		 */
		for (const { code } of TASK_ROWS) paidRows.add(code)
		render(<NewUserBenefits />)

		expect(screen.getByText("newUserBenefits.entry.titleDone")).toBeTruthy()
		expect(screen.queryByText("newUserBenefits.entry.title")).toBeNull()
		expect(rendersOf("newUserBenefits.entry.titleFresh")).toHaveLength(0)

		// The count is still worth reporting once it is complete: it is how many tours there were.
		const [meta] = rendersOf("newUserBenefits.entry.metaDone")
		expect(meta?.values).toEqual({ total: ROW_ORDER.length })
		expect(rendersOf("newUserBenefits.entry.meta")).toHaveLength(0)

		// The pill turns from "还差多少" into "已获得多少", and the finished figure is the pot —
		// the same 500 the folded pill and the dialog header advertise.
		const [pill] = rendersOf("newUserBenefits.entry.earnedReward")
		expect(pill?.values).toEqual({ points: MAX_POINTS })
		expect(rendersOf("newUserBenefits.entry.remainingReward")).toHaveLength(0)
	})

	it("still reports the pot when a finished tour has not been paid out yet", () => {
		/*
		 * Done but unpaid: the *task* is finished, so the card is finished with it. The figure stays
		 * the pot rather than a sum of what has landed, so the two lines of the card agree with each
		 * other and with the folded pill — the row's own "领取" is where the uncollected reward is
		 * accounted for, in the dialog the card opens.
		 */
		for (const { code } of TASK_ROWS) unpaidRows.add(code)
		render(<NewUserBenefits />)

		expect(screen.getByText("newUserBenefits.entry.titleDone")).toBeTruthy()
		expect(rendersOf("newUserBenefits.entry.earnedReward")[0]?.values).toEqual({
			points: MAX_POINTS,
		})
	})

	it("carries the finished badge on the folded pill, which has room for the headline alone", () => {
		for (const { code } of TASK_ROWS) paidRows.add(code)
		// Folded from the first paint, so the assertion is about the pill and not about an animation.
		window.localStorage.setItem(COLLAPSED_KEY, "1")
		render(<NewUserBenefits />)

		expect(screen.getByLabelText("newUserBenefits.entry.expand")).toBeTruthy()
		expect(screen.getByText("newUserBenefits.entry.badgeDone")).toBeTruthy()
		expect(screen.queryByText("newUserBenefits.entry.badge")).toBeNull()
		// And the pot is what a folded card advertises either way — the finished one agrees with it.
		expect(rendersOf("newUserBenefits.entry.pillReward")[0]?.values).toEqual({
			points: MAX_POINTS,
		})
	})

	it("draws the progress track as a hairline under the nodes", () => {
		render(<NewUserBenefits />)

		/*
		 * 2px, the height the design gives the track (`.feature-entry-nodes::before{height:2px}`).
		 * It sat at 4px here, which read as a bar as heavy as the 12px nodes it links, so the nodes
		 * stopped standing out against it. Both halves of the line are pseudo-elements, so the
		 * classes are all there is to assert — trimming the height must not disturb their centring,
		 * which is what keeps the line running through the middle of the nodes rather than under
		 * them, and the lit run has to share the grey run's box or it cannot meet the nodes it
		 * claims to connect.
		 */
		const card = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
		const track = card.querySelector('[class*="55575c"]') as HTMLElement
		const classes = track.className.split(/\s+/)

		for (const half of ["before:", "after:"]) {
			expect(classes).toContain(`${half}h-0.5`)
			expect(classes).not.toContain(`${half}h-1`)
			expect(classes).toContain(`${half}top-1/2`)
			expect(classes).toContain(`${half}-translate-y-1/2`)
			/*
			 * Both ends, on both halves. The line is half a node in from either edge, and it has to
			 * be the *same* half node on both: half a node is what puts an end on a node's centre,
			 * so a missing inset leaves the grey run poking out past the outer node.
			 */
			expect(classes).toContain(`${half}left-1.5`)
			expect(classes).toContain(`${half}right-1.5`)
		}

		/*
		 * And the lit run takes its length from the grey one rather than from the track box. It was
		 * given `width: var(--nb-entry-track-lit)` — a percentage of the box, which is half a node
		 * longer at each end than the line — so every partial fill ran past the node it was meant to
		 * stop on: barely at two tasks, 6px at five, and a whole 12px of loose bar past the last node
		 * once all eight were done. Scaling the shared box has no such percentage in it.
		 */
		expect(classes).toContain("after:origin-left")
		expect(classes).toContain("after:scale-x-[var(--nb-entry-track-lit)]")
		expect(classes).not.toContain("after:w-[var(--nb-entry-track-lit)]")
		expect(classes).not.toContain("after:w-[calc((100%_-_12px)*var(--nb-entry-track-lit))]")
	})

	it("leaves the connector dark until a second task is finished", () => {
		// One node on its own has nothing to connect to: the line under it still reads as a run of
		// one, and lighting anything would promise a segment the node cannot reach.
		paidRows.add("magiclaw")
		render(<NewUserBenefits />)

		expect(litTrackRatio()).toBeCloseTo(0, 4)
	})

	it("lights the connector between two finished nodes, and only that far", () => {
		/*
		 * Two lit nodes with grey between them read as two separate attempts rather than as
		 * progress, which is what this pins: the segment they span is lit, the five after it are
		 * not. One segment out of the seven the line is divided into.
		 */
		paidRows.add("magiclaw")
		paidRows.add("ai_ppt")
		render(<NewUserBenefits />)

		expect(litTrackRatio()).toBeCloseTo(1 / 7, 4)
	})

	it("lights the whole connector once every task is done", () => {
		/*
		 * Exactly 1, not a hair over: the lit run is the line's own box, so a finished track ends on
		 * the last node's centre. It used to end a whole node further right — a loose bar hanging in
		 * the empty space past the last dot — because the ratio was applied to the longer track box.
		 */
		for (const { code } of TASK_ROWS) paidRows.add(code)
		render(<NewUserBenefits />)

		expect(litTrackRatio()).toBeCloseTo(1, 4)
	})

	it("lights one node per finished task, counting from the left", () => {
		/*
		 * The track is a gauge, not a checklist: it answers "how far along am I", and the rows
		 * below it answer "which one is which". Lighting each node off its own row was tried and
		 * read as broken — finishing the *second* task left the second node lit and the first
		 * dark, which looks like a step was skipped. So the lit count follows the count alone,
		 * whatever order the tasks were taken in.
		 *
		 * `magiclaw` is the eighth and last row, and it is the only one finished here — which is
		 * the case that separates the two rules. Off counts, the first node is the one that lights.
		 */
		paidRows.add("magiclaw")
		render(<NewUserBenefits />)

		const card = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
		const track = card.querySelector('[class*="55575c"]') as HTMLElement
		const nodes = Array.from(track.children)
		const lit = nodes.map((node) => node.className.includes("e7a91a"))

		expect(lit).toEqual([true, false, false, false, false, false, false, false])
	})

	it("grows the lit run with each finished task, from the first node", () => {
		// The other half of the rule: two done is two lit, and still the first two — the track
		// never grows from the middle outwards, whichever pair it was.
		paidRows.add("magiclaw")
		paidRows.add("ai_ppt")
		render(<NewUserBenefits />)

		const card = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
		const track = card.querySelector('[class*="55575c"]') as HTMLElement
		const nodes = Array.from(track.children)
		const lit = nodes.map((node) => node.className.includes("e7a91a"))

		expect(lit).toEqual([true, true, false, false, false, false, false, false])
	})

	it("keeps both line tags in every locale", () => {
		/*
		 * `Trans` only breaks the line where the translation carries the tags, and the mock above
		 * hands back the key without ever parsing the markup — so a locale that lost them would drop
		 * the break with nothing else in this file noticing.
		 */
		for (const locale of [zhGuideTour, enGuideTour]) {
			const copy = locale.newUserBenefits.entry.titleFresh
			for (const tag of ["line1", "line2"]) {
				expect(copy).toContain(`<${tag}>`)
				expect(copy).toContain(`</${tag}>`)
			}
		}
	})

	it("prices the card and the dialog off the same pot", () => {
		openDialog()

		/*
		 * 500 is the reachable ceiling the design pays out: the rows sum to 450 — `first_ai_work`
		 * pays 100 and the other seven 50 — and finishing the lot adds the documented 50-point
		 * bonus. The card used to derive it as `8 * 50 + 50`, which promised 450 in a pill sitting
		 * under a header that advertised 500. Only the per-row figures are the backend's; the
		 * bonus is the documented constant it is added to.
		 */
		const [headline] = rendersOf("newUserBenefits.entry.titleFresh")
		expect(headline?.values).toEqual({ points: MAX_POINTS, total: ROW_ORDER.length })

		const [pill] = rendersOf("newUserBenefits.entry.remainingReward")
		expect(pill?.values).toEqual({ points: MAX_POINTS })

		const [header] = rendersOf("newUserBenefits.dialog.maxReward")
		expect(header?.values).toEqual({ points: MAX_POINTS })
	})

	it("stays off the page when the deployment offers nothing", () => {
		/*
		 * The one state the card must not dress up. A list that is still on its way, one that failed,
		 * and a deployment that answered `9300`/`9301` all end up with no rows — and the card has
		 * nothing to advertise in any of them, so it renders nothing rather than a card whose
		 * numbers are all zero.
		 */
		listState.empty = true

		const { container } = render(<NewUserBenefits />)

		expect(container.innerHTML).toBe("")
	})
})

/**
 * Folding the entry card down to its pill, and the motion that carries it.
 *
 * The card and the pill are two different boxes — a 310px grid against an auto-width pill — so
 * nothing about the change of size interpolates. What these pin is the rest of the contract: that
 * folding swaps which target the card is, that the folded state outlives the visit under the key
 * the design uses, that the control sits on the card's corner instead of inside its button, and
 * that the keyframes the two states are marked with exist and are not motion-only.
 */
describe("NewUserBenefits entry card fold", () => {
	/** The fold control, which only the open card carries. */
	function foldControl() {
		return screen.getByLabelText("newUserBenefits.entry.collapse")
	}

	/*
	 * The card is one button whose announced action follows its state — it opens the dialog when
	 * open and unfolds when folded — so the two states are reached by two labels rather than one.
	 */
	function openCard() {
		return screen.getByLabelText("newUserBenefits.entry.ariaLabel")
	}

	function foldedCard() {
		return screen.getByLabelText("newUserBenefits.entry.expand")
	}

	/**
	 * Folds the card and waits the motion out. Folding is the one change with a beat built into it:
	 * the open card is given one animation's worth of time to shrink away and only then is the pill
	 * swapped in, so every assertion about the folded card has to come after that beat rather than
	 * on the next line. The slack is for the timer to fire and React to flush the swap.
	 */
	async function foldAndSettle() {
		fireEvent.click(foldControl())
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, ENTRY_FOLD_OUT_MS + 40)
			})
		})
	}

	it("shows the card leaving before the pill takes its place", async () => {
		/*
		 * The beat itself, which is the whole point of the change: a fold that swapped in a single
		 * frame is what read as the card being yanked off the screen. Asserted as "the old card is
		 * still up, marked as leaving, right after the click, and the pill is there after the beat"
		 * — the class is what carries the motion, and jsdom runs no animation of its own.
		 */
		render(<NewUserBenefits />)

		fireEvent.click(foldControl())

		const leaving = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
		expect(screen.queryByLabelText("newUserBenefits.entry.expand")).toBeNull()
		expect((leaving.parentElement as HTMLElement).className.split(/\s+/)).toContain(
			"nb-entry-leaving",
		)

		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, ENTRY_FOLD_OUT_MS + 40)
			})
		})

		expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeNull()
		expect(foldedCard().className.split(/\s+/)).toContain("nb-entry-fold")
		expect((foldedCard().parentElement as HTMLElement).className.split(/\s+/)).not.toContain(
			"nb-entry-leaving",
		)
	})

	it("skips the beat when the reader has asked for no motion", () => {
		/*
		 * With the animation switched off there is nothing to wait for, so waiting would be a beat
		 * of empty corner before a pill appears. The preference is read at the click, so stubbing it
		 * is enough — no re-render is involved.
		 */
		const original = window.matchMedia
		window.matchMedia = ((query: string) => ({
			matches: query.includes("reduce"),
		})) as unknown as typeof window.matchMedia
		try {
			render(<NewUserBenefits />)

			fireEvent.click(foldControl())

			expect(foldedCard()).toBeTruthy()
			expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeNull()
		} finally {
			window.matchMedia = original
		}
	})

	it("folds to the pill and unfolds again, without opening the dialog in between", async () => {
		render(<NewUserBenefits />)
		// Open by default: the counter and the headline, and no pill anywhere.
		expect(rendersOf("newUserBenefits.entry.pillReward")).toHaveLength(0)
		expect(screen.getByText(`0/${ROW_ORDER.length}`)).toBeTruthy()

		await foldAndSettle()

		/*
		 * Folded, the pill replaces the body and the card becomes the unfold target: the design
		 * points its chevron right and gives the whole pill to expanding, so a click there must
		 * not also reach the dialog.
		 */
		expect(screen.queryByLabelText("newUserBenefits.entry.collapse")).toBeNull()
		expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeNull()
		expect(screen.queryByText(`0/${ROW_ORDER.length}`)).toBeNull()
		expect(screen.queryByRole("dialog")).toBeNull()

		const [pill] = rendersOf("newUserBenefits.entry.pillReward")
		expect(pill?.values).toEqual({ points: MAX_POINTS })

		fireEvent.click(foldedCard())

		// Back to the open card, and the dialog still needs its own click.
		expect(screen.queryByRole("dialog")).toBeNull()
		expect(openCard()).toBeTruthy()
		expect(screen.getByText(`0/${ROW_ORDER.length}`)).toBeTruthy()
	})

	it("starts folded on a later visit, from the key the design stores it under", () => {
		window.localStorage.setItem(COLLAPSED_KEY, "1")
		render(<NewUserBenefits />)

		// Folded from the first paint, rather than after a visible re-open.
		expect(foldedCard()).toBeTruthy()
		expect(rendersOf("newUserBenefits.entry.pillReward")[0]?.values).toEqual({
			points: MAX_POINTS,
		})
		// The open body never rendered at all, which is what "from the first paint" means here.
		expect(rendersOf("newUserBenefits.entry.titleFresh")).toHaveLength(0)
		expect(screen.queryByText(`0/${ROW_ORDER.length}`)).toBeNull()
	})

	it("remembers the fold, in both directions", async () => {
		render(<NewUserBenefits />)
		expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe("")

		await foldAndSettle()
		// Written when the fold was asked for rather than when it landed, so a card taken off the
		// page mid-animation still remembers it.
		expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe("1")

		fireEvent.click(foldedCard())
		expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe("")
	})

	it("hangs the control off the card's own corner, clear of the counter", () => {
		render(<NewUserBenefits />)

		// 22px at 15px from both outer edges, and the card's top row reserves exactly that corner —
		// the counter would otherwise run under the control. 15 rather than the design's 14 because
		// the design measures it from the card's padding box, with the 1px border outside.
		const classes = foldControl().className.split(/\s+/)
		expect(classes).toContain("right-[15px]")
		expect(classes).toContain("top-[15px]")
		expect(classes).toContain("size-[22px]")
		expect(classes).not.toContain("right-3.5")

		const topRow = screen.getByText(`0/${ROW_ORDER.length}`).parentElement as HTMLElement
		expect(topRow.className.split(/\s+/)).toContain("pr-8")
		expect(topRow.className.split(/\s+/)).toContain("col-span-2")
	})

	it("keeps the control beside the card, not a button inside a button", () => {
		render(<NewUserBenefits />)

		const control = foldControl()
		const card = openCard()

		expect(control.tagName).toBe("BUTTON")
		expect(card.tagName).toBe("BUTTON")
		expect(control.getAttribute("aria-expanded")).toBe("true")
		// Nesting the control in the card's own button is invalid markup, and the inner button's
		// clicks are swallowed by the outer one — hence the sibling wrapper.
		expect(card.contains(control)).toBe(false)
		expect(card.parentElement?.contains(control)).toBe(true)
		expect(card.querySelector("button")).toBeNull()
	})

	it("marks both states with the classes the stylesheet animates", async () => {
		render(<NewUserBenefits />)

		const open = openCard().className.split(/\s+/)
		expect(open).toContain("nb-entry-unfold")
		expect(open).not.toContain("nb-entry-fold")

		await foldAndSettle()

		const folded = foldedCard()
		expect(folded.className.split(/\s+/)).toContain("nb-entry-fold")
		expect(folded.className.split(/\s+/)).not.toContain("nb-entry-unfold")
		// The card's own children are its grid cells, so the body fade rides on the pill itself.
		expect(folded.firstElementChild?.className.split(/\s+/)).toContain("nb-entry-pill-in")
	})

	it("animates the fold on the design's curve, and drops it for reduced motion", () => {
		/*
		 * Vitest does not process stylesheets, so the file is read directly. Without this the
		 * motion could be deleted — or its import dropped from the component — with every other
		 * assertion in the file still passing.
		 */
		const css = fs.readFileSync(path.resolve(dirname, "../entry-transition.css"), "utf8")
		const source = fs.readFileSync(path.resolve(dirname, "../index.tsx"), "utf8")

		/*
		 * Each rule spelled out rather than matched loosely: `toContain("@keyframes nb-entry-pill-in")`
		 * would also accept a renamed `@keyframes nb-entry-pill-in-removed`, and one rule drifting to
		 * a longer duration would hide behind the three that still read 0.24s.
		 */
		for (const name of ["fold", "unfold", "pill-in", "body-in"]) {
			expect(css).toMatch(new RegExp(`@keyframes nb-entry-${name} \\{`))
			expect(css).toContain(
				`animation: nb-entry-${name} 0.24s cubic-bezier(0.16, 1, 0.3, 1);`,
			)
		}

		/*
		 * The exit is the one animation the component *waits* for, so its length is written in two
		 * places — the rule below and `ENTRY_FOLD_OUT_MS` above. Drift between them is either a beat
		 * of empty corner or a card cut off mid-shrink, and neither shows up as a failure anywhere
		 * else. The curve is its own: eased in, so the card accelerates as it leaves.
		 */
		expect(css).toMatch(/@keyframes nb-entry-leave \{/)
		expect(css).toContain(
			`animation: nb-entry-leave ${ENTRY_FOLD_OUT_MS / 1000}s cubic-bezier(0.4, 0, 1, 1) forwards;`,
		)

		/*
		 * The two halves of the fold meet on the same opacity: the exit stops at 0.35 and the pill's
		 * entrance starts there, so the swap is a hand-off rather than a frame with nothing on the
		 * corner. A mismatch is a blink that no other assertion here would catch.
		 */
		expect(css).toMatch(/@keyframes nb-entry-leave \{[\s\S]*?opacity: 0\.35;/)
		expect(css).toMatch(/@keyframes nb-entry-fold \{[\s\S]*?from \{\s*opacity: 0\.35;/)

		// Folding is decorative, so it has to be skippable; a missing guard is an accessibility
		// problem rather than a taste one.
		expect(css).toContain("@media (prefers-reduced-motion: reduce)")
		expect(css).toContain(".nb-entry-leaving")
		expect(source).toContain('import "./entry-transition.css"')
	})
})

/**
 * The wrapper that holds the card and its fold control.
 *
 * The design's control sits inside the card, so the card's own `translateY(-2px)` carries it along
 * for free. Here the control has to be a sibling — a button inside a button is invalid — and moving
 * it out also moved it out of the card's lift: the card rose, the control stayed, and the two came
 * apart exactly when the user was pointing at them. The lift therefore belongs to the box holding
 * both, which is also what lets the card step aside while its dialog is up.
 *
 * The same box carries the card's other reason to be off screen: a guided run. That one is not the
 * card's to work out — a first visit is shown the introduction dialog by a run the card never asked
 * for — so the card is told, and these tests hand it the verdict directly.
 */
describe("NewUserBenefits entry card wrapper", () => {
	/** The box holding the card and its fold control: what the two have in common. */
	function wrapperOf(label: string) {
		return screen.getByLabelText(label).parentElement as HTMLElement
	}

	it("lifts the fold control with the card, from one shared hover region", () => {
		render(<NewUserBenefits />)

		const card = screen.getByLabelText("newUserBenefits.entry.ariaLabel")
		const control = screen.getByLabelText("newUserBenefits.entry.collapse")
		const classes = wrapperOf("newUserBenefits.entry.ariaLabel").className.split(/\s+/)

		/*
		 * jsdom runs no layout, so the hover cannot be exercised — where the lift is attached can.
		 * On the wrapper one `:hover` covers both boxes and the 2px of travel cannot come apart;
		 * on the card the control would be left behind, which is the seam this replaced.
		 */
		expect(wrapperOf("newUserBenefits.entry.ariaLabel").contains(control)).toBe(true)
		expect(classes).toContain("hover:-translate-y-0.5")
		expect(classes).toContain("transition-transform")
		expect(classes).toContain("duration-200")
		expect(card.className.split(/\s+/)).not.toContain("hover:-translate-y-0.5")
	})

	it("steps aside while its dialog is up, and comes back when it closes", () => {
		render(<NewUserBenefits />)

		// Closed, `md:block` is what lifts the base `hidden` — the desktop gate the card always had.
		expect(wrapperOf("newUserBenefits.entry.ariaLabel").className.split(/\s+/)).toContain(
			"md:block",
		)

		fireEvent.click(screen.getByLabelText("newUserBenefits.entry.ariaLabel"))
		expect(screen.getByRole("dialog")).toBeTruthy()

		/*
		 * Open, nothing lifts the base `hidden`, so the card is gone for the whole breakpoint range
		 * rather than sitting behind the overlay — where it would stay readable to a screen reader
		 * while being unreachable to a pointer.
		 */
		expect(wrapperOf("newUserBenefits.entry.ariaLabel").className.split(/\s+/)).not.toContain(
			"md:block",
		)

		fireEvent.click(screen.getByLabelText("newUserBenefits.dialog.close"))

		expect(screen.queryByRole("dialog")).toBeNull()
		expect(wrapperOf("newUserBenefits.entry.ariaLabel").className.split(/\s+/)).toContain(
			"md:block",
		)
	})

	it("steps aside for a guided run, not only for its own dialog", () => {
		render(<NewUserBenefits />)

		const classes = () => wrapperOf("newUserBenefits.entry.ariaLabel").className.split(/\s+/)

		expect(classes()).toContain("md:block")

		/*
		 * Every task this card leads into paints over the window while it runs — the introduction
		 * dialog on a first visit, then the step overlays — so the card yields to the run rather
		 * than to the one dialog it opens itself. Two reasons, one gate.
		 */
		act(() => setHomeOnboardingRunActive(true))
		expect(classes()).not.toContain("md:block")

		act(() => setHomeOnboardingRunActive(false))
		expect(classes()).toContain("md:block")
	})

	it("is already off screen in its first markup, when a run is up before the card arrives", () => {
		/*
		 * The automatic run opens the introduction dialog on a first visit — before anything asks for
		 * this card — so the card is mounted *into* a run rather than told about one afterwards.
		 *
		 * A server render is the only view of that first frame jsdom offers: it runs the render and
		 * nothing else, so a missing `md:block` here means the card was never on screen, rather than
		 * that an effect caught up with it before the test looked. Reading the manager at mount — as
		 * the folded state is read — is what buys that, and it is the whole of what this pins.
		 */
		setHomeOnboardingRunActive(true)

		// Radix's own layout effect, which means nothing on a server. Silenced for the one call.
		const complaints = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const markup = renderToStaticMarkup(<NewUserBenefits />)
		complaints.mockRestore()

		// The card is there: it is only the desktop gate that never lifted.
		expect(markup).toContain("newUserBenefits.entry.ariaLabel")
		expect(markup).not.toContain("md:block")
	})

	it("stays mounted while a run has the page, so neither fold class can replay", () => {
		render(<NewUserBenefits />)
		act(() => setHomeOnboardingRunActive(true))

		/*
		 * Unshown but still there. Rendering it away would bring the card back playing the unfold
		 * half of the pair — the animation for coming out of the pill — on a card the user never
		 * folded, and a card folded before the run would come back folded and silent.
		 */
		expect(screen.getByLabelText("newUserBenefits.entry.ariaLabel")).toBeTruthy()
		expect(rendersOf("newUserBenefits.entry.titleFresh").length).toBeGreaterThan(0)
	})
})

/**
 * The card's third reason to be off the screen, and the only one that is temporary: a dialog that
 * comes before the whole feature — the profile one a brand-new account is asked to fill in, the
 * daily reward one — owns the page first. Unlike the other two this is not about the account or the
 * deployment but about the moment, so the card has to appear when the dialog is dismissed, on a
 * page nobody remounts.
 */
describe("NewUserBenefits behind the dialogs that come first", () => {
	it("is not on the page at all while one of them holds it", () => {
		holdHomeOnboardingPrelude("user-profile-dialog")

		render(<NewUserBenefits />)

		/*
		 * Neither the card nor its dialog — and neither of them may be explained away by an empty
		 * reward list: the backend here answers with the full eight rows, so the only thing keeping
		 * the card away is the dialog in front of it.
		 */
		expect(listState.empty).toBe(false)
		expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeNull()
		expect(screen.queryByRole("dialog")).toBeNull()
	})

	it("comes up as soon as that dialog is gone, on the same mount", () => {
		holdHomeOnboardingPrelude("daily-reward-dialog")

		render(<NewUserBenefits />)
		expect(screen.queryByLabelText("newUserBenefits.entry.ariaLabel")).toBeNull()

		// Dismissed long after the first paint, on a page that is not remounted.
		act(() => releaseHomeOnboardingPrelude("daily-reward-dialog"))

		expect(screen.getByLabelText("newUserBenefits.entry.ariaLabel")).toBeTruthy()
	})
})
