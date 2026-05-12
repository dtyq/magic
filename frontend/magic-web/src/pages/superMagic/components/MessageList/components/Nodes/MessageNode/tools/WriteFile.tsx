import type { NodeProps } from "../../types"
import { cn } from "@/lib/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "../../ToolCall/hooks/useToolTooltip"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import projectFilesStore from "@/stores/projectFiles"
import { LayerElement } from "@/components/CanvasDesign/canvas/types"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"
import { MonitorPlay, CircleAlert } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"
import type { ReactNode } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { useScrollAreaAutoScroll } from "../../shared/hooks/useScrollAreaAutoScroll"
import MarkdownComponent from "../../../Text/components/Markdown"

interface ToolDataLike {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
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
	"[&_blockquote]:mt-0 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_p:has(+p)]:!mb-0.5 [&_p]:!mb-0 [&_p]:!mt-0 [&_p]:whitespace-pre-wrap",
	"[&_ul]:m-0 [&_ul]:list-outside [&_ul]:p-0 [&_ul]:pl-4",
	"[&_ol]:m-0 [&_ol]:list-outside [&_ol]:p-0 [&_ol]:pl-4",
	"[&_li]:!m-0 [&_li]:p-0 [&_li]:pl-0.5 [&_li]:align-top [&_li]:leading-5",
	"[&_hr]:my-1.5 [&_hr]:border-border",
	"[&_strong]:font-semibold",
	"[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
	"[&_pre]:mt-0 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-[85%] [&_pre]:leading-[1.45]",
	"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[85%]",
	"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[100%]",
)

function unescapePartialJsonString(raw: string): string {
	let result = ""
	let i = 0
	while (i < raw.length) {
		if (raw[i] === "\\") {
			if (i + 1 >= raw.length) break
			const next = raw[i + 1]
			switch (next) {
				case "n":
					result += "\n"
					break
				case "t":
					result += "\t"
					break
				case "r":
					result += "\r"
					break
				case '"':
					result += '"'
					break
				case "\\":
					result += "\\"
					break
				case "/":
					result += "/"
					break
				case "b":
					result += "\b"
					break
				case "f":
					result += "\f"
					break
				default: {
					if (next === "u" && i + 5 < raw.length) {
						const hex = raw.slice(i + 2, i + 6)
						const code = parseInt(hex, 16)
						if (!isNaN(code)) {
							result += String.fromCharCode(code)
							i += 6
							continue
						}
					}
					result += raw[i] + next
					break
				}
			}
			i += 2
		} else if (raw[i] === '"') {
			break
		} else {
			result += raw[i]
			i++
		}
	}
	return result
}

function parseStreamingWriteFileArgs(args: string): { filePath: string; content: string } {
	if (!args) return { filePath: "", content: "" }

	try {
		const parsed = JSON.parse(args)
		return {
			filePath: parsed.file_path || parsed.path || "",
			content: parsed.content || "",
		}
	} catch {
		// Partial JSON during streaming — extract fields manually
	}

	let filePath = ""
	const filePathMatch = args.match(/"file_path"\s*:\s*"((?:[^"\\]|\\.)*)"/)
	if (filePathMatch) {
		filePath = unescapePartialJsonString(filePathMatch[1])
	}

	let content = ""
	const contentKeyIdx = args.indexOf('"content"')
	if (contentKeyIdx !== -1) {
		const colonIdx = args.indexOf(":", contentKeyIdx + 9)
		if (colonIdx !== -1) {
			const quoteIdx = args.indexOf('"', colonIdx + 1)
			if (quoteIdx !== -1) {
				content = unescapePartialJsonString(args.slice(quoteIdx + 1))
			}
		}
	}

	return { filePath, content }
}

export const getToolDesignProjectInfo = (tool: unknown) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const toolData = tool as any
	const magicProjectJSFile = toolData.attachments?.find(
		(item: FileItem) => item.filename === "magic.project.js",
	)
	const fileTree = projectFilesStore.workspaceFileTree
	const designProject = fileTree.find((item) =>
		item.children?.find((child) => child.file_id === magicProjectJSFile?.file_id),
	)
	const designProjectId = designProject?.file_id || ""
	const elements = (toolData.detail?.data?.elements || []) as LayerElement[]
	return {
		designProjectId,
		designProject,
		magicProjectJSFile,
		elements,
	}
}

function WriteTool(props: WriteToolProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave, loading, classNames, onClick } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| { tool?: ToolDataLike }
		| undefined
	const tool = props.toolData || node?.tool
	const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])

	const streamingContent = useMemo(() => {
		if (typeof fileData?.content === "string" && fileData.content) {
			return {
				filePath: (fileData?.file_path ?? "") as string,
				content: fileData.content as string,
			}
		}
		return parseStreamingWriteFileArgs((fileData?.arguments ?? "") as string)
	}, [fileData?.content, fileData?.file_path, fileData?.arguments])

	const { viewportRef: toolViewportRef } = useScrollAreaAutoScroll({
		isStreaming: !!loading,
	})

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
							<div className={cn("overflow-hidden")}>
								<ScrollArea
									viewportRef={toolViewportRef}
									className="mx-[6px] mb-1 rounded-lg border-black/[0.08] bg-[#f5f6f7] dark:bg-white/10 [&_[data-radix-scroll-area-viewport]]:max-h-60"
								>
									<div className="w-full px-3 pb-1 pt-2">
										<MarkdownComponent
											allowRawHtml={false}
											className={writeFileMarkdownClassName}
											isStreaming={!!loading}
											content={streamingContent.content || ""}
										/>
									</div>
									<ScrollBar orientation="vertical" />
								</ScrollArea>
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
