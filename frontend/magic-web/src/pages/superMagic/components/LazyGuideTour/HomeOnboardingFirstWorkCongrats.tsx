import { observer } from "mobx-react-lite"
import { reaction } from "mobx"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router"
import { X } from "lucide-react"
import { useNavigateToSuperHome } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useNavigateToSuperHome"
import { canRenderFinalAttachments } from "@/pages/superMagic/components/MessageList/message-render-contract"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { topicStore } from "@/pages/superMagic/stores/core"
import { projectVisibleMessagesByRevokedTail } from "@/pages/superMagic/utils/project-visible-messages-by-revoked-tail"
import { analyticsService } from "@/services/analytics"
import {
	HOME_ONBOARDING_RUN_EVENT,
	HOME_ONBOARDING_STATE_EVENT,
	getHomeOnboardingRewardList,
	hasHomeOnboardingTasks,
	HOME_ONBOARDING_TASK_CODE,
	isHomeOnboardingFirstWorkCongratsSpent,
	isHomeOnboardingRunBlocking,
	refreshHomeOnboardingRewardList,
	spendHomeOnboardingFirstWorkCongrats,
} from "./GuideTourManager"

interface HomeOnboardingFirstWorkCongratsProps {
	/**
	 * Whose congratulations these are. Handed in rather than read here, because the account is
	 * already known one level up, in the gate that decides whether this feature exists at all for
	 * this deployment, this organization and this client.
	 */
	userMagicId: string
}

/**
 * Which topic this page is on: the one the route names, with the store's selection as the fallback.
 *
 * Resolved by id rather than taken from `selectedTopic` alone, because the two do not have to agree.
 * The selection is whatever the last navigation left in the store, and the status the page's own
 * convergence writes reaches the selected topic *only when it is this one* — `TopicStore.
 * updateTopicStatus` writes the list entry either way, and skips `selectedTopic` when the ids differ.
 * A dialog that read the selection alone would therefore be reading a topic the page is not on, and
 * miss the ending written to the one it is. Asking for the topic the route names is asking about the
 * page this dialog belongs to.
 *
 * Both sources are live: `topics` is a deeply observable array in a `makeAutoObservable` store, so a
 * status written to the list entry is audible to the watch below for the same reason the selected
 * topic's own field is — and a list that has not been filled in yet simply leaves the fallback in
 * place.
 */
function readPageTopic(topicId?: string): Topic | undefined {
	const declared = topicId ? topicStore.topics.find((topic) => topic.id === topicId) : undefined
	return declared ?? topicStore.selectedTopic ?? undefined
}

/**
 * What the *topic itself* says about its execution — the page's own answer, and the one asked first.
 *
 * `task_status` is the topic's own field rather than a reading of any of its messages, and on this
 * page it is kept current by the page's own convergence path: `TopicPage`'s arrived-message handler
 * writes it the moment an assistant message carrying a terminal status is committed
 * (`handleArrivedTopicStatusChange` → `SuperMagicService.topic.updateTopicStatus`), and entering the
 * topic reconciles it against the backend's own status (`syncTopicStatusPatch`). It is also the field
 * the workspace's topic list draws its state from, which is what makes it the app's word for "this
 * topic has finished" rather than one consumer's reading of it.
 *
 * Read *live* by the watch below, and it notifies when it moves: the field hangs off an observable
 * object whichever of the two homes above it is read from — `selectedTopic`, or an entry of the
 * `topics` list, both deeply observable in a `makeAutoObservable` store — so the store's own write
 * paths (`updateTopicStatus` in place, on either, and `mergeTopic`'s whole-object replacement) all
 * reach the reaction. Unlike a row of `superMagicStore.messageMap`, whose value is not observable at
 * all.
 *
 * `status` is the legacy alias beside it, read only when the newer field says nothing, in the order
 * `topicStatusSyncService` resolves the same pair.
 */
function readTopicTaskStatus(topic: Topic | undefined): string | undefined {
	const status = topic?.task_status || topic?.status
	return status ? String(status) : undefined
}

/**
 * Whether the turn the page is looking at delivered a task — the app's own word for the work having
 * been handed over, and the one the user is actually shown: `finish_task` is what the agent calls
 * when it has a result, and the message list decides whether that result counts as the task's
 * delivery with the very predicate used here (`canRenderFinalAttachments`, the contract that also
 * gates the delivery's attachment block).
 *
 * Deliberately narrower than "a tool finished": a tool that ran says nothing about whether the work
 * did, which is why the tail below skips tool messages entirely. This asks the other question — not
 * what the *status* is, but whether this turn produced a *delivery*, which is the moment the user
 * sees the task's completion.
 *
 * Read over the current turn alone — back to the user's own last message — so a delivery from an
 * earlier turn cannot answer for this one, and so the scan is bounded by the turn rather than by the
 * topic's length.
 */
function readTurnDeliveredTask(messages: SuperMagicMessageItem[]): boolean {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index]
		if (message?.role === "user") return false
		/*
		 * Both projections are asked, because the app asks this question in both places and
		 * neither reading contains the other: the message list's projection keeps a Tool row at
		 * all on the strength of the *raw* row's payload, while `AttachmentSection` decides
		 * whether that row's delivery block renders on the strength of the *canonical* node. A
		 * delivery that lands while the row is still a raw projection is therefore answered for
		 * by the second, and one whose node has already been written by the first — and asking
		 * only one of them would make the whole answer depend on which projection the store
		 * happened to have got to.
		 *
		 * The node is widened the way `AttachmentSection` widens it: what the contract reads is
		 * whichever of these fields the projection happens to carry, and the store's own node type
		 * is not the shape the predicate is written against.
		 */
		const node = superMagicStore.getMessageNode(message?.super_message_id) as
			Record<string, unknown> | undefined
		if (canRenderFinalAttachments(node) || canRenderFinalAttachments(message)) return true
	}
	return false
}

/**
 * Whether the page's work has ended, from the three answers the app keeps for it — one projection of
 * the conversation, one pass of subscriptions, and the first answer asked before the expensive ones.
 *
 * **The three answers, and why one of them is not enough.**
 *
 * 1. *The topic's own status*, above: the page's own convergence on it, and the field the topic list
 *    draws its state from. Asked first because it is the only one that is both the app's verdict and
 *    free to ask.
 * 2. *The conversation's tail*, read the way the rest of the workspace reads it: the node behind the
 *    last assistant message answers first, because it is the live field the store's merge writes the
 *    item's `superStatus` from and the item is the fallback for a conversation that arrived without
 *    one. 加载与阅读进度也使用此回退；工具消息不能作为任务结束的判定依据。
 * 3. *The turn having delivered a task*, above.
 *
 * Each of them can lag the others — the store ships a convergence service for the states where the
 * messages have reached a terminal status while the topic still reads `running`, and for a topic the
 * backend already calls finished whose last message has not been projected with that status yet — so
 * the ending is claimed when *any* of them says so. That is what lets the congratulation open on the
 * moment the user is shown as being done, rather than on one particular projection of it having
 * caught up. `error` and `suspended` are the same topic telling the user that something went wrong
 * and `waiting_for_user` is not an ending at all — the topic has handed control back and may be
 * about to carry on — so none of the three is read as one: only `finished` is an ending here.
 *
 * **The subscription pass in the middle is what makes any of it hearable.** The node behind a
 * message is a plain object: `messageMap` is observable through its *entries*, not through its
 * values, so the store's own live path writes a status *onto the object it already holds* rather than
 * replacing it — that is what `setAssistantMessageNode` does, and what `syncAssistantCardProjection`
 * then does to the list row behind it — and an in-place write notifies nobody. The store's two
 * counters are the narrow answer it publishes for exactly that, read through its accessors the way
 * every other row consumer reads them (`VirtualMessageList` calls the row revision "the row's only
 * Store subscription"): the membership counter moves whenever the topic's list is replaced, and a
 * row's own counter whenever its canonical node is written, in place or not. Every row either reading
 * below looks at is subscribed to here. They are read for the subscription and dropped — what the
 * reaction compares is the status that is reported, so a row that moved without arriving anywhere
 * asks nothing of the dialog.
 *
 * The answer is a plain string so that comparison is by value: a reader that returned an object would
 * be a new object on every tick, and the reaction would fire with it.
 */
function readTopicEnding(topicId?: string): string | undefined {
	const topic = readPageTopic(topicId)
	const taskStatus = readTopicTaskStatus(topic)
	if (taskStatus === TaskStatus.FINISHED) return TaskStatus.FINISHED

	const chatTopicId = topic?.chat_topic_id || ""
	const messages = projectVisibleMessagesByRevokedTail(
		(superMagicStore.messages?.get(chatTopicId) || []) as SuperMagicMessageItem[],
	)
	const lastAssistant = messages.findLast((message) => message?.role === "assistant")

	void superMagicStore.getTopicMessageMembershipRevision(chatTopicId)
	void superMagicStore.getMessageRevision(chatTopicId, lastAssistant?.super_message_id)
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		void superMagicStore.getMessageRevision(chatTopicId, messages[index]?.super_message_id)
		if (messages[index]?.role === "user") break
	}

	const nodeStatus = superMagicStore.getMessageNode(lastAssistant?.super_message_id)?.status
	const tailStatus = nodeStatus ?? lastAssistant?.superStatus
	if (tailStatus === TaskStatus.FINISHED) return TaskStatus.FINISHED

	if (readTurnDeliveredTask(messages)) return TaskStatus.FINISHED

	return taskStatus ?? (tailStatus == null ? undefined : String(tailStatus))
}

/**
 * The congratulations a new account gets the first time one of its topics finishes.
 *
 * **What opens it.** *The topic the page is on having ended*, read rather than listened to, and asked
 * of the topic itself first: the page's topic carries its execution status in its own `task_status`,
 * which the page's arrived-message handler writes and the backend reconciles, so `finished` there is
 * the app's own word for "this topic is done" rather than one consumer's reading of one of its
 * messages. The conversation's tail is the second answer for the same question, and the turn's own
 * delivery — a `finish_task` the message list renders as the task's result — is the third, for the
 * states where neither status has caught up with a result the user can already see (see
 * `readTopicEnding`). A verdict that needs one particular projection to have arrived is a verdict
 * that misses the moment it exists for, which is what this dialog had been waiting on.
 *
 * Reading the state instead of waiting to be told about it is the point, and the reason this was
 * rebuilt. The store's end-of-execution event is a *notification*: it is raised once, at the moment
 * the status lands, and it reaches only whoever was already asking — so a page opened a moment later
 * never hears it, and a topic whose ending arrives as part of the history it hydrates is deliberately
 * silent about it (`eventPolicy: "silent_hydration"`). Either way the dialog simply never opened,
 * while the status sat in the stores the whole time.
 *
 * **The three answers it needs before it opens.** The account has to still be a new one, which is the
 * backend's task list rather than anything local (`hasHomeOnboardingTasks`: the list arrived, and it
 * carries something) — the same test the delivered-file tour makes, for the same reason. This
 * browser must not have congratulated this account already, which is the one-shot flag below. And no
 * guided run may be on screen: a run owns the whole window for its own reasons, and a dialog landing
 * on top of one would be two overlays fighting over the same moment.
 *
 * All three are asked again from scratch every time anything changes, rather than decided once when
 * the topic ends. That is what lets a run be waited out instead of declined: the moment is still
 * owed, the topic is still finished, and the run giving the screen back is simply another moment to
 * ask again — as is the backend's list landing after the work was already done.
 *
 * **What it is spent by.** Being shown, not being answered, and it is written before the first paint
 * of the dialog for the reason the introduction dialog writes its own flag the same way: coming back
 * to a reload with the dialog still up has shown it just as much as clicking it away has, and the
 * write must win the race against either exit. Being spent is also what makes asking repeatedly
 * harmless: the answers above can only open it once.
 *
 * **What it deliberately does not do.** It does not complete the AI-work task. That one the backend
 * finishes by itself — the client's own claim path skips it on purpose — so the only thing left for
 * this side to do is ask the list again, which keeps the benefits card honest about the row this
 * dialog has just congratulated.
 *
 * The dialog is drawn by hand rather than through the anchored tour: it has no anchor, it belongs to
 * the moment rather than to a part of the page, and the tour's own two centred dialogs are its
 * siblings in style rather than in machinery.
 *
 * It leaves the module *lazily*, the way the tour does, because of where it is mounted: the gate is
 * mounted by every page, and this file reaches the workspace services for its one navigation. An
 * eager import would put all of that — and the i18n instance behind it — into the graph of the
 * benefits card and of every other module that asks the gate for anything.
 */
const HomeOnboardingFirstWorkCongrats = observer(function HomeOnboardingFirstWorkCongrats({
	userMagicId,
}: HomeOnboardingFirstWorkCongratsProps) {
	/*
	 * The tour's own namespace, which is the file the strings beside it live in. "super" is a
	 * different file — the workspace's general strings — and asking it for `homeOnboarding.*`
	 * silently hands back the key itself.
	 */
	const { t } = useTranslation("super/guideTour")
	const { projectId, topicId } = useParams()
	const { navigateToSuperHome } = useNavigateToSuperHome()
	const [shown, setShown] = useState(false)
	const exposureReported = useRef(false)
	/**
	 * The figure the congratulations carry, taken at the moment they are earned.
	 *
	 * Held rather than read at render time because the refresh below throws the cached rows away
	 * before it asks for them again, and the dialog is on screen while that is in flight: reading it
	 * off the list in the render body would draw the badge from whatever the second answer had
	 * arrived with, which is nothing at all until it does.
	 */
	const [points, setPoints] = useState<number | undefined>(undefined)

	/*
	 * The project page is the route that carries both ids, and it is the only page this dialog
	 * belongs to. Nothing else is required of the page here: the topic, its status and its
	 * conversation are all read out of the stores as the watch below runs, so a topic that arrives
	 * — or finishes — after this effect has already run is still seen, and one that never arrives
	 * simply goes on reading as unfinished.
	 */
	const onProjectPage = Boolean(projectId && topicId)

	useEffect(() => {
		if (!onProjectPage) return

		/**
		 * Whether the moment is owed, asked from scratch — the topic, the backend's list and the run
		 * are all read here rather than remembered. Asking repeatedly is safe because being shown is
		 * what spends it.
		 *
		 * The topic is read *through the same call the watch below is keyed on*, and with the same
		 * id: the answer that fired the reaction and the answer that decides are then the same
		 * answer, rather than one being about the topic the route names and the other about whatever
		 * the store has selected.
		 */
		const openIfEarned = () => {
			/*
			 * `finished` is a topic that stopped well, which is the whole of what there is to
			 * congratulate. `error` and `suspended` are the same topic telling the user that
			 * something went wrong, and `waiting_for_user` is not an ending at all — the topic has
			 * handed control back and may be about to carry on.
			 */
			if (readTopicEnding(topicId) !== TaskStatus.FINISHED) return
			if (isHomeOnboardingFirstWorkCongratsSpent(userMagicId)) return
			if (!hasHomeOnboardingTasks(userMagicId)) return
			if (isHomeOnboardingRunBlocking()) return

			/*
			 * The figure is the backend's for the task just finished, read off the reward row
			 * rather than written down here: the row is the same one the benefits card draws its
			 * own totals from, and a second copy of the number is a second thing to keep in step.
			 * A list that has not carried the row leaves the badge off rather than guessing at it.
			 *
			 * Read before the list is asked for again, and before the dialog is on screen — see
			 * `points` above for why the order matters.
			 */
			setPoints(
				getHomeOnboardingRewardList(userMagicId).rewards.find(
					(row) => row.code === HOME_ONBOARDING_TASK_CODE["first-ai-work"],
				)?.points,
			)
			spendHomeOnboardingFirstWorkCongrats(userMagicId)
			void refreshHomeOnboardingRewardList(userMagicId)
			setShown(true)
		}

		/*
		 * The page's topic is watched rather than listened to: a reaction over the two things that
		 * answer for its ending — the topic's own status, which the page itself converges, and the
		 * status its conversation came to rest on (see `readTopicEnding`) — which answers for a topic
		 * that finishes while the page is up, and, because it is asked immediately, for one that had
		 * already finished before the page got here.
		 *
		 * The topic is the one the route names rather than the store's current selection, and the
		 * route's id is what the read is keyed on — a topic the page walks away from and back to is
		 * then asked about again, rather than answered for out of a selection that moved on.
		 *
		 * The two events are the other half of the same question, and they are not about the topic
		 * at all: the ending can already be the finished one while what changed is one of the reasons
		 * not to open yet. The backend's list landing is the first, and a guided run giving the
		 * screen back is the second — neither of them moves the topic, so nothing would ask again
		 * without them.
		 */
		const stopWatchingConversation = reaction(() => readTopicEnding(topicId), openIfEarned, {
			fireImmediately: true,
		})
		window.addEventListener(HOME_ONBOARDING_STATE_EVENT, openIfEarned)
		window.addEventListener(HOME_ONBOARDING_RUN_EVENT, openIfEarned)
		return () => {
			stopWatchingConversation()
			window.removeEventListener(HOME_ONBOARDING_STATE_EVENT, openIfEarned)
			window.removeEventListener(HOME_ONBOARDING_RUN_EVENT, openIfEarned)
		}
	}, [onProjectPage, topicId, userMagicId])

	useEffect(() => {
		if (!shown || exposureReported.current) return
		exposureReported.current = true
		/*
		 * `shown` is set only after the dialog's opening conditions pass. Reporting from this effect
		 * waits for React to commit that visible state, and the amount is the same backend value drawn
		 * in the reward card rather than a second client-side constant.
		 */
		analyticsService.report("onboarding_reward_popup_exposure", { pointsAmount: points })
	}, [points, shown])

	if (!shown) return null

	/**
	 * Asking the backend for the account's progress once more, as the dialog is acted on.
	 *
	 * The list is already asked for when these congratulations open, but that ask happens at the
	 * instant the work is *reported* finished — the backend is still settling its own verdict at
	 * that moment, and this one task it completes by itself rather than on request. A list that
	 * came back with the row still pending would then be the last word for the rest of the visit,
	 * because a settled list is never asked for again on its own (`ensureHomeOnboardingRewardList`).
	 * Acting on the dialog is the other end of the same moment: whatever the user does next, the
	 * first AI work is behind them, and the task centre they land on has to say so. Both exits ask,
	 * including the quiet one — the dialog is spent either way, and the card behind it is not.
	 */
	const askForFreshProgress = () => {
		void refreshHomeOnboardingRewardList(userMagicId)
	}

	const close = (action: "later" | "close") => {
		analyticsService.report("onboarding_reward_popup_click", { action })
		askForFreshProgress()
		setShown(false)
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[1200] text-foreground"
			role="dialog"
			aria-modal="true"
			aria-label={t("homeOnboarding.firstWork.title")}
		>
			<div className="absolute inset-0 bg-[rgba(52,52,52,0.62)]" />
			<section className="fixed left-1/2 top-1/2 max-h-[calc(100vh-34px)] w-[min(560px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[16px] border border-border bg-background px-11 pb-9 pt-11 text-left shadow-[0_1px_2px_rgba(0,0,0,0.08),0_16px_42px_rgba(0,0,0,0.14)] max-[760px]:w-[calc(100vw-24px)] max-[760px]:px-6 max-[760px]:pb-6 max-[760px]:pt-7">
				<button
					className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:border hover:border-border hover:bg-muted hover:text-foreground"
					type="button"
					onClick={() => close("close")}
					aria-label={t("homeOnboarding.firstWork.close")}
				>
					<X className="size-4" strokeWidth={1.8} />
				</button>
				<h2 className="pr-12 text-[30px] font-bold leading-tight tracking-[-0.03em] max-[760px]:text-2xl">
					{t("homeOnboarding.firstWork.title")}
				</h2>
				<div className="mt-6 flex items-center gap-4 rounded-[14px] bg-[#f5f5f5] px-5 py-6">
					<span className="min-w-0 flex-1">
						<strong className="block text-[16px] font-bold leading-tight">
							{t("homeOnboarding.firstWork.card.title")}
						</strong>
						<small className="mt-2 block text-[13px] leading-[1.5] text-muted-foreground">
							{t("homeOnboarding.firstWork.card.description")}
						</small>
					</span>
					{points === undefined ? null : (
						<strong className="shrink-0 text-[18px] font-bold text-[#21a66a]">
							{t("homeOnboarding.firstWork.points", { points })}
						</strong>
					)}
				</div>
				<div className="mt-7 flex w-full flex-col items-stretch gap-3.5">
					{/*
					 * The primary action leaves for the workspace rather than closing in place: the
					 * task is finished, and the dialog's whole offer is the next one.
					 *
					 * `text-[13px]` is what the design draws and what the welcome dialog uses for the
					 * same button; at 18px the label stood larger than the card title above it, where
					 * the design has it as the quietest of the three.
					 */}
					<button
						className="h-11 min-h-11 w-full rounded-[10px] border border-foreground bg-foreground px-4 text-[13px] font-semibold text-background hover:bg-[#2b2b2b]"
						type="button"
						onClick={() => {
							analyticsService.report("onboarding_reward_popup_click", {
								action: "start_new_task",
							})
							askForFreshProgress()
							setShown(false)
							navigateToSuperHome()
						}}
					>
						{t("homeOnboarding.firstWork.actions.start")}
					</button>
					<button
						className="min-h-11 self-center px-3 py-1.5 text-[15px] text-muted-foreground hover:text-foreground"
						type="button"
						onClick={() => close("later")}
					>
						{t("homeOnboarding.firstWork.actions.later")}
					</button>
				</div>
			</section>
		</div>,
		document.body,
	)
})

export default HomeOnboardingFirstWorkCongrats
