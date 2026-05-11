import { memo, useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { NodeProps } from "../types"
import { defaultOpen } from "../ToolCall/config"
import { Node } from "../index"
import { getMessageNodeKey } from "../../../helpers"
import { SuperMagicMessageItem } from "../../../type"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { useDeepCompareEffect } from "ahooks"
import { reaction } from "mobx"
import { throttle } from "lodash-es"
import { useTranslation } from "react-i18next"
import { ReasoningPanel } from "../shared/ReasoningPanel"

export default memo(function AgentThink(props: NodeProps) {
	const { selectedTopic } = props
	const { t } = useTranslation("super")

	const [open, setOpen] = useState(defaultOpen)
	const scrollAreaRef = useRef<HTMLDivElement>(null)
	const viewportRef = useRef<HTMLElement | null>(null)
	const hasUserInteractedRef = useRef(false)
	const isProgrammaticScrollRef = useRef(false)

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| Record<string, unknown>
		| undefined
	const nodeEvent = typeof node?.event === "string" ? node.event : ""

	useEffect(() => {
		setOpen(nodeEvent === "before_agent_think")
	}, [nodeEvent])

	useEffect(() => {
		if (!open) return

		const viewportElement = scrollAreaRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		) as HTMLElement | null
		if (!viewportElement) return
		const viewport = viewportElement
		viewportRef.current = viewport

		function scrollToBottom({ behavior }: { behavior: ScrollBehavior }) {
			isProgrammaticScrollRef.current = true
			viewport.scrollTo({
				top: viewport.scrollHeight,
				behavior,
			})
			requestAnimationFrame(() => {
				isProgrammaticScrollRef.current = false
			})
		}

		hasUserInteractedRef.current = false
		requestAnimationFrame(() => scrollToBottom({ behavior: "auto" }))

		function markUserInteracted() {
			if (isProgrammaticScrollRef.current) return
			const distanceToBottom =
				viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
			hasUserInteractedRef.current = distanceToBottom > 10
		}

		viewport.addEventListener("wheel", markUserInteracted, { passive: true })
		viewport.addEventListener("touchstart", markUserInteracted, { passive: true })
		viewport.addEventListener("pointerdown", markUserInteracted, { passive: true })
		viewport.addEventListener("scroll", markUserInteracted, { passive: true })

		return () => {
			viewport.removeEventListener("wheel", markUserInteracted)
			viewport.removeEventListener("touchstart", markUserInteracted)
			viewport.removeEventListener("pointerdown", markUserInteracted)
			viewport.removeEventListener("scroll", markUserInteracted)
			viewportRef.current = null
		}
	}, [open])

	useDeepCompareEffect(() => {
		if (nodeEvent !== "before_agent_think") {
			return
		}

		const handleStreamingScroll = throttle(
			(streamingContent) => {
				if (
					streamingContent &&
					open &&
					nodeEvent === "before_agent_think" &&
					!hasUserInteractedRef.current
				) {
					const viewport = viewportRef.current
					if (!viewport) return

					isProgrammaticScrollRef.current = true
					viewport.scrollTo({
						top: viewport.scrollHeight,
						behavior: "auto",
					})
					requestAnimationFrame(() => {
						isProgrammaticScrollRef.current = false
					})
				}
			},
			100,
			{ leading: false, trailing: true },
		)

		// 订阅流式是否正在执行（正在流式时，触发判断消息列表是否需滚动到底部）
		const disposeReaction = reaction(() => {
			const messagesCache =
				superMagicStore.messages.get(selectedTopic?.chat_topic_id || "") || []
			const lastMessageNode = messagesCache?.[messagesCache.length - 1]
			if (!lastMessageNode?.event || lastMessageNode?.event?.indexOf("agent_reply") < 0) {
				return false
			}
			const replyNode = superMagicStore.messageMap.get(lastMessageNode?.app_message_id) as
				| Record<string, unknown>
				| undefined
			return typeof replyNode?.content === "string" ? replyNode.content : ""
		}, handleStreamingScroll)

		return () => {
			disposeReaction()
			handleStreamingScroll.cancel()
		}
	}, [nodeEvent, open])

	const isValidity = props?.node?.childMessages?.length > 0

	if (!isValidity) return null

	const isThinking = nodeEvent === "before_agent_think"

	return (
		<ReasoningPanel
			open={open}
			title={isThinking ? t("agentThink.thinking") : t("agentThink.thinkDone")}
			onToggle={() => setOpen((o) => !o)}
		>
			<div
				className={cn(
					"relative w-full rounded-b-md",
					"[&_[data-radix-scroll-area-viewport]>div]:!block",
					"[&_[data-radix-scroll-area-viewport]]:max-h-60",
					"[&_p]:leading-5",
					"[&_p>code]:!text-[11px] [&_p>code]:!leading-4",
					"[&_p>strong]:!text-[11px] [&_p>strong]:!leading-4",
					"[&_p>em]:!text-[11px] [&_p>em]:!leading-4",
					"[&_p>i]:!text-[11px] [&_p>i]:!leading-4",
				)}
			>
				<ScrollArea
					ref={scrollAreaRef}
					className="mx-[6px] mb-[6px] rounded-lg border-black/[0.08] bg-[#f5f6f7] dark:bg-white/10"
				>
					<div className="w-full">
						{props?.node?.childMessages?.map((o: SuperMagicMessageItem) => (
							<Node
								role={o?.role || "user"}
								key={getMessageNodeKey(o)}
								node={o}
								classNames={{
									card: "!p-0 after:!hidden after:!border-0",
									markdown: "text-muted-foreground text-xs font-normal leading-4",
								}}
								isFirst={false}
								checkIsLastMessage={() => false}
								selectedTopic={null}
								onSelectDetail={() => undefined}
								isSelected={false}
								onFileClick={() => undefined}
								isShare={false}
							/>
						))}
					</div>
					<ScrollBar orientation="vertical" />
				</ScrollArea>
			</div>
		</ReasoningPanel>
	)
})
