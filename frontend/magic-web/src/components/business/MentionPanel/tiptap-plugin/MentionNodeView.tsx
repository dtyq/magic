import { NodeViewWrapper, type ReactNodeViewProps } from "@/infrastructure/editors/tiptap/react"
import {
	Component,
	memo,
	useCallback,
	useEffect,
	type ComponentType,
	type MouseEvent,
	type ReactNode,
} from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import TSIcon, { type IconParkIconElement } from "@/components/base/TSIcon"
import BotIcon from "@/components/business/MentionPanel/components/icons/BotIcon"
import PlugIcon from "@/components/business/MentionPanel/components/icons/PlugIcon"
import SkillIcon from "@/components/business/MentionPanel/components/icons/SkillIcon"
import ToolIcon from "@/components/business/MentionPanel/components/icons/ToolIcon"
import MicroAppIcon from "@/components/business/MentionPanel/components/icons/MicroAppIcon"
import { useIsMobile } from "@/hooks/useIsMobile"
import { logger as Logger } from "@/infrastructure/logger"
import type { LocaleInput } from "../i18n"
import { MentionItemType, type ProjectMentionData } from "../types"
import {
	getMentionDisplayName,
	getMentionIcon,
	type MentionPanelPluginOptions,
	type TiptapMentionAttributes,
} from "./types"

const logger = Logger.createLogger("MentionNodeView")

interface MentionNodeViewErrorBoundaryState {
	hasError: boolean
}

class MentionNodeViewErrorBoundary extends Component<
	{ fallback: ReactNode; children: ReactNode },
	MentionNodeViewErrorBoundaryState
> {
	state: MentionNodeViewErrorBoundaryState = { hasError: false }

	static getDerivedStateFromError() {
		return { hasError: true }
	}

	componentDidCatch(error: unknown) {
		logger.error({
			eventKey: "mention_node_render_failed",
			errorKind: "render",
			error: error,
			message: "render error",
		})
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback
		}
		return this.props.children
	}
}

interface MentionNodeIconProps {
	type: TiptapMentionAttributes["type"]
	icon?: string
}

interface MentionNodeChipProps {
	attrs: TiptapMentionAttributes
	language?: LocaleInput
	deleteNode?: () => void
}

function isStaticResourceMention(type: TiptapMentionAttributes["type"]) {
	return (
		type === MentionItemType.PROJECT_FILE ||
		type === MentionItemType.USER_FILE ||
		type === MentionItemType.USER_DIRECTORY ||
		type === MentionItemType.UPLOAD_FILE ||
		type === MentionItemType.MEMORY_FILE ||
		type === MentionItemType.FOLDER ||
		type === MentionItemType.MEMORY_DIRECTORY
	)
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
	[MentionItemType.MICRO_APP]: MicroAppIcon,
}

function getMentionNodeDisplayName(attrs?: TiptapMentionAttributes, language?: LocaleInput) {
	if (!attrs) return "Unknown"

	if (attrs.type === MentionItemType.PROJECT) {
		return (
			(attrs.data as ProjectMentionData | undefined)?.project_name?.trim() ||
			getMentionDisplayName(attrs, language)
		)
	}

	return getMentionDisplayName(attrs, language)
}

const MentionNodeIcon = memo(({ type, icon }: MentionNodeIconProps) => {
	if (
		type === MentionItemType.FOLDER ||
		type === MentionItemType.MEMORY_DIRECTORY ||
		type === MentionItemType.USER_DIRECTORY
	) {
		return <TSIcon type="ts-folder" size="16" />
	}

	if (
		type === MentionItemType.PROJECT_FILE ||
		type === MentionItemType.USER_FILE ||
		type === MentionItemType.UPLOAD_FILE ||
		type === MentionItemType.MEMORY_FILE
	)
		return <MagicFileIcon type={icon} size={16} />

	const imageClassName = mentionIconImageClassNameMap[type]
	if (icon && imageClassName) return <img src={icon} alt="" className={imageClassName} />

	const FallbackIcon = mentionIconFallbackMap[type]
	if (FallbackIcon) return <FallbackIcon size={16} />

	return <TSIcon type={icon as IconParkIconElement["name"]} size="16" radius={4} />
})

function MentionNodeResource({ attrs, language }: Omit<MentionNodeChipProps, "deleteNode">) {
	const displayName = getMentionNodeDisplayName(attrs, language)
	const icon = getMentionIcon(attrs)

	return (
		<span className="inline-flex min-w-0 max-w-[220px] items-center gap-1 align-middle">
			<span className="flex shrink-0">
				<MentionNodeIcon type={attrs.type} icon={icon} />
			</span>
			<span className="min-w-0 truncate leading-[inherit]" title={displayName}>
				{displayName}
			</span>
		</span>
	)
}

function MentionNodeChip({ attrs, language, deleteNode }: MentionNodeChipProps) {
	const displayName = getMentionNodeDisplayName(attrs, language)
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

function MentionNodeViewFallback({
	attrs,
	language,
}: {
	attrs?: TiptapMentionAttributes
	language?: LocaleInput
}) {
	let displayName = "@"
	let isResourceMention = false
	let icon: string | undefined
	try {
		isResourceMention = Boolean(attrs && isStaticResourceMention(attrs.type))
		icon = attrs ? getMentionIcon(attrs) : undefined
		const name = getMentionNodeDisplayName(attrs, language)
		displayName = isResourceMention ? name : `@${name}`
	} catch {
		const data = attrs?.data as Record<string, unknown> | undefined
		displayName = `@${(data?.name as string) || (data?.file_name as string) || "..."}`
	}
	return (
		<NodeViewWrapper
			as="span"
			className={`magic-mention inline-flex cursor-grab px-0.5 align-middle active:cursor-grabbing${attrs?.pending ? " opacity-50" : ""}`}
			contentEditable={false}
			draggable
			data-magic-editor-node
		>
			{isResourceMention && attrs ? (
				<span className="inline-flex min-w-0 items-center gap-1">
					<MentionNodeIcon type={attrs.type} icon={icon} />
					<span className="min-w-0 truncate leading-[inherit]">{displayName}</span>
				</span>
			) : (
				displayName
			)}
		</NodeViewWrapper>
	)
}

function MentionNodeViewInner(props: ReactNodeViewProps) {
	const isMobile = useIsMobile()
	const attrs = props.node.attrs as TiptapMentionAttributes & {
		mentionSuggestionChar?: string
	}
	const options = props.extension.options as MentionPanelPluginOptions
	const Renderer = options.nodeViewRenderers?.[attrs.type as MentionItemType]

	if (Renderer) {
		return (
			<MentionNodeViewErrorBoundary
				fallback={<MentionNodeViewFallback attrs={attrs} language={options.language} />}
			>
				<Renderer {...props} attrs={attrs} />
			</MentionNodeViewErrorBoundary>
		)
	}

	return (
		<NodeViewWrapper
			as="span"
			className={`magic-mention inline-flex cursor-grab px-0.5 align-middle active:cursor-grabbing${attrs.pending ? " opacity-50" : ""}`}
			data-mention-suggestion-char={attrs.mentionSuggestionChar || "@"}
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			contentEditable={false}
			draggable
			data-magic-editor-node
		>
			{isMobile ? (
				<MentionNodeChip
					attrs={attrs}
					language={options.language}
					deleteNode={props.deleteNode}
				/>
			) : isStaticResourceMention(attrs.type) ? (
				<MentionNodeResource attrs={attrs} language={options.language} />
			) : (
				`@${getMentionNodeDisplayName(attrs, options.language)}`
			)}
		</NodeViewWrapper>
	)
}

function MentionNodeView(props: ReactNodeViewProps) {
	const attrs = props.node.attrs as TiptapMentionAttributes
	const options = props.extension.options as MentionPanelPluginOptions

	useEffect(() => {
		logger.log("mounted", { type: attrs.type, data: attrs.data })
		return () => {
			logger.log("unmounted", { type: attrs.type, data: attrs.data })
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<MentionNodeViewErrorBoundary
			fallback={<MentionNodeViewFallback attrs={attrs} language={options.language} />}
		>
			<MentionNodeViewInner {...props} />
		</MentionNodeViewErrorBoundary>
	)
}

export default memo(MentionNodeView)
