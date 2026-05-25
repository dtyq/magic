import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { memo, useCallback, type ComponentType, type MouseEvent } from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import TSIcon, { type IconParkIconElement } from "@/components/base/TSIcon"
import BotIcon from "@/components/business/MentionPanel/components/icons/BotIcon"
import PlugIcon from "@/components/business/MentionPanel/components/icons/PlugIcon"
import SkillIcon from "@/components/business/MentionPanel/components/icons/SkillIcon"
import ToolIcon from "@/components/business/MentionPanel/components/icons/ToolIcon"
import { useIsMobile } from "@/hooks/useIsMobile"
import { MentionItemType } from "../types"
import {
	getMentionDisplayName,
	getMentionIcon,
	type MentionPanelPluginOptions,
	type TiptapMentionAttributes,
} from "./types"

interface MentionNodeIconProps {
	type: TiptapMentionAttributes["type"]
	icon?: string
}

interface MentionNodeChipProps {
	attrs: TiptapMentionAttributes
	deleteNode?: () => void
}

const mentionIconImageClassNameMap: Partial<Record<string, string>> = {
	[MentionItemType.MCP]: "size-4 rounded object-cover",
	[MentionItemType.AGENT]: "size-4 rounded-full object-cover",
	[MentionItemType.SKILL]: "size-4 rounded object-cover",
	[MentionItemType.TOOL]: "size-4 rounded object-cover",
}

const mentionIconFallbackMap: Partial<Record<string, ComponentType<{ size: number }>>> = {
	[MentionItemType.MCP]: PlugIcon,
	[MentionItemType.AGENT]: BotIcon,
	[MentionItemType.SKILL]: SkillIcon,
	[MentionItemType.TOOL]: ToolIcon,
}

const MentionNodeIcon = memo(({ type, icon }: MentionNodeIconProps) => {
	if (type === MentionItemType.PROJECT_FILE || type === MentionItemType.UPLOAD_FILE)
		return <MagicFileIcon type={icon} size={16} />

	const imageClassName = mentionIconImageClassNameMap[type]
	if (icon && imageClassName) return <img src={icon} alt="" className={imageClassName} />

	const FallbackIcon = mentionIconFallbackMap[type]
	if (FallbackIcon) return <FallbackIcon size={16} />

	return <TSIcon type={icon as IconParkIconElement["name"]} size="16" radius={4} />
})

function MentionNodeChip({ attrs, deleteNode }: MentionNodeChipProps) {
	const displayName = getMentionDisplayName(attrs)
	const icon = getMentionIcon(attrs)

	const handleMouseDown = useCallback((event: MouseEvent) => {
		event.preventDefault()
	}, [])

	const handleRemove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			event.stopPropagation()
			deleteNode?.()
		},
		[deleteNode],
	)

	return (
		<span
			className="mb-1 inline-flex max-w-[220px] items-center gap-1 rounded-full bg-muted py-0.5 pl-2 pr-1 align-middle text-foreground"
			onMouseDown={handleMouseDown}
			data-testid="editor-mention-chip"
		>
			<span className="flex shrink-0">
				<MentionNodeIcon type={attrs.type} icon={icon} />
			</span>
			<span className="min-w-0 truncate text-sm" title={displayName}>
				{displayName}
			</span>
			<button
				type="button"
				className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
				onMouseDown={handleMouseDown}
				onClick={handleRemove}
				aria-label={`remove ${displayName}`}
				data-testid="editor-mention-chip-remove-button"
			>
				<TSIcon type="ts-close-line" size="14" />
			</button>
		</span>
	)
}

function MentionNodeView(props: ReactNodeViewProps) {
	const isMobile = useIsMobile()
	const attrs = props.node.attrs as TiptapMentionAttributes & {
		mentionSuggestionChar?: string
	}
	const options = props.extension.options as MentionPanelPluginOptions
	const Renderer = options.nodeViewRenderers?.[attrs.type as MentionItemType]

	if (Renderer) {
		return <Renderer {...props} attrs={attrs} />
	}

	return (
		<NodeViewWrapper
			as="span"
			className="magic-mention inline-flex px-0.5 align-middle"
			data-mention-suggestion-char={attrs.mentionSuggestionChar || "@"}
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			contentEditable={false}
		>
			{isMobile ? (
				<MentionNodeChip attrs={attrs} deleteNode={props.deleteNode} />
			) : (
				`@${getMentionDisplayName(attrs)}` +
				(attrs.type === MentionItemType.FOLDER ? "/" : "")
			)}
		</NodeViewWrapper>
	)
}

export default memo(MentionNodeView)
