import type { NodeProps } from "../../types"
import { cn } from "@/lib/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useCallback, useMemo, useRef } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "../../ToolCall/hooks/useToolTooltip"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"
import { MonitorPlay, CircleAlert } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"
import type { ReactNode } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import XMarkdown from "@dtyq/x-markdown"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { useStreamingCommittedContent } from "./WriteFileStreamingContent"
import { parseWriteFileContentSource } from "./streamingWriteFileContent"
import ChunkedCodeBlock from "./ChunkedCodeBlock"

interface ToolDataLike {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	rawArguments?: string
	detail?: {
		data?: Record<string, unknown>
	}
	attachments?: FileItem[]
}

interface WriteToolProps extends Partial<NodeProps> {
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: string
}

const writeFileMarkdownClassName = cn(
	"w-full break-words text-xs leading-5 text-muted-foreground",
	"[&_h1]:mb-1.5 [&_h1]:mt-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:leading-tight",
	"[&_h2]:mb-1.5 [&_h2]:mt-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:leading-tight",
	"[&_h3]:mb-1 [&_h3]:mt-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:leading-tight",
	"[&_blockquote]:my-1 [&_blockquote]:inline-table [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:bg-muted/30 [&_blockquote]:py-1 [&_blockquote]:px-2 [&_blockquote]:text-muted-foreground [&_blockquote]:rounded-r-md",
	"[&_p:has(+p)]:!mb-0.5 [&_p]:!mb-0 [&_p]:!mt-0 [&_p]:whitespace-pre-wrap",
	"[&_ul]:m-0 [&_ul]:list-outside [&_ul]:p-0 [&_ul]:pl-4",
	"[&_ol]:m-0 [&_ol]:list-outside [&_ol]:p-0 [&_ol]:pl-4",
	"[&_li]:!m-0 [&_li]:p-0 [&_li]:pl-0.5 [&_li]:align-top [&_li]:leading-5 [&_li_p]:!m-0",
	"[&_hr]:my-0.5 [&_hr]:border-border",
	"[&_strong]:font-semibold",
	"[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
	"[&_pre]:mt-0 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-[85%] [&_pre]:leading-[1.45]",
	"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[85%]",
	"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[100%]",
	"[&_table]:my-1 [&_table]:border-collapse [&_table]:overflow-auto [&_table]:text-xs",
	"[&_thead]:bg-muted",
	"[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
	"[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
	"[&_tbody_tr:nth-child(even)]:bg-muted/50",
)

const MAX_CONTENT_HEIGHT = 240
const ESTIMATED_BLOCK_HEIGHT = 28

function WriteTool(props: WriteToolProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave, loading, classNames, onClick } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| { tool?: ToolDataLike }
		| undefined
	const tool = props.toolData || node?.tool
	const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])

	const streamingContent = useMemo(
		() =>
			parseWriteFileContentSource(
				tool?.rawArguments ?? "",
				fileData as Record<string, unknown>,
			),
		[tool?.rawArguments, fileData],
	)

	const committedContent = useStreamingCommittedContent(
		streamingContent.content || "",
		loading,
	)
	const virtuosoRef = useRef<VirtuosoHandle>(null)

	const renderVirtualContent = useCallback(
		(blocks: React.ReactNode[]) => {
			if (blocks.length === 0) return null
			return (
				<Virtuoso
					ref={virtuosoRef}
					data={blocks}
					followOutput={loading ? "smooth" : false}
					increaseViewportBy={160}
					className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					style={{
						height: Math.min(
							MAX_CONTENT_HEIGHT,
							Math.max(blocks.length * ESTIMATED_BLOCK_HEIGHT, MAX_CONTENT_HEIGHT),
						),
					}}
					itemContent={(_, element) => <div className="px-3 py-0.5">{element}</div>}
				/>
			)
		},
		[loading],
	)

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	// Open playback tab on icon click
	const handleOpenPlaybackTab = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (isEmpty(fileData)) return
			const detail = { ...tool?.detail, id: tool?.id }
			pubsub.publish(PubSubEvents.Open_Playback_Tab, detail)
			props?.onSelectDetail?.({
				...detail,
				isFromNode: true,
			})
		},
		[fileData, props, tool],
	)

	const showSuffixIcon = useMemo(() => {
		if (isEmpty(fileData)) return false
		return true
	}, [tool?.status, fileData])

	const renderSuffixIcon = useMemo(() => {
		if (!showSuffixIcon) return null

		return (
			<>
				<VerticalLine height={28} className="text-input" />
				{tool?.status === "suspended" ? (
					<div
						className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
						onClick={handleOpenPlaybackTab}
					>
						<CircleAlert size={16} className="text-foreground" />
					</div>
				) : (
					<MagicTooltip title={t("playbackControl.viewProcess")}>
						<div
							className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
							onClick={handleOpenPlaybackTab}
						>
							<MonitorPlay size={16} className="text-foreground" />
						</div>
					</MagicTooltip>
				)}
			</>
		)
	}, [showSuffixIcon, t, handleOpenPlaybackTab, tool?.status])

	return (
		<>
			<div
				className={cn("h-fit w-full flex-none overflow-hidden", classNames)}
				data-tool={tool?.id}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			>
				<div
					className={cn(
						"inline-flex flex-col overflow-hidden rounded-md border border-border shadow-sm",
						loading ? "w-full" : "w-fit",
					)}
				>
					<div className="flex w-full items-center gap-1.5 bg-white pl-1.5 dark:bg-card">
						<div
							className={cn(
								"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden py-1.5 pr-1.5",
								isEmpty(fileData) && "cursor-not-allowed",
							)}
							onClick={onClick}
						>
							<ToolIconBadge toolName={tool?.name} />
							<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
								{tool?.action}
							</span>
							<span
								{...tooltipProps}
								className={cn(
									"min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground",
									{ "rounded-r-none": showSuffixIcon },
								)}
							>
								{tool?.remark || streamingContent.filePath || ""}
							</span>
						</div>
						<div className="ml-auto mr-[6px] inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary">
							{!tool?.status ? (
								<div
									style={{
										padding: 4,
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
									}}
								>
									<IconLoader2 size={14} className="animate-spin" />
								</div>
							) : (
								renderSuffixIcon
							)}
						</div>
					</div>
					{loading && (
						<div className="w-full duration-200 animate-in fade-in slide-in-from-top-1">
							<div className="mx-[6px] mb-1 overflow-hidden rounded-lg bg-[#f5f6f7] pb-1 pt-2 dark:bg-white/10">
								{/* @ts-expect-error React 18/19 types mismatch in workspace package */}
								<XMarkdown
									className={cn(writeFileMarkdownClassName)}
									style={{ whiteSpace: "pre-wrap" }}
									escapeRawHtml
									protectCustomTagNewlines={false}
									content={committedContent}
									renderContent={renderVirtualContent}
									components={{ pre: ChunkedCodeBlock, code: ChunkedCodeBlock }}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
			{renderTooltip()}
		</>
	)
}

export default observer(WriteTool)
