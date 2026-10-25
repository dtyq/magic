import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Loader2, RotateCcw } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Label } from "@/components/shadcn-ui/label"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useInterviewChat } from "../hooks/useInterviewChat"
import type { InterviewChatSend } from "../services/interviewChat"
import type { InterviewFile } from "../types"
import PersonaAvatar from "./PersonaAvatar"

interface InterviewConversationProps {
	transcript: InterviewFile
	name: string
	isMobile: boolean
	onSend: InterviewChatSend
	onShowProgress: () => void
	children: ReactNode
}

/** The viewport owns reading position; the composer is its sibling so it never covers an answer. */
function InterviewConversation({
	transcript,
	name,
	isMobile,
	onSend,
	onShowProgress,
	children,
}: InterviewConversationProps) {
	const { t } = useTranslation("personaResearch")
	const chat = useInterviewChat(transcript, onSend)
	const viewport = useRef<HTMLDivElement>(null)
	const inputFrame = useRef<HTMLDivElement>(null)
	const nearBottom = useRef(true)
	const sending = useRef(false)
	const lastContent = useRef("")
	const [hasNew, setHasNew] = useState(false)
	useLayoutEffect(() => {
		const node = viewport.current
		if (!node) return
		try {
			const saved = sessionStorage.getItem(`${chat.storageKey}/scroll`)
			if (saved !== null && Number.isFinite(Number(saved))) {
				node.scrollTop = Number(saved)
				nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64
			}
		} catch {
			/* Reading position is optional when browser storage is unavailable. */
		}
		return () => {
			try {
				sessionStorage.setItem(`${chat.storageKey}/scroll`, String(node.scrollTop))
			} catch {
				/* Keep the in-memory conversation usable. */
			}
		}
	}, [chat.storageKey])
	const scrollToBottom = () => {
		const node = viewport.current
		if (node) node.scrollTop = node.scrollHeight
		nearBottom.current = true
		setHasNew(false)
	}
	const contentKey = `${transcript.rounds.length}:${chat.pending?.id ?? ""}:${chat.status}`
	useLayoutEffect(() => {
		if (lastContent.current === contentKey) return
		if (nearBottom.current || sending.current) scrollToBottom()
		else if (lastContent.current) setHasNew(true)
		sending.current = false
		lastContent.current = contentKey
	}, [contentKey])
	useLayoutEffect(() => {
		// The shared Textarea is a function component in React 18; measure its native input through the frame.
		const node = inputFrame.current?.querySelector("textarea")
		if (!node) return
		node.style.height = "auto"
		node.style.height = `${Math.min(node.scrollHeight, 120)}px`
	}, [chat.draft])
	const submit = () => {
		if (chat.submitting || (chat.pending && !chat.canRetry)) return
		sending.current = true
		void chat.send()
	}
	const blocked = Boolean(chat.pending) && !chat.canRetry
	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<ScrollArea
				viewportRef={viewport}
				className="min-h-0 flex-1"
				onScrollCapture={() => {
					const node = viewport.current
					if (!node) return
					nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64
					if (nearBottom.current) setHasNew(false)
				}}
			>
				<div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 pb-6 pt-6">
					{children}
					{chat.pending ? (
						<div className="flex flex-col gap-3" aria-live="polite">
							<div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
								<span className="text-xs text-muted-foreground">
									{t("interviewChat.you")}
								</span>
								<p className="whitespace-pre-wrap break-words rounded-[16px_4px_16px_16px] bg-muted px-4 py-2.5 text-sm leading-6">
									{chat.pending.question}
								</p>
							</div>
							<div className="flex items-start gap-2.5">
								<PersonaAvatar
									id={transcript.persona_id}
									name={name}
									className="size-8"
								/>
								<div className="flex min-w-0 flex-col gap-1 py-1 text-xs text-muted-foreground">
									<span>{name}</span>
									<span className="flex items-center gap-1.5">
										{chat.status === "processing" ||
										chat.status === "sending" ? (
											<Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
										) : null}
										{chat.status === "sending"
											? t("interviewChat.sending")
											: chat.status === "failed"
												? t("interviewChat.failed")
												: chat.status === "queued"
													? t("interviewChat.queued")
													: chat.status === "processing"
														? t("interviewChat.processing")
														: t("interviewChat.unrecorded")}
									</span>
									<Button
										variant="link"
										size="sm"
										className="h-auto justify-start p-0 text-xs"
										onClick={chat.canRetry ? submit : onShowProgress}
									>
										{chat.canRetry
											? t("interviewChat.retry")
											: t("interviewChat.showProgress")}
									</Button>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</ScrollArea>
			<div className="relative shrink-0 border-t border-border bg-background px-4 pb-3 pt-3">
				{hasNew ? (
					<Button
						variant="secondary"
						size="sm"
						className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 gap-1.5 rounded-full shadow-sm"
						onClick={scrollToBottom}
					>
						<ArrowDown className="size-4" />
						{t("interviewChat.newReply")}
					</Button>
				) : null}
				<div className="mx-auto max-w-3xl">
					{transcript.insights_outdated ? (
						<p className="mb-2 text-xs text-muted-foreground">
							{t("interviewChat.reportUnchanged")}
						</p>
					) : null}
					<div
						ref={inputFrame}
						className="rounded-xl border border-border px-3 py-2.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
					>
						<Label
							htmlFor={`interview-input-${transcript.persona_id}`}
							className="mb-1 block text-xs font-medium"
						>
							{t("interviewChat.label", { name })}
						</Label>
						<Textarea
							id={`interview-input-${transcript.persona_id}`}
							value={chat.draft}
							onChange={(event) => chat.setDraft(event.target.value)}
							placeholder={t("interviewChat.placeholder", { name })}
							rows={2}
							maxLength={4000}
							className="block min-h-12 w-full resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
							onKeyDown={(event) => {
								if (
									event.key !== "Enter" ||
									event.shiftKey ||
									isMobile ||
									event.nativeEvent.isComposing ||
									event.keyCode === 229
								)
									return
								event.preventDefault()
								if (chat.draft.trim() && !blocked) submit()
							}}
						/>
						<div className="mt-1 flex items-center justify-between gap-2">
							<span className="text-[11px] text-muted-foreground">
								{isMobile
									? t("interviewChat.aiNote")
									: t("interviewChat.keyboardHint")}
							</span>
							<Button
								size="icon"
								className="size-8 shrink-0 rounded-lg"
								disabled={
									chat.submitting ||
									blocked ||
									(!chat.pending && !chat.draft.trim())
								}
								aria-label={
									chat.canRetry
										? t("interviewChat.retry")
										: t("interviewChat.send")
								}
								onClick={submit}
							>
								{chat.submitting ? (
									<Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
								) : chat.canRetry ? (
									<RotateCcw className="size-4" />
								) : (
									<ArrowUp className="size-4" />
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default observer(InterviewConversation)
