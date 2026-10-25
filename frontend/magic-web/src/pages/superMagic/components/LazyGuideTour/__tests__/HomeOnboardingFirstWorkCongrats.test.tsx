import { act, fireEvent, render, screen } from "@testing-library/react"
import fs from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { analyticsReport } = vi.hoisted(() => ({ analyticsReport: vi.fn() }))

vi.mock("@/services/analytics", () => ({ analyticsService: { report: analyticsReport } }))

/**
 * The congratulation a new account is shown the first time one of its topics finishes.
 *
 * **What it opens on, since that is what this file was rebuilt around.** Not an event: the topic the
 * page is on, read out of the stores. The topic carries its execution status in its own `task_status`
 * — written by the page's arrived-message convergence and corrected against the backend — so
 * `finished` there is the app's own word for the work being done; the last assistant message of the
 * conversation is read as a second answer for the same question, because the two can lag each other
 * in either direction; and the turn's own *delivery* — a `finish_task` the message list renders as
 * the task's result — is the third, for the states where the statuses have not caught up with a
 * result the user can already see. None of them needs an announcement, which is the point: unlike
 * the store's end-of-execution notification, all three are still there to be read by a page that
 * opens after the ending landed, or by one whose topic arrived with its ending already in it. The
 * dialog used to listen for that notification, and the page it was written for never received one:
 * it opened on the project page of a topic that had already finished, and nothing ever told it so.
 *
 * Every case below therefore drives the page — its topic and its conversation — rather than handing
 * the dialog an event, and the first of them is the one that was broken: an ending that landed before
 * the dialog was even mounted. The reaction is also what makes the assertions here worth anything,
 * which is why the stores below are real `makeAutoObservable` ones: a reaction over a plain object
 * never fires, and a stand-in that cannot change under the dialog would pass every case for the wrong
 * reason.
 *
 * The three answers the dialog needs on top of that each have a group: the account has to still be
 * new, which is the backend's list rather than anything this client remembers; no guided run may own
 * the screen; and this browser must not have congratulated this account already — the one-shot rule
 * the delivered-file tour uses as well, and the reason storage is cleared between tests rather than
 * between files.
 *
 * The points are the last group's business: they are the backend's figure for the reward row, so the
 * same test would fail if a `100` were written into the component.
 *
 * The namespace the dialog asks for is recorded rather than assumed, because a namespace is a *file*
 * and picking the wrong one is silent: `t` answers with the key it was given, so every word on
 * screen turns into `homeOnboarding.firstWork.title` and nothing else complains.
 */
const {
	translate,
	MAGIC_ID,
	TOPIC_ID,
	CHAT_TOPIC_ID,
	routeParams,
	topicStoreHolder,
	messageListHolder,
	navigateToSuperHome,
	namespaces,
} = vi.hoisted(() => ({
	translate: (key: string, values?: Record<string, unknown>) =>
		values === undefined ? key : `${key}:${JSON.stringify(values)}`,
	MAGIC_ID: "magic-guide-first-work",
	TOPIC_ID: "topic-1",
	CHAT_TOPIC_ID: "chat-topic-1",
	routeParams: {} as Record<string, string>,
	/**
	 * The page's topic, as the dialog sees it. Built by the store's own factory below rather than
	 * here, because a stand-in only counts as a store if it comes from the same `mobx` instance the
	 * dialog's `observer` reads — and the module registry is reset for every test.
	 */
	topicStoreHolder: {} as { current: PageTopicStore },
	/** The page's conversation, which is the half of the page this dialog is watching. */
	messageListHolder: {} as { current: PageMessageListStore },
	navigateToSuperHome: vi.fn(),
	/** Every namespace the dialog has asked for, in order. */
	namespaces: [] as string[],
}))

vi.mock("react-i18next", () => ({
	useTranslation: (namespace: string) => {
		namespaces.push(namespace)
		return {
			i18n: { language: "en_US" },
			t: translate,
		}
	},
}))

vi.mock("react-router", () => ({ useParams: () => routeParams }))

vi.mock("@/layouts/BaseLayout/components/MagicSidebar/hooks/useNavigateToSuperHome", () => ({
	useNavigateToSuperHome: () => ({
		superRouteUrl: "",
		navigateToSuperHome,
		handleNavigateToSuperHome: vi.fn(),
	}),
}))

/**
 * The page's message list, as the dialog reads it: the canonical list per topic, and the node behind
 * each message — the field the store's own merge carries the execution status on, with the item's
 * own `superStatus` as the fallback the dialog keeps for conversations that arrive without one.
 *
 * Writes go through methods because `makeAutoObservable` turns them into actions, and MobX insists
 * that an observed value is written from inside one.
 */
interface PageMessageListStore {
	messages: Map<string, unknown[]>
	messageMap: Map<string, { status?: string }>
	/**
	 * The store's two invalidation counters, as the real store keeps them: plain numbers in a
	 * shallow observable map, one per Topic for its membership and one per row for its canonical
	 * node. They exist because the rows themselves are not observable — see `endInPlace` — and the
	 * dialog reads them through the store's own accessors, so the shape here is only the store's
	 * business.
	 */
	messageRevisions: Map<string, number>
	topicMessageMembershipRevisions: Map<string, number>
	/** Empties the page. A store a test has written to is still written in the next one. */
	reset(): void
	/** The page's conversation for a topic arriving, which is what the store commits. */
	commit(chatTopicId: string, messages: unknown[]): void
	/**
	 * The status the topic's execution came to rest on, written the way the store writes a row it
	 * has just created: a new entry in the map, and the row's revision with it.
	 */
	endAt(superMessageId: string, status: string, chatTopicId?: string): void
	/**
	 * The same ending arriving on the row the list *already* holds — the object is updated in
	 * place and the entry is left where it is. This is how the store's own streaming path writes a
	 * row (`syncAssistantCardProjection`), and it is why the row revision exists at all: nothing
	 * about the map changes here, so nothing that follows the map's entries can see it.
	 */
	endInPlace(superMessageId: string, status: string, chatTopicId?: string): void
	getMessageNode(superMessageId?: string): { status?: string } | undefined
	getMessageRevision(topicId: string, superMessageId?: string): number
	getTopicMessageMembershipRevision(topicId: string): number
}

vi.mock("@/pages/superMagic/stores", async () => {
	const { makeAutoObservable, observable } = await import("mobx")
	/** The store's own key for a row's revision: the Topic and the row together. */
	const revisionKey = (chatTopicId: string, superMessageId: string) =>
		`${chatTopicId}\u0000${superMessageId || ""}`
	const bump = (chatTopicId: string, superMessageId: string) => {
		const key = revisionKey(chatTopicId, superMessageId)
		store.messageRevisions.set(key, (store.messageRevisions.get(key) || 0) + 1)
	}
	const store: PageMessageListStore = {
		messages: new Map<string, unknown[]>(),
		messageMap: new Map<string, { status?: string }>(),
		messageRevisions: new Map<string, number>(),
		topicMessageMembershipRevisions: new Map<string, number>(),
		reset() {
			store.messages.clear()
			store.messageMap.clear()
			store.messageRevisions.clear()
			store.topicMessageMembershipRevisions.clear()
		},
		commit(chatTopicId, messages) {
			store.messages.set(chatTopicId, messages)
			store.topicMessageMembershipRevisions.set(
				chatTopicId,
				(store.topicMessageMembershipRevisions.get(chatTopicId) || 0) + 1,
			)
		},
		endAt(superMessageId, status, chatTopicId = CHAT_TOPIC_ID) {
			store.messageMap.set(superMessageId, { status })
			bump(chatTopicId, superMessageId)
		},
		endInPlace(superMessageId, status, chatTopicId = CHAT_TOPIC_ID) {
			const existing = store.messageMap.get(superMessageId)
			if (existing) existing.status = status
			else store.messageMap.set(superMessageId, { status })
			bump(chatTopicId, superMessageId)
		},
		getMessageNode(superMessageId?: string) {
			return store.messageMap.get(superMessageId || "")
		},
		getMessageRevision(topicId: string, superMessageId?: string) {
			return store.messageRevisions.get(revisionKey(topicId, superMessageId || "")) || 0
		},
		getTopicMessageMembershipRevision(topicId: string) {
			return store.topicMessageMembershipRevisions.get(topicId) || 0
		},
	}
	/*
	 * Every map is annotated the way the real store annotates it, and `messageMap` is annotated
	 * along with them because that is what the real store's `messageMap` behaves like: a Map whose
	 * own entries are observable and whose *values* are not. A row is therefore a plain object the
	 * store updates in place, and an in-place write notifies nobody — which is exactly what the
	 * dialog has to survive, and why the store publishes the two revision counters above. Leaving
	 * this one to `makeAutoObservable`'s own default would quietly give the mock observable rows,
	 * and every case here would then pass for a reason the real store does not provide.
	 */
	messageListHolder.current = makeAutoObservable(store, {
		messages: observable.shallow,
		messageMap: observable.shallow,
		messageRevisions: observable.shallow,
		topicMessageMembershipRevisions: observable.shallow,
	})
	return { superMagicStore: messageListHolder.current }
})

/**
 * The slice of the page's store this dialog reads, plus the one way a test walks the page along.
 *
 * It is shaped after the real `TopicStore` because the shape is the point: `selectedTopic` is
 * observable, the page moves by writing it, and that write is what re-renders this dialog — an
 * `observer` — as well as being what the watch inside it reads. A plain object would leave that path
 * untested, since `observer` is itself a `React.memo` and an identical re-render is skipped rather
 * than run.
 *
 * `task_status` is on it because the topic's own status is the first thing the dialog asks about an
 * ending. It is written the way the real store's `updateTopicStatus` writes it — through the
 * observable, onto the object that is already selected. That path earns its place in the harness for
 * its own sake: the field hangs off a *deeply* observable object, so an in-place write is audible to
 * a reaction, which is exactly what a row of the message store's map is not.
 *
 * `topics` is the workspace's list beside it, and `id` on both is what keeps the two apart: the
 * dialog resolves the topic the route names out of the list rather than taking the store's current
 * selection for it, so a harness without a list could not describe the two disagreeing. `endTopicAt`
 * mirrors the real writer exactly — the list entry always, the selected topic only when the ids
 * match — which is what makes "written somewhere the dialog does not read" a describable state.
 */
interface PageTopicStore {
	topics: Array<{ id: string; chat_topic_id: string; task_status: string }>
	selectedTopic: { id: string; chat_topic_id: string; task_status: string } | null
	/** The page opening a topic, which is how the dialog comes to be watching a new one. */
	openTopic(chatTopicId: string, taskStatus?: string, topicId?: string): void
	/** The page's arrived-message convergence landing on the topic, in place. */
	endTopicAt(taskStatus: string, topicId?: string): void
	/** The page leaving its topic, which is how every test starts. */
	closeTopic(): void
	/** Empties the harness. A topic a test wrote is still written in the next one. */
	reset(): void
}

vi.mock("@/pages/superMagic/stores/core", async () => {
	const { makeAutoObservable } = await import("mobx")
	const store: PageTopicStore = {
		topics: [],
		selectedTopic: null,
		openTopic(chatTopicId: string, taskStatus = "running", topicId = TOPIC_ID) {
			// `TopicStore.setTopics`/`updateTopic` put the topic in the list as well as in the
			// selection, and a page that walks to another topic replaces both.
			const listed = store.topics.find((topic) => topic.id === topicId)
			const next = { id: topicId, chat_topic_id: chatTopicId, task_status: taskStatus }
			if (listed) Object.assign(listed, next)
			else store.topics.push(next)
			store.selectedTopic = { ...next }
		},
		endTopicAt(taskStatus: string, topicId = TOPIC_ID) {
			// Read through the observable instance, the way `TopicStore.updateTopicStatus` does:
			// the list entry takes the status either way, and the selection only when it is this
			// topic that is selected.
			const topic = topicStoreHolder.current
			const listed = topic.topics.find((item) => item.id === topicId)
			if (listed) listed.task_status = taskStatus
			if (topic.selectedTopic?.id === topicId) topic.selectedTopic.task_status = taskStatus
		},
		closeTopic() {
			store.selectedTopic = null
		},
		reset() {
			store.topics.length = 0
			store.selectedTopic = null
		},
	}
	topicStoreHolder.current = makeAutoObservable(store)
	return { topicStore: topicStoreHolder.current }
})

const { getOnboardingTasks, completeOnboardingTask } = vi.hoisted(() => ({
	getOnboardingTasks: vi.fn(),
	completeOnboardingTask: vi.fn(),
}))

vi.mock("@/apis/modules/onboarding", () => ({ getOnboardingTasks, completeOnboardingTask }))

const TITLE = "homeOnboarding.firstWork.title"
const CARD_TITLE = "homeOnboarding.firstWork.card.title"
const CARD_DESCRIPTION = "homeOnboarding.firstWork.card.description"
const START = "homeOnboarding.firstWork.actions.start"
const LATER = "homeOnboarding.firstWork.actions.later"
const POINTS = "homeOnboarding.firstWork.points"
const CLOSE = "homeOnboarding.firstWork.close"

/** Every key the dialog draws, so that nothing it shows can be left out of the check below. */
const DRAWN_KEYS = [TITLE, CARD_TITLE, CARD_DESCRIPTION, START, LATER, POINTS, CLOSE]

/** One reward row as the backend sends it. */
function task(code: string, points: number) {
	return {
		code,
		points,
		validity_days: 7,
		status: "COMPLETED",
		reward_status: "GRANTED",
		completed_at: "2026-10-08T09:00:00Z",
		reward_granted_at: "2026-10-08T09:00:00Z",
		expires_at: "2026-12-31T00:00:00Z",
	}
}

/** An account the backend still counts as new, with the AI-work row it has just finished. */
function backendStillListsTasks(points = 100, code = "first_ai_work") {
	getOnboardingTasks.mockResolvedValue({ tasks: [task(code, points)] })
}

/** The user's own message, which carries no execution status of its own. */
function userMessage() {
	return { role: "user", app_message_id: "app-user-1", status: "read" }
}

/** The assistant's message, whose status is the topic's rather than its own. */
function assistantMessage(superMessageId: string, superStatus: string) {
	return { role: "assistant", super_message_id: superMessageId, superStatus }
}

/**
 * The agent's own word for having a result: the Tool row the message list keeps for a finished
 * `finish_task`, with the task's status where the raw projection carries it — `debug.status`, the
 * field `canRenderFinalAttachments` reads when it is handed a raw row.
 */
function deliveredTaskMessage(superMessageId: string, taskStatus = "finished") {
	return {
		role: "tool",
		super_message_id: superMessageId,
		debug: { role: "tool", tool: { name: "finish_task" }, status: taskStatus },
	}
}

/**
 * The page's conversation for a topic arriving, ending on an assistant message whose execution came
 * to rest on `status`. Both halves of what the dialog reads are written — the list, and the node
 * behind the last message — because the real store writes both.
 *
 * The node's id is derived from the topic, since nodes are keyed by their own id in a map that spans
 * the workspace, exactly as the real store keeps them: two topics made to share one node would have
 * the ending of either read as the ending of both.
 *
 * `node: false` leaves the node out, which is the conversation the dialog's fallback exists for.
 */
function conversationEndsAt(status: string, { chatTopicId = CHAT_TOPIC_ID, node = true } = {}) {
	const superMessageId = `super-${chatTopicId}`
	act(() => {
		messageListHolder.current.commit(chatTopicId, [
			userMessage(),
			assistantMessage(superMessageId, status),
		])
		if (node) messageListHolder.current.endAt(superMessageId, status, chatTopicId)
	})
}

/**
 * Fresh modules for every test. The reward list and the "a run is up" flag are module state, and a
 * test that arranged one of them must not decide what the next one starts from.
 *
 * The page's stores are the exception, and the reason `beforeEach` empties them by hand: the mock is
 * not re-evaluated along with the modules under test, so a conversation a test committed is still
 * committed in the next one — with a node whose status wins over the one the next test wrote.
 */
async function loadDialog() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const dialog = await import("../HomeOnboardingFirstWorkCongrats")
	return { onboarding, Dialog: dialog.default }
}

/**
 * Mounts the dialog on the project page, with the topic the route named already selected.
 *
 * `arrange` runs after the page's stores exist but *before* the first render, which is what lets a
 * case set up a page the dialog has to make up its mind about on sight: a topic that finished before
 * anybody mounted anything.
 *
 * `topicStatus` is the status the page has for that topic when it opens it. A conversation in flight
 * is the ordinary starting point, so that is the default; passing `finished` is how a case describes
 * a topic the page already knows is over.
 */
async function mountDialog(
	arrange?: (modules: Awaited<ReturnType<typeof loadDialog>>) => void | Promise<void>,
	{ topicStatus = "running" }: { topicStatus?: string } = {},
) {
	const modules = await loadDialog()
	// The page has opened the topic its route names; that is the topic the dialog watches.
	topicStoreHolder.current.openTopic(CHAT_TOPIC_ID, topicStatus)
	await arrange?.(modules)
	const rendered = render(<modules.Dialog userMagicId={MAGIC_ID} />)
	await act(async () => {
		await Promise.resolve()
	})
	return { ...modules, ...rendered }
}

/**
 * The page's own convergence landing on a topic's status, which is how the page reports that the
 * work finished (`SuperMagicService.topic.updateTopicStatus`). Nothing about the conversation moves,
 * which is the point of the cases that use it.
 *
 * `topicId` is which topic it lands on, and the default is the one the route names. Passing another
 * is how a case describes the write going somewhere the dialog is not looking — the state
 * `updateTopicStatus` produces when the store's selection has moved on from the page.
 */
function topicEndsAt(status: string, topicId = TOPIC_ID) {
	act(() => {
		topicStoreHolder.current.endTopicAt(status, topicId)
	})
}

/** The backend's list landing, which is what "this account is still new" is read from. */
async function listArrives(onboarding: Awaited<ReturnType<typeof loadDialog>>["onboarding"]) {
	await act(async () => {
		await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
	})
}

/**
 * A page that is ready in every other way, with the conversation in `status`. Every case starts from
 * one of these: the subject is what the dialog does about the conversation, not what it does about
 * the account or the run.
 */
async function mountWithConversationEndingAt(status: string, node = true) {
	const mounted = await mountDialog(async ({ onboarding }) => {
		backendStillListsTasks()
		conversationEndsAt(status, { node })
		await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
	})
	return mounted
}

function congratsDialog() {
	return screen.queryByRole("dialog", { name: TITLE })
}

beforeEach(() => {
	namespaces.splice(0)
	routeParams.projectId = "project-1"
	routeParams.topicId = TOPIC_ID
	getOnboardingTasks.mockReset()
	completeOnboardingTask.mockReset()
	navigateToSuperHome.mockReset()
	analyticsReport.mockReset()
	// An empty page in both stores: see `loadDialog`.
	messageListHolder.current?.reset()
	topicStoreHolder.current?.reset()
	// The one-shot answer outlives a page load, which is the point of it, so it is cleared by hand.
	window.localStorage.clear()
})

describe("what the dialog waits for before it opens", () => {
	it(
		"opens for a conversation that had already ended when the page got here",
		{ timeout: 20_000 },
		async () => {
			/*
			 * The case the dialog used to lose. Everything is in place before the first render: the
			 * topic finished, the account is new per the backend, nothing is on screen. Nobody will
			 * ever announce that ending — it landed before this page existed — and the dialog has to
			 * find it by looking.
			 *
			 * The generous timeout is this file's cold start, not this case's work: the first test
			 * pays for the whole module graph (every case takes fresh modules, see `loadDialog`),
			 * and the default five seconds is not enough for it plus the first render.
			 */
			const mounted = await mountWithConversationEndingAt("finished")

			expect(congratsDialog()).not.toBeNull()
			expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
			expect(analyticsReport).toHaveBeenCalledWith("onboarding_reward_popup_exposure", {
				pointsAmount: 100,
			})
		},
	)

	it("opens on the topic's own status, with no conversation to read at all", async () => {
		/*
		 * The topic is asked first, and it answers on its own. `task_status` is the field the page's
		 * arrived-message convergence writes and the backend's reconciliation corrects, and the field
		 * the workspace's topic list draws its state from — so it is the app's word for "this topic
		 * has finished" rather than one projection of one of its messages having caught up.
		 *
		 * This page has nothing in the message store at all: the dialog is asked about a topic, and a
		 * topic that is over is over whether or not anybody is holding its messages.
		 */
		const mounted = await mountDialog(
			async ({ onboarding }) => {
				backendStillListsTasks()
				await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
			},
			{ topicStatus: "finished" },
		)

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("opens when the topic's status lands in place, with its conversation saying nothing", async () => {
		/*
		 * The write the page really makes (`SuperMagicService.topic.updateTopicStatus`): the status
		 * goes onto the selected topic object itself and nothing about the conversation moves. It is
		 * audible because that field hangs off a *deeply* observable object — which is the whole
		 * reason the topic is the answer worth trusting, and the opposite of a row of the message
		 * store's map, whose value is not observable at all.
		 */
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})
		expect(congratsDialog()).toBeNull()

		topicEndsAt("finished")

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("opens on the topic the route names even when the store has another one selected", async () => {
		/*
		 * Why the topic is resolved by id rather than taken from the selection. The write that
		 * matters is `TopicStore.updateTopicStatus`: the status goes onto the list entry for the
		 * topic it was given, and onto `selectedTopic` only when that is the same topic. The
		 * selection is therefore free to be a topic the page is not on — the last navigation's
		 * leftover — while the page's own topic finishes in the list beside it. Read from the
		 * selection alone, the dialog would be asking about the wrong topic and would never see it,
		 * which is exactly the shape of the failure this dialog was rebuilt for.
		 *
		 * The page has no conversation in this case either: the ending is the list's to report, and
		 * the chat id it is asked about is the one the route's topic carries.
		 */
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})
		// The store moves on to another topic; the route still names this page's one.
		act(() => {
			topicStoreHolder.current.openTopic("chat-topic-2", "running", "topic-2")
		})
		expect(congratsDialog()).toBeNull()

		topicEndsAt("finished")

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("opens on a topic whose conversation was left waiting for the user", async () => {
		/*
		 * The two answers disagreeing, which is the state this dialog used to sit in. The topic says
		 * it finished; the last assistant message the watch picks up reads `waiting_for_user` —
		 * a distinction the design draws for a topic that has really handed control back, and
		 * nothing but a lag when the topic has already ended. The topic's own status is the stronger
		 * statement of the two, and it is the one that decides.
		 */
		const mounted = await mountWithConversationEndingAt("waiting_for_user")
		expect(congratsDialog()).toBeNull()

		topicEndsAt("finished")

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("opens when the conversation ends while the page is up", async () => {
		const mounted = await mountWithConversationEndingAt("running")
		expect(congratsDialog()).toBeNull()

		conversationEndsAt("finished")

		expect(congratsDialog()).not.toBeNull()
		expect(screen.getByText(TITLE)).toBeTruthy()
		expect(screen.getByText(CARD_TITLE)).toBeTruthy()
		expect(screen.getByText(CARD_DESCRIPTION)).toBeTruthy()
		expect(screen.getByText(START)).toBeTruthy()
		expect(screen.getByText(LATER)).toBeTruthy()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("opens when the ending lands on a row the list already carries", async () => {
		/*
		 * The write the store's own streaming path uses (`syncAssistantCardProjection`): the row
		 * object the list already holds is updated in place, on the object itself, and the row's
		 * revision is what announces it. The list's membership does not change at all, so a watch
		 * that follows only the map's entries never runs again — and this write *is* the ending,
		 * which is the whole of what there is to congratulate. A topic whose last assistant
		 * message is finished this way is therefore one the dialog has to be able to see finish,
		 * and the body below is that conversation as the page really builds it: the list arrives
		 * while the work is running, and the status lands afterwards on the row already on screen.
		 */
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		// The conversation arrives, still running — the list, then the row behind its tail.
		const superMessageId = `super-${CHAT_TOPIC_ID}`
		act(() => {
			messageListHolder.current.commit(CHAT_TOPIC_ID, [
				userMessage(),
				assistantMessage(superMessageId, "running"),
			])
			messageListHolder.current.endAt(superMessageId, "running")
		})
		expect(congratsDialog()).toBeNull()

		// The work finishes: the same row, updated in place. Nothing is replaced.
		act(() => {
			messageListHolder.current.endInPlace(superMessageId, "finished")
		})

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("says nothing until the backend's list has said the account is still new", async () => {
		const mounted = await mountDialog(() => {
			backendStillListsTasks()
			conversationEndsAt("finished")
		})
		expect(congratsDialog()).toBeNull()
		// Nothing was shown, so nothing was spent: the moment is still owed.
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)

		await listArrives(mounted.onboarding)

		expect(congratsDialog()).not.toBeNull()
	})

	it("takes the points from the backend's row rather than a number of its own", async () => {
		await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks(250)
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		conversationEndsAt("finished")

		expect(screen.getByText(`${pointsLabel(250)}`)).toBeTruthy()
	})

	it("leaves the badge off when the list has not carried that row", async () => {
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks(100, "super_magic_intro")
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		conversationEndsAt("finished")

		expect(congratsDialog()).not.toBeNull()
		expect(screen.queryByText(pointsLabel(100))).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("ignores a conversation that came to rest on anything but success", async () => {
		const mounted = await mountWithConversationEndingAt("error")

		expect(congratsDialog()).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)
	})

	it("does not take a tool message's own success for the work being done", async () => {
		const mounted = await mountWithConversationEndingAt("running")

		// A tool has finished, and it is the newest message in the conversation. Its status is the
		// tool's business; the assistant's message is the one that speaks for the topic.
		act(() => {
			messageListHolder.current.commit(CHAT_TOPIC_ID, [
				userMessage(),
				assistantMessage("super-1", "running"),
				{ role: "tool", super_message_id: "super-1-tool", superStatus: "finished" },
			])
			messageListHolder.current.endAt("super-1", "running")
			messageListHolder.current.endAt("super-1-tool", "finished")
		})

		expect(congratsDialog()).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)
	})

	it("opens on the turn having delivered a task, with both statuses still reading as running", async () => {
		/*
		 * The third answer, and the one closest to what the user is shown: `finish_task` is what the
		 * agent calls when it has a result, and the delivery is that row rather than a status
		 * anywhere — which is why it is the one asked when the statuses have not caught up. They
		 * have not here: the topic is still `running` and so is the assistant's message, the drift
		 * the store ships a convergence service for.
		 *
		 * The case above is its opposite and stays closed on purpose: a Tool row that merely
		 * finished says nothing, and only a delivery does. What separates the two is the contract,
		 * not the role.
		 */
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})
		expect(congratsDialog()).toBeNull()

		act(() => {
			messageListHolder.current.commit(CHAT_TOPIC_ID, [
				userMessage(),
				assistantMessage("super-delivery", "running"),
				deliveredTaskMessage("super-delivery-finish"),
			])
			messageListHolder.current.endAt("super-delivery", "running")
			messageListHolder.current.endAt("super-delivery-finish", "finished")
		})

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})

	it("does not read an earlier turn's delivery as this turn's", async () => {
		/*
		 * The delivery is read over the turn the page is looking at and no further back, so the
		 * question it answers is "is *this* work done", not "has this topic ever delivered
		 * anything". Here the first turn delivered a task and the user has since asked for
		 * another: the second turn is the one that would be congratulated, and it has produced
		 * nothing yet.
		 *
		 * The one-shot flag makes this more than tidiness. Opening here would spend the
		 * congratulation on the previous task and leave the second one — the one the user is
		 * actually waiting on — uncongratulated for good.
		 */
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		act(() => {
			messageListHolder.current.commit(CHAT_TOPIC_ID, [
				userMessage(),
				assistantMessage("super-first", "running"),
				deliveredTaskMessage("super-first-finish"),
				{ role: "user", app_message_id: "app-user-2", status: "read" },
			])
			messageListHolder.current.endAt("super-first", "running")
			messageListHolder.current.endAt("super-first-finish", "finished")
		})

		expect(congratsDialog()).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)
	})

	it("still answers for a conversation the store kept no node behind", async () => {
		await mountWithConversationEndingAt("finished", false)

		expect(congratsDialog()).not.toBeNull()
	})

	it("leaves a guided run that owns the screen alone, and opens when it gives it back", async () => {
		const mounted = await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			conversationEndsAt("finished")
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
			onboarding.setHomeOnboardingRunActive(true)
		})
		expect(congratsDialog()).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)

		// The run is over. Nothing about the conversation changed, and the dialog takes the moment
		// on the strength of the answer that did.
		act(() => {
			mounted.onboarding.setHomeOnboardingRunActive(false)
		})

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})
})

describe("which conversation it is watching", () => {
	it("reads the topic the page is on, and not another topic's ending", async () => {
		await mountDialog(async ({ onboarding }) => {
			backendStillListsTasks()
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		// A topic elsewhere in the workspace finishes. The page is not on it.
		conversationEndsAt("finished", { chatTopicId: "another-topic" })
		expect(congratsDialog()).toBeNull()

		// This page's own topic is the one that finished.
		conversationEndsAt("finished")
		expect(congratsDialog()).not.toBeNull()
	})

	it("reads nothing off the project page", async () => {
		routeParams.projectId = undefined as unknown as string

		const mounted = await mountWithConversationEndingAt("finished")

		expect(congratsDialog()).toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(false)
	})

	it("follows the page to the next topic", async () => {
		const mounted = await mountWithConversationEndingAt("running")
		conversationEndsAt("finished", { chatTopicId: "chat-topic-2" })
		expect(congratsDialog()).toBeNull()

		// The page walks to a topic that has already finished. Nothing here re-renders the dialog by
		// hand: the store is the page's own state, and following it is the dialog's job.
		await act(async () => {
			topicStoreHolder.current.openTopic("chat-topic-2")
		})

		expect(congratsDialog()).not.toBeNull()
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
	})
})

describe("the one-shot rule", () => {
	it("congratulates once per account per browser, and not again on the next ending", async () => {
		const first = await mountWithConversationEndingAt("finished")
		expect(congratsDialog()).not.toBeNull()

		// Left through the second exit, which is a way of being shown the dialog rather than a way
		// of escaping it.
		await act(async () => {
			fireEvent.click(screen.getByText(LATER))
		})
		expect(congratsDialog()).toBeNull()
		conversationEndsAt("finished")
		expect(congratsDialog()).toBeNull()
		first.unmount()

		// A fresh page, the same browser and the same account: the answer came from storage, so it
		// is still spent.
		await mountWithConversationEndingAt("finished")

		expect(congratsDialog()).toBeNull()
	})

	it("keeps one account's flag to itself, so the next account is still owed its own", async () => {
		const mounted = await mountWithConversationEndingAt("finished")

		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent(MAGIC_ID)).toBe(true)
		expect(mounted.onboarding.isHomeOnboardingFirstWorkCongratsSpent("another-account")).toBe(
			false,
		)
	})
})

describe("the two exits", () => {
	it("closes in place, and does not claim the task on the way out", async () => {
		await mountWithConversationEndingAt("finished")

		await act(async () => {
			fireEvent.click(screen.getByText(LATER))
		})

		expect(congratsDialog()).toBeNull()
		expect(navigateToSuperHome).not.toHaveBeenCalled()
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_reward_popup_click", {
			action: "later",
		})
		// The backend finishes this task by itself; the client only ever reads the row.
		expect(completeOnboardingTask).not.toHaveBeenCalled()
	})

	it("leaves for the workspace from the primary action", async () => {
		await mountWithConversationEndingAt("finished")

		await act(async () => {
			fireEvent.click(screen.getByText(START))
		})

		expect(navigateToSuperHome).toHaveBeenCalledTimes(1)
		expect(congratsDialog()).toBeNull()
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_reward_popup_click", {
			action: "start_new_task",
		})
	})

	it("reports the close control separately", async () => {
		await mountWithConversationEndingAt("finished")

		await act(async () => {
			fireEvent.click(screen.getByLabelText(CLOSE))
		})

		expect(congratsDialog()).toBeNull()
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_reward_popup_click", {
			action: "close",
		})
	})
})

/**
 * The account's progress is asked for again as the dialog is acted on, on top of the ask that
 * brought the dialog up.
 *
 * The dialog's own ask happens at the instant the work is *reported* finished, and the row this
 * congratulation is about is the one task the backend completes by itself rather than on request —
 * so its verdict can still be settling at that moment. A list that came back with the row still
 * pending would then be the last word for the rest of the visit: a settled list is never asked for
 * again on its own (`ensureHomeOnboardingRewardList` returns early), and the task centre behind
 * this dialog is where the user goes to look at it. Each of the three exits therefore asks once
 * more, so what they land on cannot be the answer from before the task was finished.
 *
 * Counted off the network call rather than off the manager: `getOnboardingTasks` is the real
 * module's only way out, and a spy there is what makes "asked again" mean the ask actually went
 * out. The extra round trip is the whole of the change, so one call per exit is the assertion.
 */
describe("the progress it asks for again", () => {
	it("asks once more from the primary action", async () => {
		await mountWithConversationEndingAt("finished")

		// Everything the dialog needed is in place, and the row is on screen — the ask this counts
		// from is the one the opening already made.
		const askedOnOpening = getOnboardingTasks.mock.calls.length
		expect(askedOnOpening).toBeGreaterThan(0)

		await act(async () => {
			fireEvent.click(screen.getByText(START))
		})

		expect(getOnboardingTasks.mock.calls.length).toBe(askedOnOpening + 1)
	})

	it("asks once more from the quiet exit, which is where the card is waiting", async () => {
		await mountWithConversationEndingAt("finished")

		const askedOnOpening = getOnboardingTasks.mock.calls.length

		await act(async () => {
			fireEvent.click(screen.getByText(LATER))
		})

		// "稍后再说" closes the dialog and leaves the user where they were — looking at the task
		// centre's own row for this task. It is the exit that most needs the fresh answer.
		expect(getOnboardingTasks.mock.calls.length).toBe(askedOnOpening + 1)
	})
})

/**
 * A namespace is a file, and the wrong one is silent rather than empty: `t` hands back the key it
 * was given, so the dialog draws `homeOnboarding.firstWork.title` and nothing anywhere complains.
 * The namespace is therefore taken from the dialog itself and then used to open the file, so the two
 * can only agree by being the same thing — which is how the tour's own file was found to be
 * `super/guideTour` rather than the `super` the first draft asked for.
 */
describe("where its words come from", () => {
	it("takes every word from the file its namespace names", async () => {
		await mountDialog()

		expect(namespaces).toEqual(["super/guideTour"])

		const problems: string[] = []

		for (const locale of ["zh_CN", "en_US"]) {
			const filePath = path.resolve(
				process.cwd(),
				`src/assets/locales/${locale}/${namespaces[0]}.json`,
			)
			const words = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown

			for (const key of DRAWN_KEYS) {
				if (typeof readKey(words, key) !== "string")
					problems.push(`${locale} has no ${key}`)
			}

			// The figure is filled in at render time, so a translation that drops the placeholder
			// would leave a bare "+ 积分" — readable, and wrong in a way only this check sees.
			if (!String(readKey(words, POINTS)).includes("{{points}}")) {
				problems.push(`${locale} dropped the placeholder from ${POINTS}`)
			}
		}

		expect(problems).toEqual([])
	})
})

/** Walks a dot path through a locale, the way `t` does. */
function readKey(locale: unknown, key: string): unknown {
	return key.split(".").reduce<unknown>((node, segment) => {
		if (node == null || typeof node !== "object") return undefined
		return (node as Record<string, unknown>)[segment]
	}, locale)
}

function pointsLabel(points: number) {
	return `homeOnboarding.firstWork.points:${JSON.stringify({ points })}`
}
