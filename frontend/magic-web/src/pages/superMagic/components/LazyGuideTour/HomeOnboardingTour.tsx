import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { IconArrowRight, IconArrowUp } from "@tabler/icons-react"
import { cn } from "@/utils/cn"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import magicToast from "@/components/base/MagicToaster/utils"
import { analyticsService } from "@/services/analytics"
import { useElementVisibility } from "@/pages/superMagic/hooks/useElementVisibility"
import { sidebarStore } from "@/stores/layout"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import {
	canManuallyCompleteHomeOnboardingTask,
	claimHomeOnboardingReward,
	clearHomeOnboardingEntryTask,
	beginHomeOnboardingAnalyticsRun,
	consumeHomeOnboardingStepExposure,
	consumeHomeOnboardingSurfaceExposure,
	endHomeOnboardingAnalyticsRun,
	getHomeOnboardingAnalyticsRun,
	getHomeOnboardingEntryTask,
	getHomeOnboardingFlow,
	getHomeOnboardingPreparedStepIndex,
	getHomeOnboardingRewardList,
	getHomeOnboardingStepIndex,
	homeOnboardingClaimFailureKey,
	HOME_ONBOARDING_STEP_READY_EVENT,
	isHomeOnboardingCompleted,
	isHomeOnboardingIntroSpent,
	isHomeOnboardingTaskOnPage,
	isReplayableHomeOnboardingTask,
	markHomeOnboardingAborted,
	refreshHomeOnboardingRewardList,
	resetHomeOnboardingStepIndex,
	setHomeOnboardingAnchor,
	setHomeOnboardingFlow,
	setHomeOnboardingRunActive,
	setHomeOnboardingSidebarTopMode,
	setHomeOnboardingStepIndex,
	spendHomeOnboardingIntro,
	HomeOnboardingAnchor,
	type HomeOnboardingFlow,
	type HomeOnboardingTaskId,
	type HomeOnboardingTaskPage,
} from "./GuideTourManager"

type Placement = "left" | "right" | "top" | "bottom"

/**
 * The route each page a task may run on is reached by. A run that spans pages asks the router for
 * the next one itself, because those pages are separate entries in the route table and the tour is
 * re-mounted on each of them.
 */
const ONBOARDING_PAGE_ROUTE_NAME: Partial<Record<HomeOnboardingTaskPage, string>> = {
	"skill-market": RouteName.CrewMarketSkills,
	"my-skills": RouteName.MySkills,
	recordings: RouteName.AudioRecordings,
}

/**
 * How tall a step card is assumed to be until it has actually been measured. Only a starting
 * point: the card is measured after its first render, because its height is decided by the copy
 * and the wrapping, and a card placed against a stale guess ends up sitting on top of the very
 * control it points at.
 */
const CARD_HEIGHT_FALLBACK = 240
const ONBOARDING_EXPOSURE_RATIO = 0.01
const ONBOARDING_EXPOSURE_THRESHOLDS = [0, ONBOARDING_EXPOSURE_RATIO]
const FIXED_FLOW_STEP_INDEX: Partial<Record<HomeOnboardingFlow, number>> = {
	"featured-case": 1,
	"prompt-ready": 2,
	"task-processing": 3,
}

/**
 * How much of the card has to stay on screen when it is pushed against a window edge to keep clear
 * of its anchor. The card's footer is the part that has to remain reachable.
 */
const MIN_VISIBLE_CARD = 140

/**
 * How far the pointer's centre stays from the card's corners, along the edge it is drawn on. The
 * pointer names the control a step is about, so it follows that control rather than the card — but
 * a triangle that slides into a rounded corner stops reading as part of the card, so it keeps this
 * much inset. It is a little more than the corner radius (14px) plus half the pointer's own 18px
 * width, which is what it takes for the whole triangle to sit against a straight edge.
 */
const ARROW_INSET = 24

/**
 * Below this width the card is pinned to the bottom of the window instead of being placed against
 * its anchor (see the `max-[760px]` classes below), so an offset measured from the card's own left
 * edge would mean nothing. The pointer stays centred on the card there, as it always did.
 *
 * The allowance is for the scrollbar: the pinned layout is chosen by a media query, which measures
 * the viewport without one, while `innerWidth` here includes it. Being a little wide only means the
 * pointer falls back to the card's middle a few pixels earlier, which is what it did before this
 * followed the anchor at all.
 */
const NARROW_CARD_MAX_WIDTH = 760
const SCROLLBAR_ALLOWANCE = 16

/** A box in window coordinates, as `getBoundingClientRect` reports one. */
interface WindowBox {
	left: number
	top: number
	width: number
	height: number
}

/**
 * The boxes that fill the window apart from `holes` — the half of a mask that answers the pointer.
 *
 * A step whose cut-outs have to stay clickable draws its mask with `pointer-events-none` over the
 * whole overlay (see the "prompt-ready" card below), and the dimmed page underneath then reads
 * every click as if the mask were not there at all. These boxes are transparent to the eye and not
 * to the pointer: what the mask shows as covered is also what it stops.
 *
 * The window is cut into bands along the holes' own horizontal edges. A band either holds no hole —
 * and is covered whole — or holds some, and is covered by the strips beside them, in order from the
 * left and merged where the holes overlap. Two holes stacked one above the other therefore come out
 * of one cover, including the row between them that belongs to neither.
 */
function coverWindowExcept(viewWidth: number, viewHeight: number, holes: WindowBox[]): WindowBox[] {
	const clipped = holes
		.map((hole) => ({
			left: Math.max(0, hole.left),
			right: Math.min(viewWidth, hole.left + hole.width),
			top: Math.max(0, hole.top),
			bottom: Math.min(viewHeight, hole.top + hole.height),
		}))
		.filter((hole) => hole.right > hole.left && hole.bottom > hole.top)
	if (!clipped.length) return [{ left: 0, top: 0, width: viewWidth, height: viewHeight }]

	const edges = [
		...new Set([0, viewHeight, ...clipped.flatMap((hole) => [hole.top, hole.bottom])]),
	].sort((left, right) => left - right)

	const covers: WindowBox[] = []
	for (let index = 0; index < edges.length - 1; index += 1) {
		const top = edges[index]
		const height = edges[index + 1] - top
		if (height <= 0) continue
		const spanning = clipped
			.filter((hole) => hole.top <= top && hole.bottom >= top + height)
			.sort((left, right) => left.left - right.left)
		let cursor = 0
		for (const hole of spanning) {
			if (hole.left > cursor)
				covers.push({ left: cursor, top, width: hole.left - cursor, height })
			cursor = Math.max(cursor, hole.right)
		}
		if (cursor < viewWidth)
			covers.push({ left: cursor, top, width: viewWidth - cursor, height })
	}
	return covers
}

/**
 * The box a step is framed by: the anchor's own box, grown to hold the companions the step names
 * alongside it — see `OnboardingStep.extraAnchors`.
 *
 * Companions that are not on the page are skipped rather than throwing the frame off, and a step
 * whose companions are all missing is framed over its anchor alone, exactly as before the field
 * existed. A companion that is mounted but has no box — a collapsed container, a hidden block — is
 * skipped too, because counting it would drag the frame onto the origin.
 */
function frameWithCompanions(anchor: HTMLElement, companions: string): DOMRect {
	const boxes = [anchor.getBoundingClientRect()]
	for (const name of companions.split(",").filter(Boolean)) {
		const node = document.querySelector<HTMLElement>(`[data-guide-anchor="${name}"]`)
		if (!node) continue
		const box = node.getBoundingClientRect()
		if (box.width <= 0 && box.height <= 0) continue
		boxes.push(box)
	}
	if (boxes.length === 1) return boxes[0]
	const left = Math.min(...boxes.map((box) => box.left))
	const top = Math.min(...boxes.map((box) => box.top))
	const right = Math.max(...boxes.map((box) => box.right))
	const bottom = Math.max(...boxes.map((box) => box.bottom))
	return new DOMRect(left, top, right - left, bottom - top)
}

/**
 * The vertical extent of the prompt inside the editor.
 *
 * The editor's viewport is stretched to the height the card gives it, so its own box says how tall
 * the card is rather than where the prompt is: a prompt of one line sits at the top of a box that is
 * mostly empty, because the room below it is there for the lines a longer prompt would take. Framing
 * the viewport therefore draws a cut-out the height of the card, with the prompt in one corner of
 * it.
 *
 * What the cut-out is for is the prompt, so it is the prompt that is measured: the blocks the
 * editor's surface is actually made of, and all of them, because a prompt is as many paragraphs as
 * it is. The surface's own box is the fallback for the one case that has no laid-out block to take
 * — a document that is empty, or an editor that has not mounted its content yet.
 */
function promptExtent(editor: HTMLElement): { top: number; bottom: number } {
	const box = editor.getBoundingClientRect()
	const surface = editor.querySelector<HTMLElement>(".ProseMirror")
	if (!surface) return { top: box.top, bottom: box.bottom }
	const blocks = Array.from(surface.children)
		.filter((child): child is HTMLElement => child instanceof HTMLElement)
		.map((block) => block.getBoundingClientRect())
		.filter((block) => block.height > 0)
	if (blocks.length === 0) {
		const surfaceBox = surface.getBoundingClientRect()
		return { top: surfaceBox.top, bottom: surfaceBox.bottom }
	}
	return {
		top: Math.min(...blocks.map((block) => block.top)),
		bottom: Math.max(...blocks.map((block) => block.bottom)),
	}
}

/**
 * The composer's cut-out: the prompt, grown to hold the composer's own padding.
 *
 * The anchor this step measures wraps the editable area and nothing else: the padding that keeps the
 * prompt off the card's edge belongs to the element around it. A cut-out drawn on the anchor alone
 * therefore clips the text flush to its own edge — the first character of the prefilled prompt sits
 * exactly where the highlight begins, which reads as the highlight having swallowed the margin the
 * composer was drawn with.
 *
 * Growing the box by that padding puts the cut-out's edge where the card's edge is, and the text
 * keeps the distance from it that it has on the page.
 *
 * The padding is read rather than written down, because it is not one number: the composer is drawn
 * at three sizes and pads itself differently at each. A composer that is not on the page — or one
 * that does not hold this editor, as a page swapping its composer out leaves behind — leaves the box
 * exactly as the anchor measured it.
 *
 * The two axes are taken from different boxes on purpose. Left and right are the viewport's, which
 * spans the card and so puts the cut-out's sides on the card's sides. Top and bottom are the
 * prompt's, which is what the step is about: grown from the viewport instead, the cut-out is as tall
 * as the card however short the prompt is, and its lower edge — the padding again — lands on the
 * toolbar, on the very send button the user is being asked to press next.
 *
 * Both of those are bounded by the composer rather than free. The upper edge never rises above the
 * card, so a prompt scrolled up out of view cannot drag the cut-out off it; the lower edge never
 * falls past the bottom of the editor's viewport, so a prompt too long to fit cannot push the
 * cut-out down onto the toolbar either.
 */
function composerHole(editor: HTMLElement): DOMRect {
	const box = editor.getBoundingClientRect()
	const composer = document.querySelector<HTMLElement>(
		'[data-guide-anchor="message-editor-container"]',
	)
	if (!composer || !composer.contains(editor)) return box
	const style = window.getComputedStyle(composer)
	const top = Number.parseFloat(style.paddingTop) || 0
	const right = Number.parseFloat(style.paddingRight) || 0
	const bottom = Number.parseFloat(style.paddingBottom) || 0
	const left = Number.parseFloat(style.paddingLeft) || 0
	const prompt = promptExtent(editor)
	const upper = Math.max(prompt.top - top, composer.getBoundingClientRect().top)
	const lower = Math.min(prompt.bottom + bottom, box.bottom)
	return new DOMRect(box.left - left, upper, box.width + left + right, Math.max(lower - upper, 0))
}

/**
 * Taking the mark off the attachment block this run was opened from.
 *
 * The entry that opens the tour of a delivered file is what puts the mark there, because only the
 * click knows which of a page's blocks was the one — the message list holds one per message and
 * they all look the same (see `startHomeOnboardingDeliverableRunIfDue`). Leaving it behind would
 * let that block go on claiming to be the subject of a tour that is over, and the next tour to ask
 * for the anchor — another account's, on the same machine — would frame it rather than its own.
 */
function clearDeliverableAnchor() {
	document
		.querySelectorAll(`[data-guide-anchor="${HomeOnboardingAnchor.DeliverableAttachment}"]`)
		.forEach((element) => element.removeAttribute("data-guide-anchor"))
}

/**
 * How long a step that the hosting page has to build waits for that page to answer before the run
 * gives up on it. It is not a deadline for the page's work — the page's answer is what matters and
 * its library may legitimately take a while — but a guard against a page that never answers at all,
 * which would otherwise leave the run waiting on an overlay nothing can dismiss.
 */
const PAGE_PREPARE_TIMEOUT_MS = 8000

/**
 * How long a step waits for its anchor once there is nothing left to wait for but the anchor itself.
 * Every step has its anchor on screen by the time the tour is armed, and a step the page had to
 * build has been asked for by the time it answers — the card is already on its way and the move to
 * it takes a fraction of a second — so a short grace period is plenty. It is a grace period and not
 * a sentence, though: the moment the anchor does show up the wait is over and this deadline is
 * dropped, so what it really bounds is how long a step with nothing to show is kept on screen.
 */
const ANCHOR_APPEAR_TIMEOUT_MS = 2000

/**
 * How far a box has to move between two frames to be worth measuring again. Sub-pixel, so that a
 * page holding still is measured once and left alone rather than redrawn every frame.
 *
 * Small enough to matter, though. A decelerating curve covers most of its distance early and then
 * creeps: over the last third of the micro-app composer's 20px rise it moves by a fraction of a
 * pixel a frame, so a tolerance of half a pixel calls it settled with two or three pixels still to
 * go — the same misalignment this follow exists to remove, only smaller. At this tolerance what is
 * left when it lets go is under a tenth of a pixel.
 */
const ANCHOR_MOVE_EPSILON = 0.05

/**
 * How many frames of stillness, after the anchor has been seen to move, end the follow — a
 * twentieth of a second at 60Hz, which no easing curve's last step spans.
 */
const ANCHOR_STILL_FRAMES = 3

/**
 * How long an anchor is followed at most, entrance or not. A page whose anchor never holds still is
 * animating it on purpose, and a guide that keeps chasing it is worse than one that stays where it
 * was put; it is also what caps the follow for the many steps whose anchor never moves at all,
 * since a page that has not started moving yet cannot be told from one that has nothing to move.
 */
const ANCHOR_FOLLOW_TIMEOUT_MS = 2000

/** Whether a box has moved, on any edge, by more than the follow bothers to chase. */
function boxMoved(previous: DOMRect, next: DOMRect): boolean {
	return (
		Math.abs(previous.left - next.left) > ANCHOR_MOVE_EPSILON ||
		Math.abs(previous.top - next.top) > ANCHOR_MOVE_EPSILON ||
		Math.abs(previous.width - next.width) > ANCHOR_MOVE_EPSILON ||
		Math.abs(previous.height - next.height) > ANCHOR_MOVE_EPSILON
	)
}

/**
 * Following an anchor that is still on its way in.
 *
 * A step's box used to be measured once, the moment its anchor turned up — an anchor on screen
 * taken to be an anchor in place. The micro-app page does not oblige: it brings its composer in
 * with a transform, the card rising its last 20px over the second after it mounts, and a box
 * measured at the start of that move leaves the mask and the card where the composer no longer is.
 * Measured again once the move is over, they are right.
 *
 * So the box is followed frame by frame until it stops changing, and no further. Bounded on three
 * sides: it ends once the anchor has moved and then held still, it ends after
 * `ANCHOR_FOLLOW_TIMEOUT_MS` even if it never holds still, and it ends when the anchor goes.
 *
 * The move comes first, and that ordering is the whole of it. That entrance is armed with a fifth
 * of a second of delay, so the page is perfectly still for its first twelve frames — stillness
 * that cannot be told apart from a page with nothing to animate, and that a still-anchored end to
 * the follow therefore reads as the anchor having arrived. It has not: it has not set off. Waiting
 * for movement before accepting the absence of it is what makes the difference, and the deadline
 * is what keeps that wait bounded for the many steps whose anchor never moves at all. Those pay a
 * loop that measures a box and leaves it alone, which is what keeps this the tail of the wait that
 * found the anchor rather than a subscription to the page.
 *
 * `apply` runs only for a box that really moved, so a page that holds still is measured once and
 * left alone. Returns the function that ends the follow early — a step change, generally — and
 * `onSettled` is left uncalled in that case, because an interrupted follow says nothing about where
 * the anchor ended up.
 */
function followAnchorUntilStill(
	measure: () => DOMRect | null,
	apply: () => void,
	onSettled: () => void,
): () => void {
	let previous = measure()
	let applied = previous
	let stillFrames = 0
	let moved = false
	let frame = 0
	const startedAt = Date.now()

	const tick = () => {
		const box = measure()
		// Nothing left to follow is a settle of its own.
		if (!box) {
			onSettled()
			return
		}
		if (!applied || boxMoved(applied, box)) {
			applied = box
			moved = true
			apply()
		}
		stillFrames = previous && boxMoved(previous, box) ? 0 : stillFrames + 1
		previous = box
		/*
		 * Until the anchor has been seen to move, a frame of stillness says nothing about whether it
		 * is in place — see above. It is the anchor that has moved and then stopped, not the one
		 * that has never started, that this ends on.
		 */
		if (moved && stillFrames >= ANCHOR_STILL_FRAMES) {
			onSettled()
			return
		}
		if (Date.now() - startedAt >= ANCHOR_FOLLOW_TIMEOUT_MS) {
			onSettled()
			return
		}
		frame = window.requestAnimationFrame(tick)
	}
	frame = window.requestAnimationFrame(tick)

	return () => window.cancelAnimationFrame(frame)
}

/**
 * One highlighted step of a task. `action` replaces the shared "next" wording of the primary button
 * when a step hands over to a particular part of the page; a step without one advances generically,
 * and the run's last step closes with the label its own state calls for.
 */
interface OnboardingStep {
	/** Stable task-wide number; reordering or skipping cards must not change their identity. */
	analyticsStepIndex: number
	anchor: string
	placement: Placement
	title: string
	text: string
	action?: string
	/**
	 * The page this step's anchor lives on. A step of a single-page task leaves it out — it is
	 * wherever the run is. The skill tour names it on every step, because it is the one run whose
	 * steps are spread over two routes.
	 */
	page?: HomeOnboardingTaskPage
	/**
	 * Whether the step may be walked past when its anchor is not there. An optional step points at
	 * an entry the user is not guaranteed to have — the create-skill menu, which an account without
	 * the permission never renders — so the run moves on instead of failing over it. Every other
	 * step lives on a control the tour itself relies on, and a missing anchor there means the tour
	 * could not be shown at all.
	 */
	optional?: boolean
	/**
	 * Whether the hosting page has to build what this step highlights before it can be shown. The
	 * AI-PPT steps frame a template card, and that card is not somewhere the page can simply point
	 * at: the tour has to ask for one, the page picks a template, centres it and only then knows
	 * where it is. So the anchor cannot be waited for on a timer — a page still fetching its library
	 * looks exactly like a page that has nothing to show, and guessing between the two is what makes
	 * such a step flick past. These steps wait for the page's own verdict — announced through
	 * `announceHomeOnboardingStepPrepared` — and only a step the page has called finished is judged
	 * on whether its anchor turned up.
	 */
	awaitsPage?: boolean
	/**
	 * Further anchors this step is framed together with.
	 *
	 * A step frames one box, but the region a step is about need not live in a single element. The
	 * sidebar step is what added this field: it introduces the whole navigation, while the anchor it
	 * measures is the capability list, which is published by a different component from the two
	 * entries above it. Framing the anchor alone draws a box that stops short of what the copy has
	 * just named, so a step may name companions and be framed over the bounding box of all of them.
	 *
	 * A companion that is not on the page is skipped and the frame falls back to the anchor alone —
	 * the anchor is what the step is really about, and a missing companion is not a failed step.
	 */
	extraAnchors?: string[]
}

/**
 * One step of a guided flow — the in-project tour and the tour of a delivered file. It answers the
 * same questions an `OnboardingStep` does, and the run renders it through the same card; what
 * differs is how it is reached. A task's steps belong to the task and are walked by index, while a
 * flow's steps belong to the flow and are walked in the order they are written, which is also why
 * the flow each one carries has to be written out on every step rather than named once.
 */
interface GuidedFlowStep {
	/** Uses task-wide numbering, independent of this flow's position. */
	analyticsStepIndex: number
	flow: HomeOnboardingFlow
	anchor: string
	title: string
	text: string
	placement: Placement
	/**
	 * Whether the step may be walked past when its anchor is not on the page — see
	 * `OnboardingStep.optional`.
	 *
	 * No step of a flow sets it today, and that is deliberate rather than an oversight. A flow walks
	 * the page the run is already on, and its steps frame regions that page always renders; the one
	 * exception used to be the delivered file's second step, which framed the row the file was filed
	 * under — a row published only while that file is the open one. It framed the project files area
	 * instead (see `deliverableSteps`), which turned a step that was usually skipped into one that
	 * always has something to point at. The field stays because the question it answers is a real
	 * one for a flow too; it simply has no caller yet.
	 */
	optional?: boolean
	/**
	 * Further anchors this step is framed together with — see `OnboardingStep.extraAnchors`.
	 *
	 * Declared here for the same reason `optional` is: the tour reads both kinds of step through one
	 * expression, so a field that only one of the two shapes carries is a field the tour cannot read
	 * without a cast. No flow sets it today — and the two flows that reach this interface are also
	 * the two the frame skips companions for, so it would be dead twice over. It stays because the
	 * question it answers — whether a region needs more than one box — is one a flow can ask.
	 */
	extraAnchors?: string[]
}

interface HomeOnboardingTourProps {
	userMagicId?: string
	/** Which page is hosting this run. Only the page that owns a task's anchors may serve it. */
	page?: HomeOnboardingTaskPage
	onComplete?: () => void
}

function HomeOnboardingTour({ userMagicId, page = "home", onComplete }: HomeOnboardingTourProps) {
	const { t } = useTranslation("super/guideTour")
	const navigate = useNavigate()
	// The task-list response owns this classification; analytics only forwards that snapshot.
	const participantType = getHomeOnboardingRewardList(userMagicId).participantType
	// The MagiClaw task names the product, and its name is environment- and language-dependent.
	const clawBrandValues = getClawBrandTranslationValues()
	const homeSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.WorkspaceSidebar,
			placement: "right" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.steps.sidebar.title"),
			text: t("homeOnboarding.steps.sidebar.description"),
			/*
			 * The step calls the whole left navigation the way into every capability, and that
			 * includes the two entries at the top of it — which the layout publishes, not the list
			 * the anchor names. See `OnboardingStep.extraAnchors`.
			 */
			extraAnchors: [HomeOnboardingAnchor.SidebarHomeActions],
		},
		{
			anchor: HomeOnboardingAnchor.WorkspaceList,
			placement: "right" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.steps.workspace.title"),
			text: t("homeOnboarding.steps.workspace.description"),
		},
		{
			anchor: HomeOnboardingAnchor.RoleSwitcher,
			placement: "top" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.steps.experts.title"),
			text: t("homeOnboarding.steps.experts.description"),
		},
		{
			anchor: HomeOnboardingAnchor.MessageComposer,
			placement: "top" as Placement,
			analyticsStepIndex: 4,
			title: t("homeOnboarding.steps.composer.title"),
			text: t("homeOnboarding.steps.composer.description"),
		},
	]
	const featuredCases = [
		{
			id: 1,
			title: t("homeOnboarding.featured.case1.title"),
			prompt: t("homeOnboarding.featured.case1.prompt"),
		},
		{
			id: 2,
			title: t("homeOnboarding.featured.case2.title"),
			prompt: t("homeOnboarding.featured.case2.prompt"),
		},
		{
			id: 3,
			title: t("homeOnboarding.featured.case3.title"),
			prompt: t("homeOnboarding.featured.case3.prompt"),
		},
	]
	/**
	 * The in-project tour is entered where the task used to hand over — the "开始了解" button of the
	 * processing dialog — and the two lists change their wording together, so both stay memoized:
	 * the run hands the list it is on to the effect that waits for a step's anchor, and an array
	 * rebuilt on every pass would make that wait start over each time.
	 */
	const guidedProjectSteps = useMemo<GuidedFlowStep[]>(
		() => [
			{
				flow: "project-file",
				anchor: HomeOnboardingAnchor.ProjectSider,
				analyticsStepIndex: 4,
				title: t("homeOnboarding.project.file.title"),
				text: t("homeOnboarding.project.file.description"),
				placement: "right",
			},
			{
				flow: "project-orientation",
				anchor: "message-header-topic-group",
				analyticsStepIndex: 5,
				title: t("homeOnboarding.project.topic.title"),
				text: t("homeOnboarding.project.topic.description"),
				placement: "left",
			},
			{
				flow: "project-orientation",
				// The message column rather than the scroll container it is centred in: the
				// container is full-bleed, so framing it draws a box as wide as the panel and
				// the step reads as pointing at the whole screen.
				anchor: "message-list-column",
				analyticsStepIndex: 6,
				title: t("homeOnboarding.project.result.title"),
				text: t("homeOnboarding.project.result.description"),
				placement: "left",
			},
			{
				flow: "project-orientation",
				anchor: "message-editor-container",
				analyticsStepIndex: 7,
				title: t("homeOnboarding.project.composer.title"),
				text: t("homeOnboarding.project.composer.description"),
				placement: "top",
			},
			{
				flow: "project-orientation",
				anchor: "message-editor-at-button",
				analyticsStepIndex: 8,
				title: t("homeOnboarding.project.at.title"),
				text: t("homeOnboarding.project.at.description"),
				placement: "left",
			},
		],
		[t],
	)
	/**
	 * The two steps of a delivered file — the tour a click on one of a task's results opens. The
	 * benefits card never offers it and no task is finished by it: what it marks is the moment the
	 * user first sees what a task produced, which is a moment rather than a task.
	 *
	 * The first step frames the attachment block that was clicked, and that click is the whole of
	 * what the tour stands on: the entry marks the block as the anchor, and the file itself is left
	 * shut — the user is being told what a task's results are before one of them takes the screen,
	 * and opens it by clicking again afterwards. The second step says where that result was filed
	 * and frames the project files area itself, which the page always carries: the file's own row
	 * would have been the more precise target, but the file is now opened on the click *after* this
	 * one, so that row is usually not there on the way through — and a step that is only sometimes
	 * frameable is a step whose sentence gets dropped. Pointing at the region instead costs the
	 * precision and keeps the sentence, which is what makes both steps of this run dependable.
	 */
	const deliverableSteps = useMemo<GuidedFlowStep[]>(
		() => [
			{
				flow: "project-result",
				anchor: HomeOnboardingAnchor.DeliverableAttachment,
				analyticsStepIndex: 9,
				title: t("homeOnboarding.deliverable.attachment.title"),
				text: t("homeOnboarding.deliverable.attachment.description"),
				placement: "top",
			},
			{
				flow: "project-result",
				anchor: HomeOnboardingAnchor.ProjectSider,
				analyticsStepIndex: 10,
				title: t("homeOnboarding.deliverable.saved.title"),
				text: t("homeOnboarding.deliverable.saved.description"),
				placement: "right",
			},
		],
		[t],
	)
	/**
	 * The "了解超级龙虾如何使用" steps. Their anchors are on the MagiClaw page, which is a route of its
	 * own: the benefits card is the only entry, and it navigates there before asking for this run.
	 * The tour is a demo — nothing is created, which is what the popover's note spells out.
	 */
	const clawSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.MagiClawHero,
			placement: "bottom" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.claw.steps.hero.title", clawBrandValues),
			text: t("homeOnboarding.claw.steps.hero.description", clawBrandValues),
		},
		{
			anchor: HomeOnboardingAnchor.MagiClawCreatedSection,
			placement: "bottom" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.claw.steps.create.title", clawBrandValues),
			text: t("homeOnboarding.claw.steps.create.description", clawBrandValues),
		},
		{
			anchor: HomeOnboardingAnchor.MagiClawFeatures,
			placement: "top" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.claw.steps.features.title", clawBrandValues),
			text: t("homeOnboarding.claw.steps.features.description", clawBrandValues),
		},
	]
	/**
	 * The "了解如何雇佣使用数字员工" steps. Their anchors are on the crew market page, which is a route
	 * of its own: the benefits card is the only entry, and it navigates there before asking for this
	 * run. Like the MagiClaw tour this one is a demonstration — no employee is hired and no
	 * conversation is opened — which is what the popover's note spells out.
	 *
	 * The third and the fifth step highlight the same control: a card's secondary action reads
	 * "详情" until the employee is hired and "对话" afterwards, so one anchor carries both and only
	 * the wording of the step differs.
	 */
	const employeeSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.CrewMarketSearch,
			placement: "bottom" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.employee.steps.search.title"),
			text: t("homeOnboarding.employee.steps.search.description"),
			action: t("homeOnboarding.employee.steps.search.action"),
		},
		{
			anchor: HomeOnboardingAnchor.CrewMarketCategories,
			placement: "bottom" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.employee.steps.category.title"),
			text: t("homeOnboarding.employee.steps.category.description"),
			action: t("homeOnboarding.employee.steps.category.action"),
		},
		{
			anchor: HomeOnboardingAnchor.CrewMarketCardDetails,
			placement: "right" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.employee.steps.details.title"),
			text: t("homeOnboarding.employee.steps.details.description"),
			action: t("homeOnboarding.employee.steps.details.action"),
		},
		{
			anchor: HomeOnboardingAnchor.CrewMarketCardHire,
			placement: "right" as Placement,
			analyticsStepIndex: 4,
			title: t("homeOnboarding.employee.steps.hire.title"),
			text: t("homeOnboarding.employee.steps.hire.description"),
			action: t("homeOnboarding.employee.steps.hire.action"),
		},
		{
			// The last step closes the run, so it takes the label its own state calls for instead
			// of one of its own: claiming the reward on a first pass, reviewing it on a re-watch.
			anchor: HomeOnboardingAnchor.CrewMarketCardDetails,
			placement: "left" as Placement,
			analyticsStepIndex: 5,
			title: t("homeOnboarding.employee.steps.chat.title"),
			text: t("homeOnboarding.employee.steps.chat.description"),
		},
	]
	/**
	 * The "了解如何添加/管理技能" steps. This is the one tour whose steps are not all on the same page:
	 * it opens in the skill library, hands over to "My Skills" for the two steps about its tabs, and
	 * comes back for the create entry. Every step therefore names its page, and the run moves the
	 * user between the two routes as it goes. Like the other standalone tours it is a demonstration
	 * — no skill is added, imported or created — which is what the popover's note spells out.
	 */
	const skillSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.SkillMarketSearch,
			page: "skill-market",
			placement: "bottom" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.skill.steps.search.title"),
			text: t("homeOnboarding.skill.steps.search.description"),
		},
		{
			anchor: HomeOnboardingAnchor.SkillMarketCard,
			page: "skill-market",
			placement: "right" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.skill.steps.card.title"),
			text: t("homeOnboarding.skill.steps.card.description"),
		},
		{
			/*
			 * The design shows this as a full-width button in the card's footer; the shipped card
			 * keeps the same action in its top corner instead, so the step points there.
			 */
			anchor: HomeOnboardingAnchor.SkillMarketCardAdd,
			page: "skill-market",
			placement: "top" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.skill.steps.add.title"),
			text: t("homeOnboarding.skill.steps.add.description"),
		},
		{
			anchor: HomeOnboardingAnchor.SkillMarketMySkills,
			page: "skill-market",
			placement: "left" as Placement,
			analyticsStepIndex: 4,
			title: t("homeOnboarding.skill.steps.mySkills.title"),
			text: t("homeOnboarding.skill.steps.mySkills.description"),
		},
		{
			// Continuing onto the "My Skills" route: the run moves there on the way into this step.
			anchor: HomeOnboardingAnchor.MySkillsCreatedTab,
			page: "my-skills",
			placement: "bottom" as Placement,
			analyticsStepIndex: 5,
			title: t("homeOnboarding.skill.steps.created.title"),
			text: t("homeOnboarding.skill.steps.created.description"),
		},
		{
			anchor: HomeOnboardingAnchor.MySkillsLibraryTab,
			page: "my-skills",
			placement: "bottom" as Placement,
			analyticsStepIndex: 6,
			title: t("homeOnboarding.skill.steps.library.title"),
			text: t("homeOnboarding.skill.steps.library.description"),
		},
		{
			/*
			 * Back in the skill library, and the last step: it closes the run, so it takes the label
			 * its own state calls for instead of one of its own. It is also the one step a user may
			 * not have — the create entry needs a permission — so it is optional and gets stepped
			 * over, which finishes the run early rather than failing it.
			 */
			anchor: HomeOnboardingAnchor.SkillMarketCreate,
			page: "skill-market",
			placement: "bottom" as Placement,
			analyticsStepIndex: 7,
			title: t("homeOnboarding.skill.steps.create.title"),
			text: t("homeOnboarding.skill.steps.create.description"),
			optional: true,
		},
	]
	/**
	 * The "了解微应用创建流程" steps. Their anchors are on the app-space page, which is a route of its
	 * own: the benefits card is the only entry, and it navigates there before asking for this run.
	 * Like the other standalone tours this one is a demonstration — no app is really created, which
	 * is what the popover's note spells out.
	 *
	 * The first two steps look at the same composer from two angles: the text area where the request
	 * is described, and the toolbar right below it where the model, the tools and the attachments
	 * live. The last step moves on to the "应用空间" region underneath, where the created apps are
	 * found again.
	 */
	const microAppSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.MessageEditorContent,
			placement: "left" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.microApp.steps.prompt.title"),
			text: t("homeOnboarding.microApp.steps.prompt.description"),
		},
		{
			anchor: HomeOnboardingAnchor.MessageEditorToolbar,
			placement: "left" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.microApp.steps.tools.title"),
			text: t("homeOnboarding.microApp.steps.tools.description"),
		},
		{
			/*
			 * The last step closes the run, so it takes the label its own state calls for instead
			 * of one of its own: claiming the reward on a first pass, reviewing it on a re-watch.
			 *
			 * It highlights the whole "应用空间" section, which starts below the creation prompt
			 * and runs past the bottom of the window, so there is no room beside or under it and
			 * the card opens above it. The section is part of the layout rather than a control a
			 * user may not have, so unlike the entries inside it this step is never skipped.
			 */
			anchor: HomeOnboardingAnchor.MicroAppsLibrary,
			placement: "top" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.microApp.steps.manage.title"),
			text: t("homeOnboarding.microApp.steps.manage.description"),
		},
	]
	/**
	 * The "了解如何使用 AI PPT" steps. Their anchors are on the slides-template page, which is a route
	 * of its own: the benefits card is the only entry, and it navigates there before asking for this
	 * run. Like the other standalone tours this one is a demonstration — no slide is really made,
	 * which is what the popover's note spells out.
	 *
	 * The first and the third step point at the same kind of thing: a template card carrying the
	 * "精选" badge. Which card that is is not known here — the page is an endless wall of templates
	 * that slides on its own, so the page centres one for each of those steps and publishes the
	 * anchor over it once it has stopped moving. Both steps land on the same card: a run walks a
	 * user through this page, and scrolling the wall between two steps that frame a card would be
	 * motion the user did not ask for. The card is data, though: a library with no featured template
	 * has none to show, which is why both steps may be stepped over instead of ending the run. The
	 * second step looks at the whole toolbar band — the search box, the "发现灵感" button and the
	 * category tabs are one way of finding a template — and the last one at the panel below it,
	 * where the template the run picked and the request editor sit together.
	 *
	 * Three of them can only be shown after the page has done something: the two card steps need a
	 * card centred before there is anything to frame, and the panel the last step highlights only
	 * exists once a template has been selected, which is the page's doing as well. Those three wait
	 * on the page rather than on a timer, and the two card steps are the optional ones because the
	 * library may hold no featured card. The toolbar band is simply on the page, so that step keeps
	 * the ordinary grace period every step gets.
	 */
	const aiPptSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.SlidesTemplateFeaturedCard,
			placement: "left" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.aiPpt.steps.featured.title"),
			text: t("homeOnboarding.aiPpt.steps.featured.description"),
			optional: true,
			awaitsPage: true,
		},
		{
			anchor: HomeOnboardingAnchor.SlidesTemplatesToolbar,
			placement: "top" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.aiPpt.steps.search.title"),
			text: t("homeOnboarding.aiPpt.steps.search.description"),
			action: t("homeOnboarding.aiPpt.steps.search.action"),
		},
		{
			anchor: HomeOnboardingAnchor.SlidesTemplateFeaturedCard,
			placement: "right" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.aiPpt.steps.pick.title"),
			text: t("homeOnboarding.aiPpt.steps.pick.description"),
			action: t("homeOnboarding.aiPpt.steps.pick.action"),
			optional: true,
			awaitsPage: true,
		},
		{
			/*
			 * The last step closes the run, so it takes the label its own state calls for instead
			 * of one of its own: claiming the reward on a first pass, reviewing it on a re-watch.
			 */
			anchor: HomeOnboardingAnchor.SlidesTemplatesPrompt,
			placement: "top" as Placement,
			analyticsStepIndex: 4,
			title: t("homeOnboarding.aiPpt.steps.prompt.title"),
			text: t("homeOnboarding.aiPpt.steps.prompt.description"),
			awaitsPage: true,
		},
	]
	/**
	 * The "了解 AI 录音完成流程" steps. Their anchors are on the recordings page, which is a route of
	 * its own: the benefits card is the only entry, and it navigates there before asking for this
	 * run.
	 *
	 * The first two steps frame the page's own controls: the two real creation entries of the list,
	 * recording and importing. The five that follow cannot, because entering a recording, ending one
	 * and the summary it leaves behind are states the page only reaches by really recording — a
	 * microphone permission, an upload and a summarisation task, all in the user's own account — and
	 * a guided course must not spend those on someone who only asked to be shown around. The page
	 * therefore stages a session for them instead, and these steps frame the parts of that stage.
	 *
	 * The last two steps share one anchor: both frame the header of the finished recording, and all
	 * that differs is which of its menus is open — the export list or the share list.
	 */
	const audioRecordingSteps: OnboardingStep[] = [
		{
			anchor: HomeOnboardingAnchor.AudioRecordingsStart,
			placement: "bottom" as Placement,
			analyticsStepIndex: 1,
			title: t("homeOnboarding.audioRecording.steps.start.title"),
			text: t("homeOnboarding.audioRecording.steps.start.description"),
			action: t("homeOnboarding.audioRecording.steps.start.action"),
		},
		{
			anchor: HomeOnboardingAnchor.AudioRecordingsImport,
			placement: "bottom" as Placement,
			analyticsStepIndex: 2,
			title: t("homeOnboarding.audioRecording.steps.import.title"),
			text: t("homeOnboarding.audioRecording.steps.import.description"),
			action: t("homeOnboarding.audioRecording.steps.import.action"),
		},
		{
			anchor: HomeOnboardingAnchor.AudioRecordingStatusBar,
			placement: "bottom" as Placement,
			analyticsStepIndex: 3,
			title: t("homeOnboarding.audioRecording.steps.status.title"),
			text: t("homeOnboarding.audioRecording.steps.status.description"),
			action: t("homeOnboarding.audioRecording.steps.status.action"),
		},
		{
			anchor: HomeOnboardingAnchor.AudioRecordingLiveTranscript,
			placement: "right" as Placement,
			analyticsStepIndex: 4,
			title: t("homeOnboarding.audioRecording.steps.transcript.title"),
			text: t("homeOnboarding.audioRecording.steps.transcript.description"),
			action: t("homeOnboarding.audioRecording.steps.transcript.action"),
		},
		{
			anchor: HomeOnboardingAnchor.AudioRecordingFinishSheet,
			placement: "top" as Placement,
			analyticsStepIndex: 5,
			title: t("homeOnboarding.audioRecording.steps.finish.title"),
			text: t("homeOnboarding.audioRecording.steps.finish.description"),
			action: t("homeOnboarding.audioRecording.steps.finish.action"),
		},
		{
			anchor: HomeOnboardingAnchor.AudioRecordingHeaderActions,
			placement: "bottom" as Placement,
			analyticsStepIndex: 6,
			title: t("homeOnboarding.audioRecording.steps.export.title"),
			text: t("homeOnboarding.audioRecording.steps.export.description"),
			action: t("homeOnboarding.audioRecording.steps.export.action"),
		},
		{
			// The last step closes the run, so it takes the label its own state calls for instead
			// of one of its own: claiming the reward on a first pass, reviewing it on a re-watch.
			anchor: HomeOnboardingAnchor.AudioRecordingHeaderActions,
			placement: "bottom" as Placement,
			analyticsStepIndex: 7,
			title: t("homeOnboarding.audioRecording.steps.share.title"),
			text: t("homeOnboarding.audioRecording.steps.share.description"),
		},
	]
	/**
	 * The three things the introduction promises, in the order the task walks them. Titles only:
	 * the one-line explanation each used to carry is gone — the three rows are read at a glance,
	 * and the subtitle above them already says what the run is for.
	 */
	const welcomeGoals = [
		{ id: "task", title: t("homeOnboarding.welcome.goals.task.title") },
		{ id: "send", title: t("homeOnboarding.welcome.goals.send.title") },
		{ id: "result", title: t("homeOnboarding.welcome.goals.result.title") },
	]
	/**
	 * Where this run begins. An explicit entry ("开始体验" / "回看") already named a task, while the
	 * automatic run on page load belongs to the AI-work task. A stored flow wins over both: it means
	 * an earlier run was interrupted and should resume at that step.
	 */
	const [entry] = useState(() => {
		const requestedTask = getHomeOnboardingEntryTask()
		const storedFlow = getHomeOnboardingFlow()
		/**
		 * The workbench tour is never automatic — the benefits card is its only entry — so a run
		 * nothing asked for is the AI-work task's.
		 */
		const task: HomeOnboardingTaskId = requestedTask ?? "first-ai-work"
		/**
		 * A first visit opens the AI-work task with its introduction dialog: nothing asked for it,
		 * there is no step to resume, the dialog has not been offered to this account before and the
		 * task itself is still open. Once answered, both tasks are entered on their own from the
		 * benefits card — which never shows the dialog — so the dialog cannot come back, and not
		 * merely for this page load: the answer is kept per account, so a reload finds it spent.
		 */
		const startsWithIntro =
			!requestedTask &&
			!storedFlow &&
			!isHomeOnboardingIntroSpent(userMagicId) &&
			!isHomeOnboardingCompleted(userMagicId, "first-ai-work")
		const analyticsRun = getHomeOnboardingAnalyticsRun()
		return {
			/** A benefits-card entry is a run of its own, never the automatic one. */
			requested: Boolean(requestedTask),
			task,
			// A re-watch stops at the end of its own steps and does not pay the reward twice. Only
			// the tours a finished task can re-open are ever one.
			isReplay:
				analyticsRun?.task === task
					? analyticsRun.isReplay
					: isReplayableHomeOnboardingTask(task) &&
						isHomeOnboardingCompleted(userMagicId, task),
			startsWithIntro,
			flow: storedFlow ?? (requestedTask === "first-ai-work" ? "featured-case" : null),
		}
	})
	const initialFlow = entry.flow
	const isReplayRun = entry.isReplay
	/**
	 * Whether this run is the tour of a delivered file — the one a click on a task's result opens.
	 *
	 * Read from the flow the run was entered with rather than from the one it is on, because the
	 * flow is this run's own for its whole life and the two must not be able to disagree. It is not
	 * a task's flow: nothing about it finishes a task, so it reports nothing on the way out — it
	 * neither claims a reward nor records an abort against the tasks that do. What it marks is a
	 * moment in the account's first look at its own results, and that answer was already spent by
	 * the entry that opened it.
	 */
	const isDeliverableRun = initialFlow === "project-result"
	/**
	 * Whether this run walks the MagiClaw steps. Its anchors live on another route, its popover is a
	 * demo with a note, and it leaves the home shell (the sidebar) alone.
	 */
	const isClawRun = entry.task === "super-lobster"
	/** Whether this run walks the crew market steps. It is a route of its own, like MagiClaw. */
	const isEmployeeRun = entry.task === "hire-employee"
	/** Whether this run walks the skill library steps — the one tour that spans two routes. */
	const isSkillRun = entry.task === "manage-skill"
	/** Whether this run walks the app-space steps. It is a route of its own, like MagiClaw. */
	const isMicroAppRun = entry.task === "create-micro-app"
	/**
	 * Whether this run walks the slides-template steps. Another route of its own — and the one tour
	 * whose page has to prepare what a step points at, because the card it highlights is picked from
	 * an endless wall of them at run time.
	 */
	const isAiPptRun = entry.task === "create-ai-ppt"
	/**
	 * Whether this run walks the recordings steps. Another route of its own — and the one tour whose
	 * second half points at a session the page stages, because the states it walks through only
	 * exist once something has really been recorded.
	 */
	const isAudioRecordingRun = entry.task === "audio-recording"
	/**
	 * Whether this run is served by a page that is not the home shell. The steps are highlighted
	 * elsewhere, so the sidebar is left exactly as the user left it — nothing on those pages is
	 * really produced, and a guide that rearranged the shell for one would be rearranging it for a
	 * demonstration.
	 */
	const isStandaloneRun =
		isClawRun ||
		isEmployeeRun ||
		isSkillRun ||
		isMicroAppRun ||
		isAiPptRun ||
		isAudioRecordingRun
	/**
	 * The highlighted steps of this run. A task owns one set: the home steps for the two home tasks,
	 * the MagiClaw steps for `super-lobster`, the crew market steps for `hire-employee`, the skill
	 * library and "My Skills" steps for `manage-skill`, the composer and library steps for
	 * `create-micro-app`, the template-wall steps for `create-ai-ppt`, the recordings steps for
	 * `audio-recording`. Everything below — progress, navigation, the finish label — reads the steps
	 * of the run instead of a fixed list.
	 */
	const stepsByTask: Record<HomeOnboardingTaskId, OnboardingStep[]> = {
		workbench: homeSteps,
		"first-ai-work": homeSteps,
		"super-lobster": clawSteps,
		"hire-employee": employeeSteps,
		"manage-skill": skillSteps,
		"create-micro-app": microAppSteps,
		"create-ai-ppt": aiPptSteps,
		"audio-recording": audioRecordingSteps,
	}
	const primarySteps = stepsByTask[entry.task] ?? homeSteps
	/**
	 * A re-watch and a card entry both go straight to the task's own first step: the introduction
	 * dialog only ever opens the automatic run. The position comes from the manager rather than
	 * starting at zero, because a run that spans routes is re-mounted on each of them and has to
	 * come back on the step it left.
	 */
	const [started, setStarted] = useState(() => !!initialFlow || entry.requested)
	const [stepIndex, setStepIndex] = useState(() => getHomeOnboardingStepIndex())
	const [rect, setRect] = useState<DOMRect | null>(null)
	/**
	 * The composer's cut-out for the prompt-ready step — the prompt's own box grown by the
	 * composer's padding, so the prompt is read with the margin it was drawn with, and the frame
	 * hugs the text instead of the card it sits in. See `composerHole`. It is the one box the step's
	 * three readers share: the mask cuts it, the cover leaves it open and the card is placed clear
	 * of it.
	 */
	const [editorRect, setEditorRect] = useState<DOMRect | null>(null)
	const [dismissed, setDismissed] = useState(false)
	const [waitingForTarget, setWaitingForTarget] = useState(false)
	/**
	 * Whether the anchor of the step on screen has stopped moving. False while it is being followed
	 * in — see `followAnchorUntilStill` — which is also when the highlight must sit exactly where
	 * the anchor is instead of easing its way there: the two animations would otherwise be racing,
	 * and the one the user is meant to read the step off would be the loser.
	 */
	const [anchorSettled, setAnchorSettled] = useState(true)
	/**
	 * The step the hosting page has finished preparing. Read from the manager as well as followed,
	 * because the page may answer before this instance is listening — the two mount in whichever
	 * order the entry's navigation and the tour's own mount happen to take.
	 */
	const [preparedStepIndex, setPreparedStepIndex] = useState(() =>
		getHomeOnboardingPreparedStepIndex(),
	)
	const [flow, setFlow] = useState<HomeOnboardingFlow | null>(initialFlow)
	const [projectStepIndex, setProjectStepIndex] = useState(0)
	const [sidebarReady, setSidebarReady] = useState(true)
	const [projectEntered, setProjectEntered] = useState(false)
	/**
	 * The height the step card really renders at. The popover is placed against it — which side it
	 * opens on, and how far it can be pushed before it would sit on its own anchor — so a guess
	 * that is off by a line of copy is exactly what makes a card cover the control it highlights.
	 */
	const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_FALLBACK)
	const cardRef = useRef<HTMLElement | null>(null)
	const [exposureNode, setExposureNode] = useState<HTMLElement | null>(null)
	const setStepCardRef = useCallback((node: HTMLElement | null) => {
		cardRef.current = node
		setExposureNode(node)
	}, [])
	const reportStepClick = useCallback(
		(
			stepNumber: number | undefined,
			action:
				| "next"
				| "prev"
				| "exit"
				| "complete"
				| "select_case"
				| "send"
				| "confirm"
				| "dismiss",
			caseId?: string,
		) => {
			const run = getHomeOnboardingAnalyticsRun()
			if (!run || run.task !== entry.task || stepNumber === undefined) return
			analyticsService.report("onboarding_guide_step_click", {
				taskId: run.task,
				stepIndex: stepNumber,
				isReplay: run.isReplay,
				action,
				caseId,
			})
		},
		[entry.task],
	)

	/**
	 * Reading the card's height back before the frame is painted — a layout effect keeps this ahead
	 * of the first paint, so the correction never shows up as a jump — and then following it, so the
	 * card is always placed against its size at the time: the observer catches a reflow (a longer
	 * step, a font arriving, a resize), and the list below only has to cover which card is mounted.
	 * The comparison inside the setter stops a measurement equal to the last one from looping.
	 */
	useLayoutEffect(() => {
		const element = cardRef.current
		if (!element) return
		const measure = () => {
			const { height } = element.getBoundingClientRect()
			if (height <= 0) return
			setCardHeight((previous) => (Math.abs(previous - height) > 0.5 ? height : previous))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => observer.disconnect()
	}, [flow, projectStepIndex, stepIndex])

	/**
	 * Which task this run reports its outcome to. It is the task the run was opened for, not
	 * something to be read off the current step: the introduction dialog, the case picker and the
	 * in-project tour are all the AI-work task, and a workbench run is only ever the four home steps.
	 */
	const currentTask: HomeOnboardingTaskId = entry.task

	/**
	 * Which page the highlighted step lives on. A step that does not name one belongs to the page
	 * hosting the run — every task but the skill tour stays on a single page. While the run is on a
	 * step that belongs elsewhere it renders nothing here and asks the router for that page instead;
	 * the tour re-mounts there on the same step, because the position lives in the manager.
	 */
	const stepPage = flow ? page : (primarySteps[stepIndex]?.page ?? page)
	const stepOnThisPage = stepPage === page
	/**
	 * The steps of the guided flow this run is in, and the one it is on. A stored flow picks the
	 * list: the in-project tour and the tour of a delivered file are walked the same way — by
	 * position, under the one index — and a run is only ever inside one of them at a time. The list
	 * a run is not in is left alone rather than emptied, so `flow` going back to null cannot strand
	 * the run on a step that no longer exists.
	 */
	const activeGuideSteps = flow === "project-result" ? deliverableSteps : guidedProjectSteps
	const activeProjectStep = activeGuideSteps[projectStepIndex]
	/**
	 * Whether the highlighted step may be stepped over.
	 *
	 * A task's own steps say so one by one, and the ones that carry it are the entries the user's
	 * own screen can legitimately not have: the create-skill entry, which an account without the
	 * permission never renders, and the AI-PPT card steps, which need the account's library to hold
	 * a featured template. No step of a flow says so any more — see `GuidedFlowStep.optional` for
	 * why the one that used to has been given an anchor that is always there instead.
	 */
	const stepOptional = flow
		? activeProjectStep?.optional === true
		: primarySteps[stepIndex]?.optional === true
	/**
	 * Whether this step highlights something the hosting page has to build. Such a step is not
	 * judged on its anchor until the page says it is done — a page that is still fetching its
	 * library looks exactly like one that has nothing to frame, and treating the two alike is what
	 * makes a step flick past before it can be read.
	 */
	const stepAwaitsPage = !flow && primarySteps[stepIndex]?.awaitsPage === true
	const stepPrepared = !stepAwaitsPage || preparedStepIndex === stepIndex

	useEffect(() => {
		const handlePrepared = (event: Event) => {
			const { detail } = event as CustomEvent<number>
			if (typeof detail === "number") setPreparedStepIndex(detail)
		}
		setPreparedStepIndex(getHomeOnboardingPreparedStepIndex())
		window.addEventListener(HOME_ONBOARDING_STEP_READY_EVENT, handlePrepared)
		return () => window.removeEventListener(HOME_ONBOARDING_STEP_READY_EVENT, handlePrepared)
	}, [])

	useEffect(() => {
		if (!started || flow || stepOnThisPage) return
		const routeName = ONBOARDING_PAGE_ROUTE_NAME[stepPage]
		if (routeName) navigate({ name: routeName })
	}, [flow, navigate, started, stepOnThisPage, stepPage])

	/**
	 * Reporting a finished run to the backend, which is the only side that decides whether the task
	 * is done and whether the points were paid.
	 *
	 * Four things make this more than a single call:
	 *
	 * - **A grant is announced.** The run's overlay is the last thing on screen and it closes as the
	 *   call goes out, so without a word from here a paid task looks exactly like a failed one: the
	 *   card's counter moves and nothing else happens. The figure is the backend's own `points`
	 *   rather than the task's advertised price — those are the same today, and the one the account
	 *   actually received is the one worth saying out loud.
	 * - **A re-watch pays nothing.** The task was finished on an earlier run, and the design's own
	 *   toast says so; calling completion again would be a pointless round trip at best.
	 * - **The AI-work task is never completed by this client.** The backend finishes it off a "the
	 *   user did their first AI work" system event and answers `9303` to anyone who asks anyway, so
	 *   the run only re-reads the list and lets the recorded verdict show.
	 * - **A claim that fails leaves the task unfinished.** The row keeps its "开始体验", which is what
	 *   lets the user walk the flow again and have the grant retried; the manager only records the
	 *   task as done once the backend says the points went through.
	 */
	const reportCompletion = useCallback(
		async (task: HomeOnboardingTaskId, replay: boolean) => {
			if (!userMagicId || replay) return
			if (!canManuallyCompleteHomeOnboardingTask(task)) {
				void refreshHomeOnboardingRewardList(userMagicId)
				return
			}
			const result = await claimHomeOnboardingReward(userMagicId, task)
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
		[t, userMagicId],
	)

	/**
	 * Leaving the tour. `completed` is reserved for walking the current task's flow through to its
	 * last step; every other exit — the close button, any "skip", or a step whose anchor never
	 * showed up — counts as leaving mid-way, so the benefits card offers "开始体验" again instead of
	 * claiming the task is done.
	 */
	const exitTour = useCallback(
		(outcome: "completed" | "aborted") => {
			endHomeOnboardingAnalyticsRun()
			// Nothing to record about the introduction here: it was spent when its dialog was put on
			// screen, and a run ending cannot un-spend it — every task is entered from the benefits
			// card from that point on, whichever way this run goes.
			//
			// The tour is only dismissed locally. What a page load derives the next run from is the
			// outcome written below, not the state of this instance.
			setHomeOnboardingSidebarTopMode(false)
			setHomeOnboardingFlow(null)
			// The next run of any task starts from its own first step, not from wherever this one
			// happened to stop.
			resetHomeOnboardingStepIndex()
			clearHomeOnboardingEntryTask()
			/*
			 * The tour of a delivered file belongs to no task. It borrows the home page's anchors
			 * because that is where a project's result is shown, and nothing about looking at a
			 * result finishes anything — so it must not claim a reward for the task whose page it
			 * shares, nor record an abort against it when it is left early.
			 */
			if (!isDeliverableRun) {
				if (outcome === "completed") void reportCompletion(currentTask, isReplayRun)
				else markHomeOnboardingAborted(userMagicId, currentTask)
			} else clearDeliverableAnchor()
			setDismissed(true)
			onComplete?.()
		},
		[currentTask, isDeliverableRun, isReplayRun, onComplete, reportCompletion, userMagicId],
	)

	const complete = useCallback(() => exitTour("completed"), [exitTour])
	const abort = useCallback(() => exitTour("aborted"), [exitTour])

	/**
	 * Moving along the highlighted steps. The position is written to the manager as well as to this
	 * instance: a run that spans pages is re-mounted on the next one, and that mount reads it back.
	 */
	const goToStep = useCallback((index: number) => {
		setHomeOnboardingStepIndex(index)
		setStepIndex(index)
	}, [])

	/**
	 * Closing a re-watch: its steps end there, and the toast spells out that the task was already
	 * finished so its reward is not paid twice. A little longer than the default, because the message
	 * is a full sentence.
	 */
	const finishReplay = useCallback(() => {
		exitTour("completed")
		magicToast.info({ content: t("homeOnboarding.actions.replayDone"), duration: 3000 })
	}, [exitTour, t])

	/**
	 * Moving along the steps of the guided flow the run is in. Position and flow are written to the
	 * manager as well as to this instance, and together, because a flow is what a mount is keyed on
	 * and the flow a step belongs to can change part-way through: the in-project tour opens on the
	 * files panel and continues as the orientation steps.
	 */
	const goToProjectStep = useCallback(
		(index: number) => {
			setProjectStepIndex(index)
			const nextFlow = activeGuideSteps[index].flow
			setFlow(nextFlow)
			setHomeOnboardingFlow(nextFlow)
		},
		[activeGuideSteps],
	)

	/**
	 * Walking past an optional step whose anchor is not on the page — the create-skill entry, which
	 * an account without the permission never renders, or an AI-PPT card step whose library holds
	 * no featured template. The run carries on to the next step, and stepping over the last one
	 * closes the run exactly as confirming it would have.
	 *
	 * A run in a guided flow walks that flow's steps by position, so the two cases share nothing
	 * but the entry: the position and the list both belong to the flow rather than to a task.
	 */
	const skipStep = useCallback(() => {
		if (flow) {
			if (projectStepIndex < activeGuideSteps.length - 1)
				goToProjectStep(projectStepIndex + 1)
			else complete()
			return
		}
		if (stepIndex < primarySteps.length - 1) goToStep(stepIndex + 1)
		else if (isReplayRun) finishReplay()
		else complete()
	}, [
		activeGuideSteps.length,
		complete,
		finishReplay,
		flow,
		goToProjectStep,
		goToStep,
		isReplayRun,
		primarySteps.length,
		projectStepIndex,
		stepIndex,
	])

	/**
	 * Confirming the introduction walks straight into the featured-case picker: the dialog opens the
	 * AI-work task, and the workbench tour is not part of this run — the benefits card is its only
	 * entry.
	 */
	const startFirstAiWork = useCallback(() => {
		analyticsService.report("onboarding_guide_popup_click", {
			action: "start_experience",
			participantType,
		})
		beginHomeOnboardingAnalyticsRun("first-ai-work", false)
		// The dialog has been on screen, so the introduction is already spent; taking it up is what
		// this button does, not what ends it.
		// The picker starts from an empty composer, so the prompt of the chosen case is the only
		// thing in it.
		pubsub.publish(PubSubEvents.Set_Input_Message, {
			type: "doc",
			content: [{ type: "paragraph" }],
		})
		setHomeOnboardingFlow("featured-case")
		setFlow("featured-case")
		setStarted(true)
	}, [participantType])

	const selectFeaturedCase = useCallback(
		(caseId: number, prompt: string) => {
			reportStepClick(1, "select_case", String(caseId))
			pubsub.publish(PubSubEvents.Set_Input_Message, prompt)
			setHomeOnboardingFlow("prompt-ready")
			setFlow("prompt-ready")
		},
		[reportStepClick],
	)

	useLayoutEffect(() => {
		if (flow !== "prompt-ready" && flow !== "task-processing") return
		const routeObserver = window.setInterval(() => {
			if (
				flow === "prompt-ready" &&
				document.querySelector('[data-guide-anchor="message-list-container"]')
			) {
				setProjectEntered(true)
				setFlow("task-processing")
				setHomeOnboardingFlow("task-processing")
				return
			}
			if (
				flow === "task-processing" &&
				document.querySelector('[data-guide-anchor="message-list-container"]')
			) {
				setProjectEntered(true)
				window.clearInterval(routeObserver)
			}
		}, 250)
		return () => window.clearInterval(routeObserver)
	}, [flow])

	useEffect(() => {
		if (flow !== "prompt-ready") return
		const handleSendClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null
			if (!target?.closest('[data-guide-anchor="message-editor-send-button"]')) return
			reportStepClick(2, "send")
			setFlow("task-processing")
			setProjectEntered(false)
			setHomeOnboardingFlow("task-processing")
		}
		document.addEventListener("click", handleSendClick, true)
		return () => document.removeEventListener("click", handleSendClick, true)
	}, [flow, reportStepClick])

	useEffect(() => {
		/**
		 * Only the home steps make use of the shell: the first two point at the sidebar and the
		 * workspace list, so it has to be expanded and scrolled to the top for them. A tour that
		 * runs on a page of its own leaves the shell exactly as the user left it.
		 */
		const shouldExpandSidebar = !isStandaloneRun && started && !flow && stepIndex <= 1
		setHomeOnboardingSidebarTopMode(shouldExpandSidebar)
		if (!shouldExpandSidebar) {
			setSidebarReady(true)
			return
		}

		const scrollContainer = document.querySelector<HTMLElement>(
			'[data-testid="sidebar-content-root"]',
		)
		const needsExpandTransition = sidebarStore.collapsed
		const needsScrollReset = (scrollContainer?.scrollTop ?? 0) > 0

		if (needsExpandTransition) sidebarStore.setCollapsed(false)
		if (!needsExpandTransition && !needsScrollReset) {
			setSidebarReady(true)
			return
		}

		setSidebarReady(false)

		// Wait for the sidebar width transition and any remount before measuring.
		const frame = window.setTimeout(
			() => {
				document
					.querySelector<HTMLElement>('[data-testid="sidebar-content-root"]')
					?.scrollTo({ top: 0, behavior: "auto" })
				window.requestAnimationFrame(() => setSidebarReady(true))
			},
			needsExpandTransition ? 360 : 0,
		)
		return () => window.clearTimeout(frame)
	}, [flow, isStandaloneRun, started, stepIndex])

	const isProjectRoute = Boolean(
		document.querySelector('[data-guide-anchor="message-list-container"]'),
	)
	const activeAnchor =
		flow === "featured-case"
			? "message-editor-content"
			: flow === "prompt-ready"
				? isProjectRoute
					? "message-list-container"
					: "message-editor-send-button"
				: flow && flow !== "featured-case"
					? activeProjectStep?.anchor
					: primarySteps[stepIndex].anchor
	/**
	 * The companions this step is framed together with, as one comma-joined list — see
	 * `OnboardingStep.extraAnchors`.
	 *
	 * Joined into a string rather than passed through as the step's own array, because `updateRect`
	 * is a dependency of the effect that waits for the anchor and the step lists are rebuilt on
	 * every render: an array here would give that callback a new identity on each pass and restart
	 * the wait for good. A string compares by value, so the callback changes only with the step.
	 * The two flows are named to mirror `activeAnchor` above — neither frames companions.
	 */
	const activeExtraAnchors =
		flow === "featured-case" || flow === "prompt-ready"
			? ""
			: ((flow
					? activeProjectStep?.extraAnchors
					: primarySteps[stepIndex]?.extraAnchors
				)?.join(",") ?? "")
	const updateRect = useCallback(() => {
		if (!activeAnchor) return
		const element = document.querySelector<HTMLElement>(`[data-guide-anchor="${activeAnchor}"]`)
		if (element) {
			setRect(frameWithCompanions(element, activeExtraAnchors))
			setWaitingForTarget(false)
		}
		if (flow === "prompt-ready") {
			const editorElement = document.querySelector<HTMLElement>(
				'[data-guide-anchor="message-editor-content"]',
			)
			if (editorElement) setEditorRect(composerHole(editorElement))
		}
	}, [activeAnchor, activeExtraAnchors, flow])

	useLayoutEffect(() => {
		// A step that belongs to another page has no anchor here to wait for — asking for it would
		// only time out and mark the run as failed. The navigation effect is already on its way.
		if (!started || !sidebarReady || flow === "task-processing" || !stepOnThisPage) return
		setRect(null)
		setEditorRect(null)
		setWaitingForTarget(true)
		// A step change leaves no follow behind, and a follow that was cut short by one must not
		// leave the highlight without its easing — see `anchorSettled` below.
		setAnchorSettled(true)
		const selector = `[data-guide-anchor="${activeAnchor}"]`
		let timeout: number | null = null
		let stopFollowing: (() => void) | null = null
		/*
		 * Observe only the short transition into a step. This avoids a long-lived animation-frame
		 * poll that could surface the guide during user actions.
		 */
		const observer = new MutationObserver(() => {
			resolveTarget()
		})
		/**
		 * Finding the anchor ends the wait — the observer that caught it is taken off along with the
		 * deadline the step was armed with. The observer reports what it saw and nothing else, so
		 * the deadline used to stay armed after the step had already been framed: it came due a
		 * couple of seconds later and walked the run past a step the user was still reading. A step
		 * whose anchor is there from the first frame returns above and is never armed at all, which
		 * is why only the steps that arrive late — the ones the page has to build — were skipped.
		 *
		 * Its box is then followed until it holds still. An anchor that exists is not the same as an
		 * anchor in place: the micro-app page animates its composer in over the second after it
		 * mounts, so the one measurement taken here would leave the mask where the card started. See
		 * `followAnchorUntilStill`.
		 */
		const resolveTarget = () => {
			if (!document.querySelector(selector)) return false
			observer.disconnect()
			if (timeout != null) {
				window.clearTimeout(timeout)
				timeout = null
			}
			updateRect()
			setAnchorSettled(false)
			stopFollowing = followAnchorUntilStill(
				() =>
					document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null,
				updateRect,
				() => setAnchorSettled(true),
			)
			return true
		}
		if (resolveTarget()) return () => stopFollowing?.()

		observer.observe(document.body, { childList: true, subtree: true })
		const giveUp = () => {
			observer.disconnect()
			// An optional step whose anchor stays away is walked past: the entry it points at is
			// one the user may simply not have. Any other missing anchor means the tour could not
			// be shown, which is a failed run, not a finished task.
			if (stepOptional) skipStep()
			else abort()
		}
		/*
		 * A step the page has to build gets no deadline of its own: centring a card is the page's
		 * work and this effect cannot tell it from a library that will never hold one, so the page's
		 * answer is what starts the wait. This effect runs again the moment that answer arrives —
		 * `preparedStepIndex` is one of its dependencies — and takes the branch below, which is why
		 * nothing is timed out here beyond a page that never answers at all.
		 */
		timeout = window.setTimeout(
			giveUp,
			stepPrepared || !stepAwaitsPage ? ANCHOR_APPEAR_TIMEOUT_MS : PAGE_PREPARE_TIMEOUT_MS,
		)
		return () => {
			observer.disconnect()
			if (timeout != null) window.clearTimeout(timeout)
			stopFollowing?.()
		}
	}, [
		abort,
		activeAnchor,
		flow,
		preparedStepIndex,
		sidebarReady,
		skipStep,
		started,
		stepAwaitsPage,
		stepIndex,
		stepOnThisPage,
		stepOptional,
		stepPrepared,
		updateRect,
	])

	useEffect(() => {
		if (!started) return
		const handleViewportChange = () => updateRect()
		window.addEventListener("resize", handleViewportChange)
		window.addEventListener("scroll", handleViewportChange, true)
		return () => {
			window.removeEventListener("resize", handleViewportChange)
			window.removeEventListener("scroll", handleViewportChange, true)
		}
	}, [started, updateRect])

	/**
	 * The "prompt-ready" step has to keep measuring, because its page moves under the user's hands.
	 *
	 * Every other step frames a page that holds still, and a resize or a scroll is the whole of what
	 * can change its anchor — both are already listened for above. This one differs: the prefilled
	 * prompt is an ordinary editable document, so the user may type into it before sending, and
	 * every keystroke moves what the step frames — the prompt as it wraps, and the composer once it
	 * outgrows the room kept for it. That lifts the toolbar and with it the send button the step is
	 * asking for, and a box measured before the typing is a mask that has left its hole behind: the
	 * ring no longer frames the composer, and the cover dims the very button the copy tells the user
	 * to press — which is the whole of what "the button cannot be clicked" is.
	 *
	 * Following the anchor frame by frame does not cover this either: that ends once the page first
	 * holds still, and this change comes later, from the user's own typing. So the composer is
	 * watched rather than measured — for the size it takes, and for the document inside it, which
	 * are two different questions and only the second one is about the prompt.
	 */
	useEffect(() => {
		if (flow !== "prompt-ready" || !started || !stepOnThisPage) return
		const byAnchor = (name: string) =>
			document.querySelector<HTMLElement>(`[data-guide-anchor="${name}"]`)
		const editor = byAnchor("message-editor-content")
		if (!editor) return
		const teardown: Array<() => void> = []

		/*
		 * The size watcher. The editor is what actually resizes, but both it and the container are
		 * observed: a composer that grows past its own limit has a container that grows while the
		 * editor scrolls inside it, and watching the pair costs one observer. `updateRect` re-reads
		 * the send button as well, so the second cut-out follows the first without being watched
		 * itself. Absent in SSR and in older browsers; the step then keeps the behaviour it had.
		 */
		if (typeof ResizeObserver !== "undefined") {
			const watched = ["message-editor-content", "message-editor-container"]
				.map(byAnchor)
				.filter((element): element is HTMLElement => element !== null)
			const observer = new ResizeObserver(() => updateRect())
			watched.forEach((element) => observer.observe(element))
			teardown.push(() => observer.disconnect())
		}

		/*
		 * The content watcher, which is the one that does the work here.
		 *
		 * A prompt that is typed into wraps onto more lines, and those lines are the only thing on
		 * the page that moves. The editor's viewport is given the room of the lines a prompt may
		 * still grow into, so it and the card around it hold one height whether the prompt is one
		 * line long or four: both boxes are exactly the size they were before the wrap, and a step
		 * that only listens for size never looks again. It keeps the cut-out it took on arrival —
		 * the height of one line — while the user watches their own text leave it, which is the
		 * whole of what "the highlight does not follow" is. No listener for size can mend it,
		 * because the size is the one thing that did not change.
		 *
		 * What does change is the document. A keystroke is a text node with a new value and the
		 * wrap that follows is that same node laid out differently, so the mutation arrives in both
		 * cases — and it arrives before the layout it causes, which is why the measurement is asked
		 * for rather than read here: taking the box is itself what forces the reflow, so the box
		 * taken inside this callback is the new one. Only the editor's own subtree is watched, and
		 * that is also what keeps the watcher from feeding itself: the overlay a measurement
		 * re-renders is not inside it, so no render can return as a mutation.
		 */
		if (typeof MutationObserver !== "undefined") {
			const observer = new MutationObserver(() => updateRect())
			observer.observe(editor, { characterData: true, childList: true, subtree: true })
			teardown.push(() => observer.disconnect())
		}

		return () => teardown.forEach((stop) => stop())
	}, [flow, started, stepOnThisPage, updateRect])

	/**
	 * A mount nothing asked for has nothing to show. The automatic run exists to offer the
	 * introduction dialog and nothing else, so once that has been answered the tasks wait for the
	 * benefits card: without this guard a late remount — a route change back to the home page —
	 * would start a task on the user, or bring the declined dialog back.
	 */
	const unsolicited = !entry.requested && !entry.startsWithIntro && !initialFlow
	/**
	 * A run belongs to the page that carries its anchors. A stored in-flight step — the AI-work flow,
	 * say — is not a reason for another route's layout to replay it, where its own anchors do not
	 * exist and its spans would be measured against the wrong page.
	 */
	const ownedByThisPage = isHomeOnboardingTaskOnPage(entry.task, page)
	/**
	 * Whether this run has the screen. Everything below this line paints over the whole window — the
	 * introduction dialog, the overlay that holds the user while a step's anchor is prepared, the
	 * step card and its mask — so the guard that decides between "a run" and "nothing" is exactly
	 * the answer to give the surfaces that stand aside for one. Naming it is what keeps the two from
	 * drifting: the flag below is reported from the same verdict this component returns on.
	 */
	const runActive = Boolean(userMagicId) && !dismissed && !unsolicited && ownedByThisPage
	/**
	 * The introduction dialog's own condition: a first visit that has not started walking yet. It is
	 * named rather than inlined so that the thing which spends the one-shot flag and the thing which
	 * puts the dialog up are the same test — the flag has to be written by exactly what the user was
	 * shown, no more and no less.
	 */
	const showingIntro = runActive && entry.startsWithIntro && !started && !flow
	// Special flows keep their existing 1/2/3 contract. Configured cards carry their own number,
	// shared by exposure and generic clicks, so array position never determines event identity.
	const analyticsStepIndex = flow
		? (FIXED_FLOW_STEP_INDEX[flow] ?? activeProjectStep?.analyticsStepIndex)
		: primarySteps[stepIndex]?.analyticsStepIndex
	const exposureNodeVisible = useElementVisibility(exposureNode, {
		enabled: runActive,
		minimumIntersectionRatio: ONBOARDING_EXPOSURE_RATIO,
		requireDocumentVisible: true,
		threshold: ONBOARDING_EXPOSURE_THRESHOLDS,
	})

	useEffect(() => {
		if (!runActive || !exposureNodeVisible) return
		const run = getHomeOnboardingAnalyticsRun()
		// The welcome dialog is not a task step and precedes creation of its run.
		if (!showingIntro && (!run || run.task !== entry.task)) return
		if (showingIntro) {
			if (consumeHomeOnboardingSurfaceExposure("welcome"))
				analyticsService.report("onboarding_guide_popup_exposure", { participantType })
			return
		}
		if (
			!run ||
			analyticsStepIndex === undefined ||
			getHomeOnboardingAnalyticsRun()?.id !== run.id
		)
			return
		if (!consumeHomeOnboardingStepExposure(run.id, String(analyticsStepIndex))) return
		analyticsService.report("onboarding_guide_step_exposure", {
			taskId: run.task,
			stepIndex: analyticsStepIndex,
			isReplay: run.isReplay,
		})
	}, [
		runActive,
		showingIntro,
		exposureNodeVisible,
		entry.task,
		analyticsStepIndex,
		participantType,
	])

	/**
	 * Telling the benefits entry card that a run is up, and telling it again when the screen is
	 * given back. A layout effect rather than an ordinary one: the card has to be gone in the frame
	 * the overlay appears, or it spends that frame sitting behind it.
	 *
	 * The cleanup is not only for a changed verdict — it is what covers a run that is left by
	 * unmounting rather than by closing. A run whose steps span pages is re-mounted on each of them,
	 * and between the two there is a moment with no tour at all; nothing is covering the card then,
	 * so the card is right to be back.
	 */
	useLayoutEffect(() => {
		setHomeOnboardingRunActive(runActive)
		return () => setHomeOnboardingRunActive(false)
	}, [runActive])

	/**
	 * Telling the page which region the run is framing, so that a step pointing at a region the page
	 * is allowed to have closed can be framed at all.
	 *
	 * The project files panel is collapsible and its collapsed state is the user's own — it is
	 * remembered across loads — while both steps that point at it frame the panel itself: the
	 * in-project tour's first and the second of the tour a delivered file opens. Collapsed, the
	 * anchor they measure is a zero-width box at the left edge, so the highlight lands on a sliver
	 * and the copy beside it describes a file tree that is not on screen. The panel is the page's to
	 * open — see `HOME_ONBOARDING_ANCHOR_EVENT` — so the region is published here the moment the step
	 * arrives. A layout effect, so the page is told inside the commit the step's own measurement runs
	 * in: it opens the panel there, and the ring that goes on to follow the anchor is the one the
	 * panel opens into rather than the sliver either of them started from.
	 *
	 * `null` for every state that frames nothing: the introduction dialog, the processing dialog, a
	 * step that belongs to another page, and the run once it is dismissed. A page mounting into any
	 * of those must not find a region and open a panel for a step nobody is on.
	 *
	 * The withdrawal on unmount is its own effect, with no dependencies: a run whose steps span pages
	 * is left by unmounting rather than by closing, and the page has to be told — but a cleanup on
	 * the effect below would also run between two regions of one run, where it would announce that
	 * nothing is framed for a frame the run is framing the next region in.
	 */
	const framedAnchor =
		runActive && started && stepOnThisPage && flow !== "task-processing"
			? (activeAnchor ?? null)
			: null
	useLayoutEffect(() => {
		setHomeOnboardingAnchor(framedAnchor)
	}, [framedAnchor])
	useLayoutEffect(
		() => () => {
			setHomeOnboardingAnchor(null)
		},
		[],
	)

	/**
	 * The dialog is offered once per account, and it is spent *here* — the moment it is on screen —
	 * rather than in the exits it can be left through. Being shown it is the thing that must not
	 * happen twice: someone who reloads with it still up, or who walks to another route and comes
	 * back, has been shown it just as much as someone who clicked "暂不体验", and a write on the way
	 * out misses exactly those. A layout effect, so the answer is on disk before the frame is
	 * painted and no click can outrace it.
	 */
	useLayoutEffect(() => {
		if (!showingIntro) return
		spendHomeOnboardingIntro(userMagicId)
	}, [showingIntro, userMagicId])

	if (!runActive) return null

	// The introduction dialog opens the AI-work task of a first visit and nothing else: every other
	// kind of run either has a step to show already (`started`) or, being unsolicited, returned above.
	if (showingIntro) {
		return createPortal(
			<div
				className="fixed inset-0 z-[1200] text-foreground"
				role="dialog"
				aria-modal="true"
				aria-label={t("homeOnboarding.welcome.title")}
			>
				<div className="absolute inset-0 bg-[rgba(52,52,52,0.62)]" />
				<section
					ref={setExposureNode}
					className="fixed left-1/2 top-1/2 max-h-[calc(100vh-34px)] w-[min(540px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[14px] border border-border bg-background px-8 pb-[26px] pt-[30px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.08),0_16px_42px_rgba(0,0,0,0.14)] max-[760px]:w-[calc(100vw-24px)] max-[760px]:px-5 max-[760px]:pb-5 max-[760px]:pt-6"
				>
					<button
						className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:border hover:border-border hover:bg-muted hover:text-foreground"
						type="button"
						onClick={() => {
							analyticsService.report("onboarding_guide_popup_click", {
								action: "close",
								participantType,
							})
							abort()
						}}
						aria-label={t("homeOnboarding.welcome.close")}
					>
						<X className="size-7" strokeWidth={1.8} />
					</button>
					<h2 className="mb-2 max-w-[410px] pr-12 text-[28px] font-bold leading-tight tracking-[-0.03em] max-[760px]:text-2xl">
						{t("homeOnboarding.welcome.title")}
					</h2>
					<p className="mb-[18px] max-w-[440px] text-[13px] leading-[1.65] text-muted-foreground">
						{t("homeOnboarding.welcome.subtitle")}
					</p>
					<ol className="m-0 grid list-none gap-0 overflow-hidden rounded-[14px] bg-[#f7f7f7] px-[18px] py-4">
						{welcomeGoals.map((goal, index) => (
							<li
								className="flex min-h-[60px] items-center gap-[26px] border-b border-[#e9e9e9] py-3 last:border-b-0"
								key={goal.id}
							>
								<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#111] text-xs font-extrabold text-white">
									{String(index + 1).padStart(2, "0")}
								</span>
								<strong className="text-[15px] font-bold leading-[1.35]">
									{goal.title}
								</strong>
							</li>
						))}
					</ol>
					<div className="mt-[17px] flex w-full flex-col items-stretch gap-2">
						<button
							className="order-first h-11 min-h-11 w-full rounded-[10px] border border-foreground bg-foreground px-4 text-[13px] font-semibold text-background hover:bg-[#2b2b2b]"
							type="button"
							onClick={startFirstAiWork}
						>
							{t("homeOnboarding.welcome.start")}
						</button>
						<button
							className="min-h-11 self-center px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
							type="button"
							onClick={() => {
								analyticsService.report("onboarding_guide_popup_click", {
									action: "skip_explore",
									participantType,
								})
								abort()
							}}
						>
							{t("homeOnboarding.welcome.skip")}
						</button>
					</div>
				</section>
			</div>,
			document.body,
		)
	}

	if (!sidebarReady) return null

	/**
	 * Nothing to show while the run is on a step that lives on another page: the router has been
	 * asked for it, and the tour mounted there picks the step up. Rendering the step here would
	 * measure it against the wrong page.
	 */
	if (!stepOnThisPage) return null

	if (flow === "task-processing") {
		if (!projectEntered) return null
		return createPortal(
			<div className="fixed inset-0 z-[1200] text-foreground" role="dialog" aria-modal="true">
				<div className="absolute inset-0 bg-[rgba(52,52,52,0.62)]" />
				<section
					ref={setExposureNode}
					className="fixed left-1/2 top-1/2 w-[min(440px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-border bg-background px-5 pb-5 pt-6 shadow-2xl"
				>
					<h2 className="text-xl font-bold">{t("homeOnboarding.processing.title")}</h2>
					<p className="mt-3 max-w-[380px] text-sm leading-6 text-muted-foreground">
						{t("homeOnboarding.processing.description")}
					</p>
					<div className="mt-5 flex items-center justify-end gap-5 border-t border-border pt-4">
						<button
							type="button"
							onClick={() => {
								reportStepClick(3, "dismiss")
								abort()
							}}
							className="text-xs font-medium text-muted-foreground hover:text-foreground"
						>
							{t("homeOnboarding.processing.skip")}
						</button>
						<button
							type="button"
							onClick={() => {
								reportStepClick(3, "confirm")
								setProjectStepIndex(0)
								setFlow(guidedProjectSteps[0].flow)
								setHomeOnboardingFlow(guidedProjectSteps[0].flow)
							}}
							className="rounded-xl bg-foreground px-6 py-2.5 text-sm font-semibold text-background hover:opacity-90"
						>
							{t("homeOnboarding.processing.start")}
						</button>
					</div>
				</section>
			</div>,
			document.body,
		)
	}

	if (waitingForTarget || !rect) {
		return createPortal(
			<div
				className="fixed inset-0 z-[1200] text-foreground"
				role="dialog"
				aria-modal="true"
				aria-label={t("homeOnboarding.waiting")}
				/*
				 * The same root id as the step it is on its way to, with a phase that says which of
				 * the two this is. A step change unmounts the whole card for as long as the anchor
				 * takes to appear, so "the root is gone" would otherwise be ambiguous between a run
				 * that is mid-step and one that has ended — and a run that ended is what an aborted
				 * step looks like. Phase separates them; no step attributes are published here,
				 * because the step being prepared is not on screen yet.
				 */
				data-guide-phase="preparing"
				data-testid="guide-tour-root"
			>
				<div className="absolute inset-0 bg-[rgba(52,52,52,0.62)]" />
				<section className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background px-6 py-5 text-sm text-muted-foreground shadow-lg">
					{t("homeOnboarding.waiting")}
				</section>
			</div>,
			document.body,
		)
	}

	if (flow === "featured-case") {
		const cardWidth = Math.min(860, window.innerWidth - 48)
		// Keep extra room for the rendered footer and arrow so the card never
		// overlaps the highlighted editor area.
		const cardHeight = 340
		const left = Math.max(
			40,
			Math.min(
				rect.left + rect.width / 2 - cardWidth / 2,
				window.innerWidth - cardWidth - 40,
			),
		)
		const top = Math.max(32, rect.top - cardHeight - 28)
		return createPortal(
			<div className="fixed inset-0 z-[1200] text-foreground" role="dialog" aria-modal="true">
				<div
					className="pointer-events-none fixed z-[1201] rounded-[18px] border-2 border-foreground bg-transparent shadow-[0_0_0_4px_rgba(255,255,255,0.16),0_0_0_9999px_rgba(52,52,52,0.62)]"
					style={{
						left: rect.left - 3,
						top: rect.top - 3,
						width: rect.width + 6,
						height: rect.height + 6,
					}}
				/>
				<section
					ref={setExposureNode}
					className="fixed z-[1202] rounded-[18px] border border-border bg-background px-7 pb-7 pt-8 shadow-2xl"
					style={{ left, top, width: cardWidth }}
				>
					<div className="absolute bottom-[-18px] left-1/2 -translate-x-1/2 border-x-[18px] border-t-[18px] border-x-transparent border-t-background" />
					<p className="absolute right-7 top-6 text-base font-bold text-muted-foreground">
						{t("homeOnboarding.featured.kicker")}
					</p>
					<h2 className="text-2xl font-bold tracking-tight">
						{t("homeOnboarding.featured.title")}
					</h2>
					<p className="mt-4 text-xs leading-5 text-muted-foreground">
						{t("homeOnboarding.featured.description")}
					</p>
					<div className="mt-7 grid grid-cols-3 gap-3">
						{featuredCases.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => selectFeaturedCase(item.id, item.prompt)}
								className="flex h-32 flex-col justify-end rounded-xl border border-border px-5 py-4 text-left text-base font-semibold hover:border-foreground hover:bg-muted"
							>
								<span className="mb-auto text-2xl font-bold text-muted-foreground/40">
									{String(item.id).padStart(2, "0")}
								</span>
								{item.title}
							</button>
						))}
					</div>
					<div className="mt-6 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
						<span>{t("homeOnboarding.featured.footer")}</span>
						<button
							type="button"
							onClick={() => {
								reportStepClick(1, "exit")
								abort()
							}}
							className="hover:text-foreground"
						>
							{t("homeOnboarding.actions.skip")}
						</button>
					</div>
				</section>
			</div>,
			document.body,
		)
	}

	const step: OnboardingStep =
		flow === "prompt-ready"
			? {
					analyticsStepIndex: 2,
					anchor: "message-editor-send-button",
					placement: "top" as Placement,
					title: "featured.send.title",
					text: "featured.send.description",
				}
			: flow && activeProjectStep
				? {
						analyticsStepIndex: activeProjectStep.analyticsStepIndex,
						anchor: activeProjectStep.anchor,
						placement: activeProjectStep.placement,
						title: activeProjectStep.title,
						text: activeProjectStep.text,
					}
				: primarySteps[stepIndex]
	const progressDotSize = 6
	const isProjectGuide = Boolean(
		flow && flow !== "prompt-ready" && flow !== "task-processing" && flow !== "featured-case",
	)
	const displayCurrent = isProjectGuide ? projectStepIndex + 1 : stepIndex + 1
	const displayTotal = isProjectGuide ? activeGuideSteps.length : primarySteps.length
	const isLastProjectStep = isProjectGuide && projectStepIndex === activeGuideSteps.length - 1
	const showPrevious = isProjectGuide ? projectStepIndex > 0 : !flow && stepIndex > 0
	const progressBarWidth = 44
	const progressGap = 12
	const progressItems = isProjectGuide ? activeGuideSteps : primarySteps
	const progressIndex = isProjectGuide ? projectStepIndex : stepIndex
	/**
	 * The last highlighted step closes the run, and its label says which run that was. Re-watching a
	 * finished task is a review and never promises the reward again, whatever the task; a first pass
	 * names the reward the task pays, or plainly finishes when there is none to name.
	 */
	const finishLabelByTask: Partial<Record<HomeOnboardingTaskId, string>> = {
		"super-lobster": t("homeOnboarding.claw.actions.finish"),
		"hire-employee": t("homeOnboarding.employee.actions.finish"),
		"manage-skill": t("homeOnboarding.skill.actions.finish"),
		"create-micro-app": t("homeOnboarding.microApp.actions.finish"),
		"create-ai-ppt": t("homeOnboarding.aiPpt.actions.finish"),
		"audio-recording": t("homeOnboarding.audioRecording.actions.finish"),
	}
	const finishLabel = isReplayRun
		? t("homeOnboarding.actions.replayFinish")
		: (finishLabelByTask[entry.task] ?? t("homeOnboarding.actions.standaloneFinish"))
	/**
	 * The one action the footer ends a step with, resolved into its three readings at once: the word,
	 * whether it carries the advance arrow, and which kind of move it makes.
	 *
	 * One reading rather than three, because it is one action. The footer is the same footer wherever
	 * the run is — the tasks' steps and the two in-project tours all end on these same three buttons
	 * — so a step never varies the control, only what it means. The word was already a nested ternary
	 * and the arrow a second derivation of the same conditions; a third one written beside them for
	 * the test attribute would have been a third thing to keep in step by hand. It is the attribute
	 * that a test can assert on: the word changes with the locale, and the difference between a first
	 * pass and a re-watch shows in the word alone.
	 *
	 * The kinds are the moves worth telling apart. `next` advances, `finish` closes the run and
	 * `replay-finish` closes a re-watch — the same button doing the other thing, promising no reward.
	 * Those three are what this footer can be seen doing.
	 *
	 * `send` is the fourth, and the one no step of a run reaches from here: it is the hand-over the
	 * AI-work run's last stage makes to the composer, and that stage is a card of its own — the prompt
	 * is already filled into the composer by then, and the card points at the composer's own send
	 * button instead of ending on these three buttons. The reading stays beside the copy it belongs to
	 * (`homeOnboarding.featured.send.button`, which this branch is the only place to name), so that a
	 * hand-over ever closing on this footer instead would find its label waiting here — and the
	 * footer's specs would go red the moment that card grew one, which is where it would be noticed.
	 */
	const resolvePrimaryAction = (): {
		key: "send" | "next" | "finish" | "replay-finish"
		label: string
		arrow: boolean
	} => {
		if (flow === "prompt-ready")
			return { key: "send", label: t("homeOnboarding.featured.send.button"), arrow: false }

		if (isProjectGuide) {
			if (!isLastProjectStep) {
				/*
				 * The tour of a delivered file is the one guided flow that carries the arrow: its two
				 * steps are read as a pair — "here is the file, here is where it is kept" — so the
				 * first one says out loud that it is moving on. The in-project tour instead walks a
				 * page the user is already looking at, and its labels have always stood on their own.
				 */
				return {
					key: "next",
					label: t("homeOnboarding.project.actions.next"),
					arrow: isDeliverableRun && !step.action,
				}
			}
			return {
				/*
				 * The last step closes the run, and the two guided flows close differently: the
				 * in-project tour is part of a task and ends by naming that ("结束导览"), while the
				 * tour of a delivered file belongs to no task and simply ends.
				 */
				key: "finish",
				label: t(
					isDeliverableRun
						? "homeOnboarding.deliverable.actions.finish"
						: "homeOnboarding.project.actions.finish",
				),
				arrow: false,
			}
		}

		if (stepIndex === primarySteps.length - 1) {
			return {
				key: isReplayRun ? "replay-finish" : "finish",
				label: finishLabel,
				arrow: false,
			}
		}

		return {
			key: "next",
			label: step.action ?? t("homeOnboarding.actions.next"),
			/*
			 * A step that names its own hand-over already says where it is going, so an arrow there
			 * would only repeat the label. It is drawn as an icon rather than folded into the wording
			 * because the label has to stay translatable and the arrow needs spacing of its own.
			 */
			arrow: !step.action,
		}
	}
	const primaryAction = resolvePrimaryAction()

	const progressLeft = (index: number) => {
		let left = 0
		for (let position = 0; position < index; position += 1) {
			left += (position === progressIndex ? progressBarWidth : progressDotSize) + progressGap
		}
		return left
	}
	/**
	 * The step card has to keep its footer on one line — "上一步" and "退出引导" on the left, the
	 * primary action on the right, and the longest label is the MagiClaw tour's
	 * "完成导览，领取 50 积分". At the original 340px the row ran out of room and every button
	 * wrapped onto a second line, so the card is wider by the amount the labels actually need.
	 * Clamped to the viewport so a narrow window loses width instead of spilling over the edge.
	 */
	const cardWidth = Math.min(flow === "prompt-ready" ? 390 : 400, window.innerWidth - 32)
	const gap = 20
	/**
	 * What the card is placed against. The prompt-ready step stands beside the composer rather than
	 * beside the button it names, so it uses the composer's cut-out — which is the padded box the
	 * mask cuts, not the editable area inside it. That is deliberate and it is the only reading that
	 * holds: the card must clear the highlight the user can see, and the highlight is the cut-out.
	 * A card placed against the unpadded box would sit ten pixels inside the light.
	 */
	const positionRect = flow === "prompt-ready" && editorRect ? editorRect : rect
	const available = {
		top: positionRect.top - gap,
		bottom: window.innerHeight - positionRect.bottom - gap,
		left: positionRect.left - gap,
		right: window.innerWidth - positionRect.right - gap,
	}
	/**
	 * Which side the card opens on. The step states a preference, and it is overruled when that side
	 * cannot hold the card while the opposite one can — judged against the height the card really
	 * renders at, so "cannot hold it" means what it says and the card does not come back down over
	 * the control it is pointing at.
	 */
	let placement = step.placement
	if (placement === "top" && available.top < cardHeight && available.bottom > available.top)
		placement = "bottom"
	if (placement === "bottom" && available.bottom < cardHeight && available.top > available.bottom)
		placement = "top"
	if (placement === "right" && available.right < cardWidth && available.left > available.right)
		placement = "left"
	if (placement === "left" && available.left < cardWidth && available.right > available.left)
		placement = "right"
	let left = positionRect.left
	let top = positionRect.bottom + gap
	if (placement === "right") {
		left = positionRect.right + gap
		top = positionRect.top + positionRect.height / 2 - cardHeight / 2
	} else if (placement === "left") {
		left = positionRect.left - cardWidth - gap
		top = positionRect.top + positionRect.height / 2 - cardHeight / 2
	} else if (placement === "top") {
		left = positionRect.left + positionRect.width / 2 - cardWidth / 2
		top = positionRect.top - cardHeight - gap
	}
	/**
	 * The viewport margins give way before the anchor does. When the anchor sits close enough to an
	 * edge that holding the card a margin away from it would drag the card back over the control it
	 * points at, the card keeps the gap it was placed with and loses a slip of the screen instead —
	 * but only when that really does clear the anchor, and only while most of the card stays on
	 * screen. Otherwise the margins win, as they always did. Only the vertical axis is allowed to do
	 * this: a card that is nearly as wide as the window has nowhere to slide off to, and clipping
	 * its text would buy nothing.
	 */
	left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16))
	const clampedTop = Math.max(16, Math.min(top, window.innerHeight - cardHeight - 16))
	const coversAnchorVertically = (value: number) =>
		value < positionRect.bottom && value + cardHeight > positionRect.top
	const relaxedTop = Math.max(
		MIN_VISIBLE_CARD - cardHeight,
		Math.min(top, window.innerHeight - MIN_VISIBLE_CARD),
	)
	top =
		coversAnchorVertically(clampedTop) &&
		!coversAnchorVertically(relaxedTop) &&
		Math.abs(relaxedTop - clampedTop) > 0.5
			? relaxedTop
			: clampedTop

	/**
	 * A card that ends up sitting on the very control it points at is moved under or over it
	 * instead. That is what happens to a card that was asked to open beside an anchor the window
	 * leaves no room next to: pulling it back inside the viewport throws it across the anchor, and
	 * no side can hold it, so the side it was asked for has already been given up by the rules
	 * above. Pointing at a control from on top of it is exactly what those rules exist to avoid, so
	 * a card that still covers its anchor — on both axes, not merely in line with it — takes the
	 * room above or below it, which a full-width anchor always leaves, and only stays put when
	 * neither has the height for it.
	 */
	const coversAnchor = (candidateLeft: number, candidateTop: number) =>
		candidateLeft < positionRect.right &&
		candidateLeft + cardWidth > positionRect.left &&
		candidateTop < positionRect.bottom &&
		candidateTop + cardHeight > positionRect.top
	if (coversAnchor(left, top)) {
		const centeredLeft = Math.max(
			16,
			Math.min(
				positionRect.left + positionRect.width / 2 - cardWidth / 2,
				window.innerWidth - cardWidth - 16,
			),
		)
		if (available.bottom >= cardHeight) {
			placement = "bottom"
			left = centeredLeft
			top = positionRect.bottom + gap
		} else if (available.top >= cardHeight) {
			placement = "top"
			left = centeredLeft
			top = positionRect.top - cardHeight - gap
		}
	}

	/**
	 * Where along the card's edge the pointer is drawn. It tracks the centre of the anchor, not the
	 * centre of the card, because the two only coincide while the window has room to centre the card
	 * on its anchor: an anchor close to an edge drags the card back inside the viewport, and a
	 * pointer left at the card's middle then points at empty space beside the control it is naming
	 * — which is the whole of what the pointer is for.
	 *
	 * Measured against the final card position, so it follows every correction above (the viewport
	 * clamp, the "margins give way to the anchor" move and the "card landed on its own anchor"
	 * relocation). Clamped to the card's straight edges so it never slides into a rounded corner.
	 */
	const arrowInset = Math.min(ARROW_INSET, cardWidth / 2)
	const arrowOffsetX = Math.max(
		arrowInset,
		Math.min(positionRect.left + positionRect.width / 2 - left, cardWidth - arrowInset),
	)
	const arrowOffsetY = Math.max(
		arrowInset,
		Math.min(positionRect.top + positionRect.height / 2 - top, cardHeight - arrowInset),
	)
	const arrowTracksAnchor = window.innerWidth > NARROW_CARD_MAX_WIDTH + SCROLLBAR_ALLOWANCE

	if (flow === "prompt-ready") {
		/**
		 * The one flow whose page has to stay reachable under the mask. Its two cut-outs — the
		 * composer and the send button — are what the user is being asked to use, so the overlay
		 * cannot swallow the pointer wholesale. The cover does it instead: it receives everything
		 * outside those two boxes and nothing inside them, which is exactly what the mask draws.
		 *
		 * Holes are taken in their square boxes. The mask rounds their corners, so the few pixels
		 * inside a corner belong to the cover's hole and not to the mask's — they are the corners
		 * of the composer and of the send button, where there is nothing to press.
		 */
		const cover = coverWindowExcept(
			window.innerWidth,
			window.innerHeight,
			editorRect ? [rect, editorRect] : [rect],
		)
		return createPortal(
			<div
				className="pointer-events-none fixed inset-0 z-[1200] text-foreground"
				role="dialog"
				aria-modal="true"
				aria-label={t("homeOnboarding.featured.send.title")}
			>
				{cover.map((box) => (
					<div
						key={`${box.top}-${box.left}-${box.width}-${box.height}`}
						className="pointer-events-auto fixed z-[1200]"
						style={{
							left: box.left,
							top: box.top,
							width: box.width,
							height: box.height,
						}}
						aria-hidden="true"
					/>
				))}
				<svg
					className="pointer-events-none fixed inset-0 z-[1200] size-full"
					aria-hidden="true"
				>
					<defs>
						<mask id="home-onboarding-send-mask">
							<rect width="100%" height="100%" fill="white" />
							<rect
								x={editorRect?.left ?? 0}
								y={editorRect?.top ?? 0}
								width={editorRect?.width ?? 0}
								height={editorRect?.height ?? 0}
								rx="14"
								fill="black"
							/>
							<rect
								x={rect.left}
								y={rect.top}
								width={rect.width}
								height={rect.height}
								rx="12"
								fill="black"
							/>
						</mask>
					</defs>
					<rect
						width="100%"
						height="100%"
						fill="rgba(52,52,52,0.62)"
						mask="url(#home-onboarding-send-mask)"
					/>
				</svg>
				<div
					className="pointer-events-none fixed z-[1201] rounded-xl border-2 border-white/95 bg-transparent shadow-[0_0_0_4px_rgba(255,255,255,0.16),0_12px_32px_rgba(17,19,24,0.18)]"
					style={{
						left: rect.left - 4,
						top: rect.top - 4,
						width: rect.width + 8,
						height: rect.height + 8,
					}}
				/>
				{/*
				 * The masked hole over `editorRect` must stay fully interactive: the featured case is
				 * prefilled as a normal, editable document, so users need to click, place the caret and
				 * type before sending. Never cover this rect with a `pointer-events-auto` shield — it
				 * swallows pointer/focus events and makes the prefilled prompt look read-only.
				 */}
				<section
					ref={setStepCardRef}
					className={cn(
						"pointer-events-auto fixed z-[1202] w-[min(390px,calc(100vw-32px))] rounded-[14px] border border-border bg-background px-5 pb-4 pt-5 shadow-[0_18px_48px_rgba(17,24,39,0.24)]",
						placement === "top" &&
							"before:absolute before:left-1/2 before:top-full before:-ml-2 before:border-[9px] before:border-transparent before:border-t-background before:content-['']",
						placement === "bottom" &&
							"before:absolute before:bottom-full before:left-1/2 before:-ml-2 before:border-[9px] before:border-transparent before:border-b-background before:content-['']",
						placement === "left" &&
							"before:absolute before:left-full before:top-1/2 before:-mt-2 before:border-[9px] before:border-transparent before:border-l-background before:content-['']",
						placement === "right" &&
							"before:absolute before:right-full before:top-1/2 before:-mt-2 before:border-[9px] before:border-transparent before:border-r-background before:content-['']",
					)}
					style={{ left, top, width: cardWidth }}
				>
					<h3 className="text-2xl font-semibold leading-tight">
						{t("homeOnboarding.featured.send.title")}
					</h3>
					<p className="mt-3 text-sm leading-6 text-muted-foreground">
						{t("homeOnboarding.featured.send.description")}
					</p>
					<div className="mt-4 flex items-center gap-3 border-t border-border pt-4 text-sm font-medium text-muted-foreground">
						<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-lg text-background">
							<IconArrowUp size={20} stroke={1.8} />
						</span>
						<span>{t("homeOnboarding.featured.send.hint")}</span>
					</div>
				</section>
				<div
					className="pointer-events-none fixed z-[1203] flex items-center gap-2 rounded-lg border-2 border-foreground bg-background px-3 py-2 text-sm font-semibold shadow-lg before:absolute before:right-[-12px] before:top-1/2 before:-mt-2 before:border-y-[8px] before:border-l-[12px] before:border-y-transparent before:border-l-foreground before:content-[''] after:absolute after:right-[-9px] after:top-1/2 after:-mt-1.5 after:border-y-[6px] after:border-l-[9px] after:border-y-transparent after:border-l-background after:content-['']"
					style={{
						left: Math.max(16, rect.left - 130),
						top: rect.top + rect.height / 2 - 18,
					}}
				>
					<span>{t("homeOnboarding.featured.send.cue")}</span>
					<span aria-hidden="true" className="text-xl leading-none">
						→
					</span>
				</div>
			</div>,
			document.body,
		)
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[1200] text-foreground"
			role="dialog"
			aria-modal="true"
			aria-label={t("homeOnboarding.stepLabel", {
				current: displayCurrent,
				total: displayTotal,
			})}
			/*
			 * The run's identity and its position, in a form that does not move when the copy, the
			 * locale or the step order does. This portal also draws the in-project guides and the
			 * prompt-ready flow, and those belong to no task, so `data-guide-task` is published only
			 * for a task's own steps — `data-guide-flow` is what tells the two apart. The position
			 * is 1-based and matches the "N / M" the card announces, so the label stays decorative
			 * and a test can step on the attributes instead.
			 */
			data-guide-flow={flow ?? "onboarding"}
			data-guide-phase="step"
			data-guide-step-index={displayCurrent}
			data-guide-step-total={displayTotal}
			data-guide-task={flow ? undefined : entry.task}
			data-testid="guide-tour-root"
		>
			<div
				className={cn(
					"pointer-events-none fixed z-[1201] rounded-xl border-2 border-white/95 bg-transparent shadow-[0_0_0_4px_rgba(255,255,255,0.16),0_0_0_9999px_rgba(52,52,52,0.62),0_12px_32px_rgba(17,19,24,0.18)] motion-reduce:transition-none",
					/*
					 * The easing is what gives a step change its move, and it is only ever wanted
					 * then. While the anchor is being followed the ring has to be where the anchor
					 * is, frame for frame — a transition against a moving target is a second
					 * animation on the same pixels, and the lag it leaves behind is the very
					 * misalignment this is here to avoid.
					 */
					anchorSettled && "transition-[left,top,width,height] duration-300 ease-out",
				)}
				style={{
					left: rect.left - 4,
					top: rect.top - 4,
					width: rect.width + 8,
					height: rect.height + 8,
				}}
			/>
			<section
				ref={setStepCardRef}
				className={cn(
					"fixed z-[1202] w-[min(400px,calc(100vw-32px))] rounded-[14px] border border-border bg-background px-5 pb-[17px] pt-[19px] shadow-[0_18px_48px_rgba(17,24,39,0.24)] duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none max-[760px]:bottom-4 max-[760px]:left-1/2 max-[760px]:top-auto max-[760px]:-translate-x-1/2",
					placement === "right" &&
						"before:absolute before:right-full before:top-[var(--guide-arrow-y,50%)] before:-mt-[9px] before:border-[9px] before:border-transparent before:border-r-background before:content-['']",
					placement === "left" &&
						"before:absolute before:left-full before:top-[var(--guide-arrow-y,50%)] before:-mt-[9px] before:border-[9px] before:border-transparent before:border-l-background before:content-['']",
					placement === "top" &&
						"before:absolute before:left-[var(--guide-arrow-x,50%)] before:top-full before:-ml-[9px] before:border-[9px] before:border-transparent before:border-t-background before:content-['']",
					placement === "bottom" &&
						"before:absolute before:bottom-full before:left-[var(--guide-arrow-x,50%)] before:-ml-[9px] before:border-[9px] before:border-transparent before:border-b-background before:content-['']",
				)}
				style={
					{
						left,
						top,
						width: cardWidth,
						/*
						 * Read by the pointer's `before:` rules above, which fall back to the card's
						 * own middle when the card is pinned to the bottom of a narrow window and
						 * these offsets would be measured against a position it is not placed at.
						 */
						...(arrowTracksAnchor
							? {
									"--guide-arrow-x": `${arrowOffsetX}px`,
									"--guide-arrow-y": `${arrowOffsetY}px`,
								}
							: null),
					} as CSSProperties
				}
			>
				<div className="mb-[13px] flex items-center justify-start gap-4 text-[10px] font-semibold text-muted-foreground">
					<div
						className="relative h-1.5"
						aria-hidden="true"
						style={{
							width:
								progressBarWidth +
								progressDotSize * (progressItems.length - 1) +
								progressGap * (progressItems.length - 1),
						}}
					>
						{progressItems.map((item, index) => (
							<i
								className={cn(
									"absolute top-0 block h-1.5 rounded-full bg-[#d4d4d4] transition-[left,width] duration-300 ease-out motion-reduce:transition-none",
									index === progressIndex && "bg-foreground",
								)}
								style={{
									left: progressLeft(index),
									width:
										index === progressIndex
											? progressBarWidth
											: progressDotSize,
								}}
								// Two steps of the crew market tour share one anchor — the card's
								// secondary action, highlighted both before and after hiring — so
								// the anchor alone cannot key the row.
								key={`${item.anchor}-${index}`}
							/>
						))}
					</div>
					<span>
						{t("homeOnboarding.stepLabel", {
							current: displayCurrent,
							total: displayTotal,
						})}
					</span>
				</div>
				<h3 className="text-lg font-semibold leading-snug">{step.title}</h3>
				<p className="mt-2 text-xs leading-[1.65] text-muted-foreground">{step.text}</p>
				{/*
				 * The three actions belong on one line. The short labels are pinned with
				 * `whitespace-nowrap` so a cramped row can no longer break them mid-word ("上一" /
				 * "步"); the wide one is the primary label, and making room for it is what
				 * `cardWidth` is for. Should the two still not fit — a longer translation, a narrow
				 * window — the primary drops onto a line of its own (kept right-aligned by
				 * `ml-auto`) instead of being squeezed. On a narrow window the row turns into a
				 * column and every button stretches full width.
				 *
				 * The three carry fixed handles, because this footer is the one place every step of
				 * every task is driven from. A test that reached the primary action as "the last
				 * button", or by the wording behind it, would break on a translation or on an extra
				 * button — neither of which is a change of behaviour. The primary action also states
				 * which move it makes (see `resolvePrimaryAction`), that being the one reading of the
				 * three the wording cannot carry across locales.
				 */}
				<div className="mt-[15px] flex flex-wrap items-center justify-between gap-2.5 border-t border-border pt-[17px] max-[760px]:flex-col-reverse max-[760px]:items-stretch">
					<div className="flex items-center gap-1">
						{showPrevious && (
							<button
								data-testid="guide-tour-previous"
								className="min-h-[42px] whitespace-nowrap rounded-[10px] px-4 text-[13px] text-muted-foreground hover:bg-muted"
								type="button"
								onClick={() => {
									reportStepClick(analyticsStepIndex, "prev")
									if (isProjectGuide) goToProjectStep(projectStepIndex - 1)
									else goToStep(stepIndex - 1)
								}}
							>
								{t("homeOnboarding.actions.previous")}
							</button>
						)}
						<button
							data-testid="guide-tour-exit"
							className="min-h-[42px] whitespace-nowrap rounded-[10px] px-4 text-[13px] text-muted-foreground hover:bg-muted"
							type="button"
							onClick={() => {
								reportStepClick(analyticsStepIndex, "exit")
								abort()
							}}
						>
							{t("homeOnboarding.actions.skip")}
						</button>
					</div>
					<button
						data-testid="guide-tour-primary-action"
						data-guide-action={primaryAction.key}
						className="ml-auto inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-foreground bg-foreground px-4 text-[13px] text-background hover:opacity-90"
						type="button"
						onClick={() => {
							// Only the PRD's final guide cards carry `complete`; the AI-work
							// orientation ends at 8 and its deliverable cards are 9/10 later.
							reportStepClick(
								analyticsStepIndex,
								(entry.task === "workbench" && analyticsStepIndex === 4) ||
									(entry.task === "first-ai-work" && analyticsStepIndex === 10)
									? "complete"
									: "next",
							)
							if (!flow && stepIndex === primarySteps.length - 1) {
								// Every task ends with its own steps: a run never hands over to
								// another task, which is only opened by the introduction dialog or
								// by the benefits card. Only a re-watch has a caveat.
								if (isReplayRun) finishReplay()
								else complete()
							} else if (!flow) goToStep(stepIndex + 1)
							else if (flow === "prompt-ready") return
							else if (projectStepIndex < activeGuideSteps.length - 1) {
								goToProjectStep(projectStepIndex + 1)
							} else complete()
						}}
					>
						{primaryAction.label}
						{/* Decorative: the label already says "next", so the arrow repeats nothing a
						 * screen reader needs to hear twice. */}
						{primaryAction.arrow && (
							<IconArrowRight
								className="shrink-0"
								size={16}
								stroke={2}
								aria-hidden="true"
							/>
						)}
					</button>
				</div>
			</section>
		</div>,
		document.body,
	)
}

export default HomeOnboardingTour
