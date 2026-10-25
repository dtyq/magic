import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { CircleAlert, Sparkles } from "lucide-react"
import { observer } from "mobx-react-lite"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/shadcn-ui/sheet"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { useIsMobile } from "@/hooks/useIsMobile"
import { usePersonaResearchStore } from "../context"
import { useResearchEditor } from "../hooks/useResearchEditor"
import ResearchConversationPanel, {
	type ResearchConversationPanelRef,
} from "./ResearchConversationPanel"

export interface ResearchChatIntro {
	title: string
	text: string
	tips: { icon: ComponentType<{ className?: string }>; text: string }[]
	/** Composer text when the sheet opens, e.g. "Build personas only from …". */
	prompt: string
	disclaimer: string
	/** Composer placeholder; defaults to the research question prompt. */
	placeholder?: string
	/** Own draft slot, so text typed here never shows up in another research composer. */
	draftSlot: string
}

interface ResearchChatSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	intro: ResearchChatIntro
	/** Header action once the conversation has started, e.g. "open in studio". */
	headerAction?: (topic: Topic) => ReactNode
	/** Positive feedback under the conversation, e.g. the personas saved so far. */
	footer?: ReactNode
	/**
	 * Controlled conversation: pass the topic to reopen an earlier conversation, and receive the
	 * new one once the first message is sent. Left out, every opening starts a new conversation.
	 */
	topic?: Topic | null
	/** New conversation started; `firstMessage` is what was sent, as editor content. */
	onTopicChange?: (topic: Topic, firstMessage?: JSONContent) => void
	/**
	 * A reopened conversation whose first message never reached the AI: shows `notice` and puts
	 * `content` back in the composer so one click sends it again.
	 */
	resend?: { notice: string; content: string | JSONContent }
}

/** How long to keep trying to refill the composer while the reopened conversation mounts. */
const REFILL_ATTEMPTS = 20
const REFILL_INTERVAL_MS = 250

/**
 * A side conversation for library work (building personas, creating report templates) that
 * keeps the library in view.
 *
 * Before the first message the sheet shows its intro and a prefilled composer; sending creates
 * a research topic exactly like the research home, then the shared conversation panel takes over.
 * Every opening starts a new conversation unless the caller passes `topic` to reopen one.
 */
function ResearchChatSheet({
	open,
	onOpenChange,
	title,
	intro,
	headerAction,
	footer,
	topic: controlledTopic,
	onTopicChange,
	resend,
}: ResearchChatSheetProps) {
	const isMobile = useIsMobile()
	const [ownTopic, setOwnTopic] = useState<Topic | null>(null)
	const topic = controlledTopic === undefined ? ownTopic : controlledTopic
	const handleStarted = useMemoizedFn((started: Topic, firstMessage?: JSONContent) => {
		setOwnTopic(started)
		onTopicChange?.(started, firstMessage)
	})
	const panelRef = useRef<ResearchConversationPanelRef>(null)

	useEffect(() => {
		if (!open) setOwnTopic(null)
	}, [open])

	// The panel's editor mounts a moment after the panel; retry until it takes the content.
	// Fills once per opening: the topic status can flicker back to "queued" right after the
	// message is resent, and a second fill would put the old request back in the composer.
	const refilledTopicId = useRef<string | null>(null)
	const resendContent = open && topic ? resend?.content : undefined
	const topicId = topic ? String(topic.id) : null
	useEffect(() => {
		if (!open) refilledTopicId.current = null
	}, [open])
	useEffect(() => {
		if (!resendContent || !topicId || refilledTopicId.current === topicId) return
		let attempts = 0
		const timer = window.setInterval(() => {
			attempts += 1
			const filled = panelRef.current?.fillComposer(resendContent) ?? false
			if (filled) refilledTopicId.current = topicId
			if (filled || attempts >= REFILL_ATTEMPTS) window.clearInterval(timer)
		}, REFILL_INTERVAL_MS)
		return () => window.clearInterval(timer)
	}, [resendContent, topicId])

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side={isMobile ? "bottom" : "right"}
				className={
					isMobile
						? "flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0"
						: "flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
				}
			>
				<SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-border py-3 pl-4 pr-12">
					<SheetTitle className="flex-1 text-sm">{title}</SheetTitle>
					<SheetDescription className="sr-only">{intro.text}</SheetDescription>
					{topic && headerAction ? headerAction(topic) : null}
				</SheetHeader>
				<div className="flex min-h-0 flex-1 flex-col">
					{topic && resend ? (
						<p
							className="mx-3 mt-3 flex shrink-0 items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-400"
							role="status"
						>
							<CircleAlert className="mt-0.5 size-3.5 shrink-0" />
							{resend.notice}
						</p>
					) : null}
					{topic ? (
						<ResearchConversationPanel
							ref={panelRef}
							variant={isMobile ? "mobile" : "desktop"}
						/>
					) : (
						<ChatIntro intro={intro} onStarted={handleStarted} />
					)}
				</div>
				{footer}
			</SheetContent>
		</Sheet>
	)
}

/** First screen: what the AI can work from, and a composer prefilled with the request. */
const ChatIntro = observer(function ChatIntro({
	intro,
	onStarted,
}: {
	intro: ResearchChatIntro
	onStarted: (topic: Topic, firstMessage?: JSONContent) => void
}) {
	const store = usePersonaResearchStore()
	const isMobile = useIsMobile()
	const firstMessage = useRef<JSONContent | undefined>(undefined)
	const { editorContext, editorNodes, fillComposer } = useResearchEditor({
		variant: isMobile ? "mobile" : "desktop",
		selectedTopic: null,
		showLoading: false,
		messagesLength: 0,
		onSendContent: useMemoizedFn((value: JSONContent | undefined) => {
			firstMessage.current = value
		}),
		onStudyStarted: useMemoizedFn((topic: Topic) => onStarted(topic, firstMessage.current)),
		onEditorReady: useMemoizedFn(() => fillComposer(intro.prompt)),
	})
	const context = useMemo(
		() => ({
			...editorContext,
			placeholder: intro.placeholder ?? editorContext.placeholder,
			draftKey: editorContext.draftKey
				? { ...editorContext.draftKey, topicId: intro.draftSlot }
				: undefined,
		}),
		[editorContext, intro.draftSlot, intro.placeholder],
	)

	return (
		<>
			<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
				<div className="flex flex-col items-center px-8 py-10 text-center">
					<span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted">
						<Sparkles className="size-4" />
					</span>
					<div className="text-sm font-medium">{intro.title}</div>
					<p className="mt-1 max-w-[340px] text-xs leading-5 text-muted-foreground">
						{intro.text}
					</p>
					<ul className="mt-5 grid w-full max-w-[380px] gap-2 text-left">
						{intro.tips.map(({ icon: Icon, text }) => (
							<li
								key={text}
								className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
							>
								<Icon className="size-3.5 shrink-0" />
								{text}
							</li>
						))}
					</ul>
				</div>
			</ScrollArea>
			<div className="shrink-0 px-3 pb-3">
				{store.selectedProject ? (
					isMobile ? (
						<MobileInputContainer editorContext={context} editorNodes={editorNodes} />
					) : (
						<DefaultMessageEditorContainer
							editorContext={context}
							editorNodes={editorNodes}
						/>
					)
				) : null}
				<p className="mt-1.5 text-center text-[11px] text-muted-foreground">
					{intro.disclaimer}
				</p>
			</div>
		</>
	)
})

export default observer(ResearchChatSheet)
