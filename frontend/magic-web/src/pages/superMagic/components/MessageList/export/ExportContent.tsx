import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { observer } from "mobx-react-lite"
import { forwardRef, memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"
import { globalConfigStore } from "@/stores/globalConfig"
import { getAvatarUrl } from "@/utils/avatar"
import { getLocalePreferredKeys, resolveLocalizedText } from "@/utils/locale"
import MarkdownComponent from "../components/Text/components/Markdown"
import MessageRenderErrorBoundary from "../components/MessageRenderErrorBoundary"
import { useStyles as useMarkdownGithubStyles } from "../components/Nodes/AgentReply/styles"
import { ToolIconBadge } from "../components/shared/ToolIconConfig"
import { IconClipboard } from "@tabler/icons-react"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type {
	ExportAttachment,
	ExportMessagePart,
	ExportTextSegment,
	ExportTurn,
} from "./extractMessageContent"

export interface ExportContentProps {
	turns: ExportTurn[]
	title: string
	exportedAt: number
}

function formatStamp(ts?: number | string): string {
	if (ts == null) return ""
	const d = typeof ts === "number" ? new Date(ts * (ts < 1e12 ? 1000 : 1)) : new Date(ts)
	if (Number.isNaN(d.getTime())) return ""
	const pad = (n: number) => String(n).padStart(2, "0")
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AttachmentList({ items }: { items: ExportAttachment[] }) {
	const { t } = useTranslation("super")
	if (!items.length) return null
	return (
		<div className="mt-2 flex w-full flex-col rounded-md">
			<div className="mb-2 mr-1 text-sm font-medium text-foreground">
				{t("ui.attachments", { count: items.length })}
			</div>
			<div className="flex flex-wrap gap-2">
				{items.map((item, i) => (
					<div key={`${item.name}-${i}`} className="w-full">
						<div className="flex items-center gap-2 rounded-[12px] bg-fill p-2.5">
							<FileResourceIcon
								presentation={resolveFilePresentation(
									item.file ?? {
										name: item.name,
										is_directory: item.kind === "folder",
										file_extension: item.file_extension || item.extension,
									},
								)}
								allowRemoteIcon={false}
								size={24}
								className="shrink-0"
							/>
							<span className="mr-2 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
								{item.name}
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function MessageSegments({
	segments,
	fallback,
}: {
	segments?: ExportTextSegment[]
	fallback?: string
}) {
	if (!segments || segments.length === 0) return <>{fallback || ""}</>
	return (
		<>
			{segments.map((seg, i) => {
				if (seg.type === "mention") {
					return (
						<span
							key={i}
							className="mx-0.5 inline rounded-[4px] bg-blue-500/10 px-1 py-px align-top text-foreground"
						>
							@{seg.text}
							{seg.mentionType === MentionItemType.FOLDER ? "/" : ""}
						</span>
					)
				}
				return <span key={i}>{seg.text}</span>
			})}
		</>
	)
}

function UserPart({ part }: { part: ExportMessagePart }) {
	return (
		<div className="flex w-full flex-col items-end">
			<div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
				<MessageSegments segments={part.segments} fallback={part.text} />
			</div>
			{part.attachments?.length ? (
				<div className="max-w-[80%]">
					<AttachmentList items={part.attachments} />
				</div>
			) : null}
		</div>
	)
}

function AssistantPart({ part, messageKey }: { part: ExportMessagePart; messageKey: string }) {
	const { styles: mdStyles } = useMarkdownGithubStyles()
	return (
		<div className="w-full">
			<MessageRenderErrorBoundary
				messageKey={messageKey}
				resetKey={part.markdown || part.text || ""}
			>
				{part.markdown || part.text ? (
					<MarkdownComponent
						content={part.markdown || part.text || ""}
						className={mdStyles.githubMarkdown}
					/>
				) : null}
			</MessageRenderErrorBoundary>
			{part.attachments?.length ? <AttachmentList items={part.attachments} /> : null}
		</div>
	)
}

function ToolPart({ part }: { part: ExportMessagePart }) {
	return (
		<div className="mt-1 flex w-full flex-col gap-2">
			<div className="inline-flex h-fit w-fit max-w-full items-center overflow-hidden rounded-md border border-border bg-white pl-1.5 shadow-sm">
				<div className="inline-flex h-7 min-w-0 items-center gap-1.5 overflow-hidden py-1.5 pr-1.5">
					<ToolIconBadge
						toolName={part.toolRawName || part.toolName}
						size={16}
						iconSize={12}
					/>
					<span className="w-fit flex-none whitespace-nowrap text-xs font-normal leading-4 text-foreground">
						{part.toolName || "tool"}
					</span>
					{part.toolBrief ? (
						<span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
							{part.toolBrief}
						</span>
					) : null}
				</div>
			</div>
			{part.attachments?.length ? <AttachmentList items={part.attachments} /> : null}
		</div>
	)
}

function ThinkingPart({ part }: { part: ExportMessagePart }) {
	const { t } = useTranslation("super")
	const text = part.markdown || part.text
	const title =
		part.thinkState === "thinking"
			? t("agentThink.thinking", { defaultValue: "思考中" })
			: t("agentThink.thinkDone", { defaultValue: "已完成思考" })
	return (
		<div className="mt-1 flex w-full flex-col gap-2">
			<div className="inline-flex h-fit w-fit max-w-full items-center overflow-hidden rounded-md border border-border bg-white pl-1.5 shadow-sm">
				<div className="inline-flex h-7 min-w-0 items-center gap-1.5 overflow-hidden py-1.5 pr-1.5">
					<ToolIconBadge toolName="agent_think" size={16} iconSize={10} />
					<span className="w-fit flex-none whitespace-nowrap text-xs font-normal leading-4 text-foreground">
						{title}
					</span>
				</div>
			</div>
			{text ? (
				<div className="whitespace-pre-wrap break-words rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs italic leading-5 text-muted-foreground">
					<IconClipboard size={12} className="mr-1 inline-block align-[-2px]" />
					{text}
				</div>
			) : null}
		</div>
	)
}

function TurnBlock({ turn }: { turn: ExportTurn }) {
	return (
		<div className="flex flex-col gap-3">
			{turn.parts.map((part, i) => {
				const key = `${turn.key}-${i}`
				if (part.role === "user") {
					return <UserPart key={key} part={part} />
				}
				if (part.role === "tool") {
					return <ToolPart key={key} part={part} />
				}
				if (part.type === "thinking" || part.type === "agent_thinking") {
					return <ThinkingPart key={key} part={part} />
				}
				return <AssistantPart key={key} part={part} messageKey={key} />
			})}
		</div>
	)
}

const ExportContentInner = forwardRef<HTMLDivElement, ExportContentProps>(
	function ExportContentInner({ turns, title, exportedAt }, ref) {
		const stamp = useMemo(() => formatStamp(exportedAt), [exportedAt])
		const { i18n, t } = useTranslation("super")
		const { t: tCommon } = useTranslation("common")
		const globalConfig = globalConfigStore.globalConfig
		const localizedLogo = getLocalePreferredKeys(i18n.language)
			.map((key) => globalConfig?.logo?.[key as SupportLocales]?.trim())
			.find(Boolean)
		// Export branding follows platform_settings; prefer the platform icon over a generic
		// default wordmark when the current locale does not provide a dedicated full logo.
		const rawLogo =
			localizedLogo ||
			globalConfig?.minimal_logo?.trim() ||
			globalConfig?.logo?.[SupportLocales.fallback]?.trim()
		const logoSrc = rawLogo ? getAvatarUrl(rawLogo, 80) : ""
		const brandName =
			tCommon("platform.name") ||
			resolveLocalizedText(globalConfig?.name_i18n, i18n.language) ||
			t("export.platformFallback")

		return (
			<div
				ref={ref}
				data-export-root
				className="w-[800px] bg-background px-8 py-7 text-foreground"
				style={{ colorScheme: "light" }}
			>
				<div className="flex items-start justify-between border-b border-border pb-4">
					<div className="flex items-center">
						{logoSrc ? (
							<img
								src={logoSrc}
								alt={brandName}
								className="h-8 max-w-[240px] object-contain object-left"
							/>
						) : (
							<div className="text-base font-semibold">{brandName}</div>
						)}
					</div>
					<div className="text-right">
						<div className="text-sm font-medium text-foreground">{title || "对话"}</div>
						{stamp ? (
							<div className="mt-0.5 text-xs text-muted-foreground">{stamp}</div>
						) : null}
					</div>
				</div>

				<div className="mt-5 flex flex-col gap-6">
					{turns.map((turn, i) => (
						<div key={turn.key}>
							{i > 0 ? <div className="mb-6 h-px w-full bg-border/60" /> : null}
							<TurnBlock turn={turn} />
						</div>
					))}
				</div>

				<div className="mt-8 border-t border-border pt-3 text-center text-xs text-muted-foreground">
					{t("export.generatedBy", { platformName: brandName })}
				</div>
			</div>
		)
	},
)

export const ExportContent = memo(observer(ExportContentInner))
