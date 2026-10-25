import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react"
import { useParams } from "react-router"
import { useOrganization, useUserInfo } from "@/models/user/hooks"
import { WorkspacePage } from "@/pages/superMagic/layouts/MainLayout/types"
import {
	canOpenAutomaticHomeOnboarding,
	checkIfHomeOnboardingNeeded,
	ensureHomeOnboardingRewardList,
	getHomeOnboardingEntryTask,
	getHomeOnboardingFlow,
	getHomeOnboardingRewardList,
	HOME_ONBOARDING_REQUEST_EVENT,
	HOME_ONBOARDING_STATE_EVENT,
	isHomeOnboardingIntroSpent,
	isHomeOnboardingTaskOnPage,
	isHomeOnboardingTaskPending,
	setHomeOnboardingRunPending,
	setHomeOnboardingUserMagicId,
	setHomeOnboardingAnalyticsScope,
	type HomeOnboardingRewardListStatus,
	type HomeOnboardingTaskPage,
} from "./GuideTourManager"
import { useCanHostHomeOnboarding } from "./onboardingAvailability"
import { useHomeOnboardingPreludeHeld } from "./onboardingPrelude"

const HomeOnboardingTour = lazy(() => import("./HomeOnboardingTour"))
/**
 * The congratulations are a chunk of their own for the reason the tour is: they reach the workspace
 * services, and this wrapper is mounted by every page — including the pages of the benefits card,
 * which imports the barrel above for the manager's helpers and must not inherit a dialog's worth of
 * dependencies for them. They are fetched on the one page that can show them, and nowhere else.
 */
const HomeOnboardingFirstWorkCongrats = lazy(() => import("./HomeOnboardingFirstWorkCongrats"))

/**
 * Suspense renders this after the wrapper has selected a tour but before the lazy component is
 * available. Reserving the screen here closes the only frame in which the benefits card could be
 * observed before the tour had a chance to publish `runActive`.
 */
function HomeOnboardingTourLoadingFallback() {
	useLayoutEffect(() => {
		setHomeOnboardingRunPending(true)
		return () => setHomeOnboardingRunPending(false)
	}, [])

	return null
}

interface GuideTourWrapperProps {
	/**
	 * Whether this wrapper is on a mobile client. It is passed rather than worked out here because
	 * the answer is the page's: `useIsMobile` is already how these layouts decide what to render,
	 * and asking a second time could only disagree with the page it is on.
	 */
	isMobile: boolean
	/**
	 * Which page is hosting this wrapper. Every task's steps are highlighted on one page, and only
	 * that page may serve a run for it — the home steps never open over the MagiClaw page and vice
	 * versa.
	 */
	page?: HomeOnboardingTaskPage
}

/**
 * The tour itself, mounted only where the feature can actually be shown: a SaaS personal
 * organization, on a desktop client.
 *
 * It is a component of its own rather than a guard inside the one below, because the guard has to
 * run *before* the work: the effects here ask the backend for a reward list and follow its answer,
 * and a component that mounts and then hides has already asked. Keeping the two apart means that on
 * a private deployment, in a team organization or on a mobile client none of this is ever mounted,
 * its effects never run, and the lazy chunk above is never fetched.
 */
function GuideTourGate({ isMobile, page = "home" }: GuideTourWrapperProps) {
	const { userInfo } = useUserInfo()
	const { projectId, topicId } = useParams()
	const [requestVersion, setRequestVersion] = useState(0)
	/**
	 * How far the backend's answer for this account's reward list has got. Held as the status rather
	 * than as a derived boolean because the gate below is read in the render body: a write that
	 * changed the answer without scheduling a render would leave that gate reading a stale one.
	 * Seeded from the cache so a second mount on an already-answered account does not flicker.
	 */
	const [rewardStatus, setRewardStatus] = useState<HomeOnboardingRewardListStatus>(
		() => getHomeOnboardingRewardList(userInfo?.magic_id).status,
	)
	/**
	 * Whether a dialog that comes *before* this feature is holding the screen — the profile one a
	 * brand-new account is asked to fill in, or the daily reward one. This run is the last of them,
	 * so it waits here rather than painting over whatever is up. See `onboardingPrelude`.
	 */
	const preludeHeld = useHomeOnboardingPreludeHeld()
	const workspacePage = topicId && projectId ? WorkspacePage.Chat : WorkspacePage.Home
	const isHome = workspacePage === WorkspacePage.Home

	useEffect(() => {
		const handleRequest = () => setRequestVersion((version) => version + 1)
		window.addEventListener(HOME_ONBOARDING_REQUEST_EVENT, handleRequest)
		return () => window.removeEventListener(HOME_ONBOARDING_REQUEST_EVENT, handleRequest)
	}, [])

	/**
	 * The list is what tells the run whether there is anything to offer, so the wrapper asks for it
	 * once on mount and follows the answer from then on — a claim, a refresh or the initial load all
	 * announce themselves the same way.
	 */
	useEffect(() => {
		const userMagicId = userInfo?.magic_id
		if (!userMagicId) return
		const sync = () => setRewardStatus(getHomeOnboardingRewardList(userMagicId).status)
		sync()
		void ensureHomeOnboardingRewardList(userMagicId)
		window.addEventListener(HOME_ONBOARDING_STATE_EVENT, sync)
		return () => window.removeEventListener(HOME_ONBOARDING_STATE_EVENT, sync)
	}, [userInfo?.magic_id])

	/**
	 * Publishing the account for the entries that have none of their own. A click on a file a task
	 * delivered happens inside the message list, which has no account to ask and must not grow one
	 * — see `setHomeOnboardingUserMagicId`. Written here because this wrapper is the one place that
	 * already reads it, and cleared on the way out so a client the guide has left behind cannot
	 * keep answering as the account it last held.
	 */
	useEffect(() => {
		setHomeOnboardingUserMagicId(userInfo?.magic_id)
		return () => setHomeOnboardingUserMagicId(undefined)
	}, [userInfo?.magic_id])

	const activeFlow = getHomeOnboardingFlow()
	/**
	 * A request names the task it wants, so the page that owns that task's anchors is the one that
	 * answers it. This covers a "回看" too: the entry is what the tour reads on mount, and a request
	 * for a task this page does not own is simply not ours to serve.
	 */
	const entryTask = getHomeOnboardingEntryTask()
	const entryForThisPage = isHomeOnboardingTaskOnPage(entryTask, page)
	/**
	 * The automatic run stays a home-page affair — its steps are the home layout's — and it stands
	 * aside while a request is pending, so it can neither start the MagiClaw steps nor answer for
	 * them on the way to the page that owns them. It also waits for the reward list before it offers
	 * anything, which keeps the three things the list can take away off the screen: a task the
	 * account has already finished, the tour itself on a deployment that does not have the feature,
	 * and — the narrowest of them — the introduction on an account whose AI-work task is no longer
	 * waiting for it.
	 *
	 * That last one is read from the list rather than from the progress mirror, and it is why the
	 * run names its own task here. The mirror is seeded from the list's completed rows alone, so a
	 * task the backend has expired, or one a shorter list never carried at all, still reads as
	 * unfinished — and the dialog would open on an account with nothing left to do. The run belongs
	 * to the AI-work task (see `entry` in the tour: nothing asks for the workbench one, so an
	 * unasked run can only be this), so its row is the one that has to say `PENDING`.
	 *
	 * And it waits behind the dialogs that come first. Only this run — not an entry a user asked for
	 * from the benefits card — is held back by them: the intro dialog is what opens unasked, and a
	 * run already on screen belongs to someone who asked for it, so a dialog arriving late (the daily
	 * reward is checked on a timer, not only at startup) must not tear it down.
	 *
	 * The introduction dialog is in fact all this run ever shows, and it is shown once per account
	 * rather than once per page load. Once spent there is nothing left for an unasked run to do, so
	 * the wrapper does not mount one at all — the tasks are entered from the benefits card from then
	 * on, and a reload cannot bring the dialog back.
	 */
	const automaticRun =
		page === "home" &&
		!entryTask &&
		!preludeHeld &&
		!isHomeOnboardingIntroSpent(userInfo?.magic_id) &&
		canOpenAutomaticHomeOnboarding(rewardStatus) &&
		isHomeOnboardingTaskPending(userInfo?.magic_id, "first-ai-work") &&
		checkIfHomeOnboardingNeeded(userInfo?.magic_id, isHome, isMobile)

	/**
	 * The offer stands once it has been made.
	 *
	 * Every answer above is a reason to *wait* — the list is still on its way, a dialog ahead of this
	 * one is on screen, the account's status has not settled — and waiting is not the same thing as
	 * taking the offer back. Two of them change *because* the run has started, which is what makes
	 * the distinction carry weight rather than being a nicety:
	 *
	 * - the introduction flag is spent by the run itself, the moment the dialog is on screen;
	 * - a daily-reward claim takes the screen for the length of its request, and it can begin at any
	 *   time — the account's organization arrives late, or the check comes round on its timer.
	 *
	 * Read again on the next render — and there is always a next render: the organization store
	 * settles, the sidebar answers, the layout this wrapper hangs off re-renders for reasons of its
	 * own — either of them would unmount exactly what just satisfied it. The dialog would then close
	 * a frame after opening, and it could not be brought back: the flag written by showing it is the
	 * same flag that keeps a later mount from offering it at all, so the account would be left having
	 * seen a dialog for no time and having lost it for good.
	 */
	const [automaticRunOffered, setAutomaticRunOffered] = useState(false)
	useEffect(() => {
		if (automaticRun) setAutomaticRunOffered(true)
	}, [automaticRun])

	/*
	 * The second line behind the wrapper's own mobile answer. That gate is what keeps a phone from
	 * asking at all; this one is about rendering, and it is kept because the two are different
	 * claims — nothing in this component is for a mobile client, whatever got it mounted.
	 */
	if (!userInfo?.magic_id || isMobile) return null

	/*
	 * The run stays mounted on the strength of the offer having been made, not on the strength of it
	 * still being available: see `automaticRunOffered`.
	 */
	const tourRequested = entryForThisPage || automaticRun || automaticRunOffered || activeFlow
	/*
	 * The project detail page, which is the only page this dialog belongs to: it is the page a topic
	 * runs on, and the one whose route carries both ids. The same pair is what the dialog itself
	 * reads before it subscribes, so the two cannot disagree about which page this is.
	 */
	const onProjectPage = Boolean(projectId && topicId)

	return (
		<>
			{/*
			 * The congratulations a first finished task earns are *not* a run: nothing asks for them
			 * and no step walks them, so they are mounted beside the tour rather than through it. The
			 * account they belong to, and whether this client has the feature at all, are the two
			 * things this gate has already worked out, which is why they are rendered from here
			 * rather than from a mount point of their own.
			 */}
			{onProjectPage ? (
				<Suspense fallback={null}>
					<HomeOnboardingFirstWorkCongrats userMagicId={userInfo.magic_id} />
				</Suspense>
			) : null}
			{tourRequested ? (
				<Suspense fallback={<HomeOnboardingTourLoadingFallback />}>
					{/*
					 * `key` forces a fresh tour on every replay request. A finished tour stays mounted
					 * while rendering null, so reusing the instance would keep its internal
					 * `dismissed` state and the replay would never become visible again.
					 */}
					<HomeOnboardingTour
						key={requestVersion}
						page={page}
						userMagicId={userInfo.magic_id}
					/>
				</Suspense>
			) : null}
		</>
	)
}

/**
 * The entry point every page mounts, and the one place the feature's own availability is read.
 *
 * Pages do not ask whether to mount this: they mount it and it decides, which keeps the rule in one
 * file and out of the eight call sites. `null` here means "this client has no new-user onboarding",
 * and it is answered without mounting anything.
 *
 * **Mobile is one of those answers, and it has to be read here rather than below.** The home layout
 * mounts this wrapper on both clients — it is the layout that renders it, and that layout is the
 * same either way — while `GuideTourGate` only reads `isMobile` in its render body. A gate that
 * mounted on a phone would therefore register its effects first and return `null` afterwards, which
 * is exactly the shape this file exists to avoid: the reward list is asked for on mount, and a
 * client that cannot show the feature must not ask for it. (On a phone, `/super` is reached and then
 * redirected to the mobile home, so the gate really does get that one render.)
 */
export default function GuideTourWrapper({ isMobile, page }: GuideTourWrapperProps) {
	const canHostFeature = useCanHostHomeOnboarding()
	const { userInfo } = useUserInfo()
	const { organizationCode } = useOrganization()

	// Synchronize before passive exposure effects, including switches to an ineligible organization.
	// Route unmounts keep the scope so a multi-page tour retains its run and exposure records.
	useLayoutEffect(() => {
		setHomeOnboardingAnalyticsScope(userInfo?.magic_id, organizationCode)
	}, [userInfo?.magic_id, organizationCode])

	if (isMobile || !canHostFeature) return null

	return <GuideTourGate isMobile={isMobile} page={page} />
}
export {
	consumeHomeOnboardingSurfaceExposure,
	HOME_ONBOARDING_RUN_EVENT,
	HOME_ONBOARDING_STATE_EVENT,
	canManuallyCompleteHomeOnboardingTask,
	canOpenAutomaticHomeOnboarding,
	claimHomeOnboardingReward,
	ensureHomeOnboardingRewardList,
	getHomeOnboardingRewardList,
	getHomeOnboardingTaskEntryPage,
	getHomeOnboardingTaskIdByCode,
	homeOnboardingClaimFailureKey,
	HOME_ONBOARDING_TASK_CODE,
	HomeOnboardingAnchor,
	isHomeOnboardingCompleted,
	isHomeOnboardingRunBlocking,
	isHomeOnboardingRunActive,
	isHomeOnboardingTaskOnPage,
	isReplayableHomeOnboardingTask,
	refreshHomeOnboardingRewardList,
	subscribeHomeOnboardingRun,
	startHomeOnboarding,
} from "./GuideTourManager"
export type {
	HomeOnboardingClaimResult,
	HomeOnboardingReward,
	HomeOnboardingRewardList,
	HomeOnboardingRewardListStatus,
	HomeOnboardingTaskId,
	HomeOnboardingTaskPage,
} from "./GuideTourManager"
