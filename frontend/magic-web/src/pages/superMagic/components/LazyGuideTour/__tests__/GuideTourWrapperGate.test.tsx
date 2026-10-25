import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The three gates in front of the automatic run: the feature's own availability, the dialogs that
 * come before it, and the backend's answer for this account.
 *
 * The benefits card reads the backend's answer for itself — its rows come back empty and it renders
 * nothing — but the automatic run has the progress mirror to answer from, and a deployment that does
 * not offer the feature seeds no progress, because there is none to seed. Every task therefore still
 * reads as unfinished and the introduction dialog would open in an organization the feature does not
 * exist in — which is the second group below.
 *
 * The mirror is not the only thing the run has to read, and the second group pins the other half:
 * the dialog is offered on the strength of the list's own `PENDING` row for the AI-work task, so a
 * task the backend has expired — or that a shorter list, a progress older than the task, never
 * carried — keeps it away. The mirror reads both of those as unfinished, which is what put the
 * dialog in front of accounts with nothing left to do.
 *
 * The first group is the earlier question, and the reason both gates sit on the same component:
 * new-user onboarding belongs to the SaaS personal plan, so a private deployment and a team
 * organization must not mount it at all. "Not mounted" is asserted as "never asked": the reward
 * list is the feature's first request, and a component that mounts and only then hides would have
 * already sent it.
 *
 * A mobile client is the third answer to that same question, and it is read in the same place for
 * the same reason — the wrapper is mounted by a layout that is the same on both clients, so only
 * the wrapper can keep a phone from asking.
 *
 * The last group is about *when* rather than *whether*: a new account is shown a profile dialog and
 * possibly a daily reward dialog before this feature has its turn, and the introduction dialog has
 * to be the last of the three rather than an overlay on top of one of them.
 *
 * And the one after that is the one-shot rule: the introduction is spent by the account that was
 * shown it rather than by the page load that showed it, so a later load — the same browser, the same
 * account — has to find it gone.
 *
 * These tests drive the wrapper itself, because that is where both answers have to be read.
 */
const { translate, MAGIC_ID, deployment, organization } = vi.hoisted(() => ({
	translate: (key: string) => key,
	MAGIC_ID: "magic-guide-gate",
	/** The deployment and the organization the wrapper under test is looking at. */
	deployment: { privateDeployment: false },
	organization: {
		organizationListReady: true,
		isPersonalOrganization: true,
		organizationCode: "org-1",
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: translate,
	}),
}))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: { magic_id: MAGIC_ID } }),
	useOrganization: () => organization,
}))

/*
 * Only `isPrivateDeployment` is replaced: everything else in the module is real, so the rest of the
 * feature's imports keep working off the environment the suite runs in.
 */
vi.mock("@/utils/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/env")>()),
	isPrivateDeployment: () => deployment.privateDeployment,
}))

// The wrapper decides the workspace page from the route: no ids at all means the home page, which
// is the only page the automatic run belongs to.
vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useParams: () => ({}),
}))

const { getOnboardingTasks, completeOnboardingTask } = vi.hoisted(() => ({
	getOnboardingTasks: vi.fn(),
	completeOnboardingTask: vi.fn(),
}))

/*
 * Only the two calls are replaced, and only their own module: the codes and the helpers that read a
 * failed request apart come from `onboarding-codes`, which the manager imports statically and which
 * stays real here. That is what lets a `9301` rejection travel all the way to the gate as a genuine
 * "unsupported" answer rather than as a mock's stand-in for one.
 */
vi.mock("@/apis/modules/onboarding", () => ({ getOnboardingTasks, completeOnboardingTask }))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))

// The wrapper spec owns the onboarding gate only; reporting is covered by the event specs.
vi.mock("@/services/analytics", () => ({ analyticsService: { report: vi.fn() } }))

vi.mock("@/stores/layout", () => ({
	sidebarStore: { collapsed: false, setCollapsed: vi.fn() },
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn(), subscribe: vi.fn() },
	PubSubEvents: { Set_Input_Message: "set-input-message" },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/pages/superMagic/utils/clawBrand", () => ({
	getClawBrandTranslationValues: () => ({}),
}))

/** The introduction dialog is the automatic run's only surface, and its own accessible name. */
const INTRO = "homeOnboarding.welcome.title"

/** One reward row as the backend sends it. `status` is the part the gate's callers act on. */
function task(code: string, status: "PENDING" | "COMPLETED" | "EXPIRED") {
	return {
		code,
		points: 30,
		validity_days: 7,
		status,
		reward_status: status === "COMPLETED" ? ("GRANTED" as const) : ("PENDING" as const),
		completed_at: null,
		reward_granted_at: null,
		expires_at: "2026-12-31T00:00:00Z",
	}
}

/** A fresh wrapper and manager, so one test's answer cannot decide what the next one starts from. */
async function loadWrapper() {
	vi.resetModules()
	const prelude = await import("../onboardingPrelude")
	const onboarding = await import("../GuideTourManager")
	const wrapper = await import("../index")
	return { prelude, onboarding, wrapper }
}

/**
 * Loads fresh modules, lets the caller arrange the backend's answer, and then mounts the wrapper the
 * way the home page does. The order is the point: the reward list is asked for on mount, so whatever
 * the suite wants the backend to say has to be decided before it is.
 *
 * `isMobile` is handed in the way a page hands its own answer in — the wrapper is told which client
 * it is on rather than working it out, so a test moves exactly that.
 */
async function mountWrapper(
	arrange: (modules: Awaited<ReturnType<typeof loadWrapper>>) => void,
	{ isMobile = false }: { isMobile?: boolean } = {},
) {
	const modules = await loadWrapper()
	arrange(modules)
	const rendered = render(<modules.wrapper.default isMobile={isMobile} />)
	// Let whatever the mount started settle — the reward list among it — before the caller asserts.
	await act(async () => {
		await Promise.resolve()
	})
	return { ...modules, ...rendered }
}

beforeEach(() => {
	// The SaaS personal organization: the one environment the feature is for. Every test that wants
	// another one moves exactly the fact it is about.
	deployment.privateDeployment = false
	organization.organizationListReady = true
	organization.isPersonalOrganization = true
	organization.organizationCode = "org-1"

	getOnboardingTasks.mockReset()
	completeOnboardingTask.mockReset()
	/*
	 * The introduction is the one piece of state that outlives a page load, so it is deliberately not
	 * reset with the modules — and jsdom keeps storage for the whole file. Without this, the first
	 * test that is shown the dialog would spend it for every test after it.
	 */
	window.localStorage.clear()
})

describe("whether the feature is mounted at all", () => {
	/** A list that would leave the run with something to walk, so "nothing happened" cannot be
	 *  explained away by there having been nothing to show. */
	const homeTasksPending = () => {
		getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
	}

	it("stays off a private deployment without asking for anything", async () => {
		deployment.privateDeployment = true

		await mountWrapper(homeTasksPending)

		expect(getOnboardingTasks).not.toHaveBeenCalled()
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("stays off a team organization without asking for anything", async () => {
		organization.isPersonalOrganization = false

		await mountWrapper(homeTasksPending)

		expect(getOnboardingTasks).not.toHaveBeenCalled()
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("holds off until the organization list says which kind it is", async () => {
		// Nobody is a personal organization before the list lands: the store has not been told yet,
		// and `isPersonalOrganization` reads `false` for everybody. Treating that as "a team" would
		// hide the feature from the users it is for, so the gate waits rather than guesses — and
		// waiting must not cost a request.
		organization.organizationListReady = false

		await mountWrapper(homeTasksPending)

		expect(getOnboardingTasks).not.toHaveBeenCalled()
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("stays off a mobile client without asking for anything", async () => {
		/*
		 * The home layout mounts this wrapper on both clients — it is the layout that renders it,
		 * and the layout is the same either way, so a phone reaches it on the way to `/super` before
		 * being redirected to the mobile home. `GuideTourGate` reads `isMobile` too, but only in its
		 * render body, and its effects are registered before that return: a gate left to answer for
		 * mobile would ask for the reward list and hide itself afterwards.
		 */
		await mountWrapper(homeTasksPending, { isMobile: true })

		expect(getOnboardingTasks).not.toHaveBeenCalled()
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("mounts on a SaaS personal organization", async () => {
		await mountWrapper(homeTasksPending)

		expect(await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })).toBeTruthy()
	})

	it("opens on the same mount once the organization list says it is a personal one", async () => {
		// The answer arrives after the first paint, on a page that is not remounted, so the gate
		// has to be a decision the wrapper re-takes rather than one it took on mount.
		organization.organizationListReady = false

		const { rerender, wrapper } = await mountWrapper(homeTasksPending)
		expect(getOnboardingTasks).not.toHaveBeenCalled()

		organization.organizationListReady = true
		await act(async () => {
			rerender(<wrapper.default isMobile={false} />)
		})

		expect(await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })).toBeTruthy()
	})
})

describe("the wrapper owns the analytics scope", () => {
	it("keeps the run and exposure records across route remounts, then clears them on organization change", async () => {
		const { onboarding, wrapper, unmount } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [] })
		})
		const runId = onboarding.beginHomeOnboardingAnalyticsRun("manage-skill", true)
		expect(onboarding.consumeHomeOnboardingStepExposure(runId, "4")).toBe(true)
		expect(onboarding.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(true)
		unmount()
		const nextPage = render(<wrapper.default isMobile={false} page="my-skills" />)
		expect(onboarding.getHomeOnboardingAnalyticsRun()?.id).toBe(runId)
		expect(onboarding.consumeHomeOnboardingStepExposure(runId, "4")).toBe(false)
		expect(onboarding.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(false)

		organization.organizationCode = "org-2"
		organization.isPersonalOrganization = false
		nextPage.rerender(<wrapper.default isMobile={false} page="my-skills" />)
		expect(onboarding.getHomeOnboardingAnalyticsRun()).toBeNull()
		expect(onboarding.consumeHomeOnboardingStepExposure(runId, "5")).toBe(false)
		expect(onboarding.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(true)
	})
})

describe("the wrapper's gate on the automatic run", () => {
	it("reserves the screen while the lazy introduction is loading", async () => {
		const transitions: Array<{ active: boolean; blocking: boolean }> = []
		let stopListening = () => undefined
		const mounted = await mountWrapper(({ onboarding }) => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
			const record = () =>
				transitions.push({
					active: onboarding.isHomeOnboardingRunActive(),
					blocking: onboarding.isHomeOnboardingRunBlocking(),
				})
			window.addEventListener(onboarding.HOME_ONBOARDING_RUN_EVENT, record)
			stopListening = () =>
				window.removeEventListener(onboarding.HOME_ONBOARDING_RUN_EVENT, record)
		})

		try {
			// The fallback must block sibling surfaces before the lazy tour can call itself active.
			expect(transitions).toContainEqual({ active: false, blocking: true })
			expect(
				await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 }),
			).toBeTruthy()
			expect(mounted.onboarding.isHomeOnboardingRunActive()).toBe(true)
		} finally {
			stopListening()
		}
	})

	it("stays off the screen on a deployment that does not offer the feature", async () => {
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockRejectedValue({ code: 9301, message: "功能未开启" })
		})

		// The absence below has to be the gate's doing, so the answer is waited for first: without
		// this the wrapper would also render nothing while the list is merely still on its way, and
		// the assertion would pass for the wrong reason.
		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("unsupported")
			},
			{ timeout: 5000 },
		)

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("still opens on a list that leaves both home tasks unfinished", async () => {
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({
				participant_type: "new_register",
				tasks: [task("first_ai_work", "PENDING")],
			})
		})

		// The other half of the rule: the gate is about the deployment's answer, not about whether
		// there is anything left to walk. Blocking here would take the tour away from every user who
		// has it coming.
		expect(await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })).toBeTruthy()
		expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
		expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).participantType).toBe(
			"new_register",
		)
	})

	it("stays off on a list that reports the home tasks as already done", async () => {
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({
				tasks: [task("super_magic_intro", "COMPLETED"), task("first_ai_work", "COMPLETED")],
			})
		})

		// Unchanged by the gate, and worth pinning beside it: the backend's verdict on a task the
		// account has finished is what keeps the run away, and it is reached through the same state.
		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
			},
			{ timeout: 5000 },
		)

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("stays off on a list whose AI-work task has expired", async () => {
		/*
		 * An account the deployment no longer counts as new: its AI-work task is over, and the
		 * progress mirror cannot see that — the mirror is seeded from *completed* rows, and an
		 * expired task was never completed, so it reads as unfinished. The list is the only thing
		 * that knows, which is why the run reads it directly.
		 */
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "EXPIRED")] })
		})

		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
			},
			{ timeout: 5000 },
		)

		// The absence below has to be this rule's doing, so the mirror is asked first: it still
		// calls the task unfinished, and would have opened the dialog on its own.
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)
		expect(onboarding.isHomeOnboardingTaskPending(MAGIC_ID, "first-ai-work")).toBe(false)
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("stays off on a list that does not carry the AI-work task at all", async () => {
		/*
		 * A progress that predates a task keeps the shorter list, so the row the dialog is for is
		 * simply not there — and the mirror has nothing to seed from it either. The workbench row
		 * being pending is what makes the absence this rule's doing rather than "there was nothing
		 * to show".
		 */
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("super_magic_intro", "PENDING")] })
		})

		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
			},
			{ timeout: 5000 },
		)

		expect(onboarding.isHomeOnboardingTaskPending(MAGIC_ID, "workbench")).toBe(true)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)
		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("stays off when the list never arrived", async () => {
		/*
		 * "We could not ask" is not "the backend says there is one". The introduction is offered on
		 * a confirmed task, so a request that failed leaves it out rather than showing it on a guess
		 * — and the ask is retried on the next mount, which is where an account that really is new
		 * gets its dialog.
		 */
		const { onboarding } = await mountWrapper(() => {
			getOnboardingTasks.mockRejectedValue(new Error("Network Error"))
		})

		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("failed")
			},
			{ timeout: 5000 },
		)

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})
})

describe("the wrapper's gate on the dialogs that come first", () => {
	it("keeps the introduction dialog away while one of them holds the screen", async () => {
		const { onboarding } = await mountWrapper(({ prelude }) => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
			// The profile dialog a brand-new account is asked to fill in: up before the onboarding,
			// and not the onboarding's to paint over.
			prelude.holdHomeOnboardingPrelude("user-profile-dialog")
		})

		// Everything else says yes — the list is in, and there is a task left to walk — so the
		// absence below is this gate's doing rather than one of the other two's.
		await vi.waitFor(
			() => {
				expect(onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
			},
			{ timeout: 5000 },
		)

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})

	it("opens as soon as that dialog is gone, without waiting for a reload", async () => {
		const { prelude } = await mountWrapper(({ prelude: preludeModule }) => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
			preludeModule.holdHomeOnboardingPrelude("user-profile-dialog")
		})

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()

		/*
		 * The dialog is dismissed on a page that is not remounted, so the hold has to be followed
		 * rather than read once. And the introduction still has to be on offer at that point: waiting
		 * behind the dialog must not spend it — the one-shot flag is the same thing that decides
		 * whether a later mount ever shows the dialog at all.
		 */
		act(() => prelude.releaseHomeOnboardingPrelude("user-profile-dialog"))

		expect(await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })).toBeTruthy()
	})
})

describe("the offer of the introduction, once it has been taken up", () => {
	/**
	 * The gate above is answered by reading the stores, and the page they belong to goes on moving
	 * after the dialog is up: the organization settles, the sidebar answers, the layout the wrapper
	 * hangs off re-renders for reasons of its own. None of that is a new answer to "may this page
	 * offer the run" — and taking the run back down is not a small mistake, because the run spends
	 * the one-shot flag the moment the dialog is on screen. A dialog unmounted here is gone for good:
	 * the flag that was just written is the same one that keeps a later mount from offering it.
	 */
	it("keeps the dialog up while the page around it re-renders", async () => {
		const { wrapper, rerender } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
		})

		await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })

		await act(async () => {
			rerender(<wrapper.default isMobile={false} />)
		})

		expect(screen.queryByRole("dialog", { name: INTRO })).not.toBeNull()
	})

	it("is not taken down by a dialog that arrives after it", async () => {
		/*
		 * The daily-reward claim takes the screen for the length of its request, and it can begin at
		 * any time — the account's organization lands late, or the check comes round on its timer.
		 * Arriving behind an introduction that is already up, it is the same kind of late answer as a
		 * re-render: the run has been offered, and nothing that happens afterwards can un-offer it.
		 */
		const { prelude } = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
		})

		await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })

		act(() => prelude.holdHomeOnboardingPrelude("daily-reward-claim"))

		expect(screen.queryByRole("dialog", { name: INTRO })).not.toBeNull()
	})
})

describe("the wrapper's offer of the introduction", () => {
	/**
	 * A page load is a fresh module graph over storage that is *not* cleared, which is exactly what
	 * mounting the wrapper twice here reproduces: `vi.resetModules()` reloads the code, and the
	 * account's answer has to be read back from somewhere that survives it.
	 */
	it("does not offer the dialog to an account that has already been shown it", async () => {
		const first = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
		})

		// The dialog is up, so the account has been shown it — which is all it takes.
		await screen.findByRole("dialog", { name: INTRO }, { timeout: 15000 })
		expect(first.onboarding.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(true)

		first.unmount()

		/*
		 * The next load. The account still owes both home tasks and the list still says so, so this
		 * is the one-shot flag rather than progress — and nothing here may put the dialog back. The
		 * tasks are opened from the benefits card from now on.
		 */
		const second = await mountWrapper(() => {
			getOnboardingTasks.mockResolvedValue({ tasks: [task("first_ai_work", "PENDING")] })
		})

		await vi.waitFor(
			() => {
				expect(second.onboarding.getHomeOnboardingRewardList(MAGIC_ID).status).toBe("ready")
			},
			{ timeout: 5000 },
		)

		expect(screen.queryByRole("dialog", { name: INTRO })).toBeNull()
	})
})
