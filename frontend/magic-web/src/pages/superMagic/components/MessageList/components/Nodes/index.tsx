import { default as RichText } from "./RichText"
import { default as Init } from "./Init"
import { default as Thinking } from "./Thinking"
import { default as AgentReply } from "./AgentReply"
import { default as ToolCall } from "./ToolCall"
import { default as TaskUpdate } from "./TaskUpdate"
import { default as ProjectArchive } from "./ProjectArchive"
import { default as Chat } from "./Chat"
import { default as Reminder } from "./Reminder"
import { default as AgentThink } from "./AgentThink"
import { default as MessageNode } from "./MessageNode"
import { memo, type CSSProperties } from "react"
import { SuperMagicMessageType } from "@/pages/superMagic/components/MessageList/type"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useTimeTooltip } from "./hooks/useTimeTooltip"
import { withNode, type WithNodeProps } from "./withNode"
import { cn } from "@/lib/utils"

export const NodeMap = {
	[SuperMagicMessageType.Reminder]: Reminder,
	[SuperMagicMessageType.RichText]: RichText,
	[SuperMagicMessageType.Chat]: Chat,
	[SuperMagicMessageType.Init]: Init,
	[SuperMagicMessageType.TaskUpdate]: TaskUpdate,
	[SuperMagicMessageType.Thinking]: Thinking,
	[SuperMagicMessageType.ToolCall]: ToolCall,
	[SuperMagicMessageType.ProjectArchive]: ProjectArchive,
	[SuperMagicMessageType.AgentReply]: AgentReply,
	[SuperMagicMessageType.AgentThink]: AgentThink,
}

type EntryAnimationVariant = "default" | "subtle" | "emphasis"

const nodeEntryVariantMap: Partial<Record<SuperMagicMessageType, EntryAnimationVariant>> = {
	[SuperMagicMessageType.ToolCall]: "subtle",
	[SuperMagicMessageType.Thinking]: "subtle",
	[SuperMagicMessageType.AgentThink]: "subtle",
	[SuperMagicMessageType.TaskUpdate]: "emphasis",
	[SuperMagicMessageType.Reminder]: "emphasis",
}

function NodeContent(props: WithNodeProps) {
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| Record<string, unknown>
		| undefined
	const textContent = typeof node?.content === "string" ? node.content : undefined
	const hasCopyableTextContent = Boolean(textContent?.trim())
	const isAssistantMessage = props?.node?.role === "assistant" || node?.role === "assistant"
	const enableCopyMessage =
		hasCopyableTextContent &&
		(node?.type === SuperMagicMessageType.AgentReply || (!node?.type && isAssistantMessage))
	const resolvedNodeType = node?.type as SuperMagicMessageType
	const AssistantNode = NodeMap?.[resolvedNodeType] || (() => <div />)
	const shouldAnimateEntry = Boolean(props.isNewlyInserted)
	const entryDelay = Math.min((props.entryAnimationOrder || 0) * 24, 96)
	const nodeType = (node?.type || props?.node?.type) as SuperMagicMessageType
	const entryVariant = nodeEntryVariantMap[nodeType] || "default"
	const entryAnimationClass = shouldAnimateEntry
		? entryVariant === "subtle"
			? "animate-super-magic-message-enter-subtle"
			: entryVariant === "emphasis"
				? "animate-super-magic-message-enter-emphasis"
				: "animate-super-magic-message-enter-default"
		: ""
	const entryClassName = cn(
		"w-full",
		"transform-gpu",
		entryAnimationClass,
		shouldAnimateEntry && "[animation-delay:var(--message-enter-delay)]",
		shouldAnimateEntry && "[will-change:opacity,transform]",
		"motion-reduce:animate-none",
	)
	const entryStyle = shouldAnimateEntry
		? ({ "--message-enter-delay": `${entryDelay}ms` } as CSSProperties)
		: undefined

	const { handleMouseEnter, handleMouseLeave, renderTooltip, renderCopyButton } = useTimeTooltip({
		timestamp: props?.node?.send_time,
		shouldShow: true,
		textContent,
		enableCopyMessage,
	})

	if (["rich_text"].includes(props?.node?.type)) {
		return (
			<div className={entryClassName} style={entryStyle}>
				<RichText {...props} />
			</div>
		)
	}

	if (!node?.type) {
		return (
			<>
				<div className={cn(entryClassName, "group relative")} style={entryStyle}>
					<MessageNode
						{...props}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
					/>
					{renderCopyButton()}
				</div>
				{renderTooltip()}
			</>
		)
	}

	return (
		<>
			<div className={cn(entryClassName, "group relative")} style={entryStyle}>
				<AssistantNode
					{...props}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
				/>
				{renderCopyButton()}
			</div>
			{renderTooltip()}
		</>
	)
}

export const Node = memo(withNode(observer(NodeContent)))

export { RichText, Init, Thinking, AgentReply, ToolCall, TaskUpdate, ProjectArchive, Chat }
