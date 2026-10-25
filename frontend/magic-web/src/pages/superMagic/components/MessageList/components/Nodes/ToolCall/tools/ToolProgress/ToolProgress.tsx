import DownloadProgress from "./DownloadProgress"
import type { ToolCallViewModel } from "../../../MessageNode/tool-call/types"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import type { NodeProps } from "@/pages/superMagic/components/MessageList/components/Nodes/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { cn } from "@/utils/cn"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

function getProgressValue(progress: unknown) {
	if (typeof progress !== "number" || !Number.isFinite(progress)) return null

	return Math.max(0, Math.min(100, Math.round(progress)))
}

function getProgressLabel({
	fileName,
	message,
	remark,
}: {
	fileName?: string
	message?: string
	remark?: string
}) {
	if (fileName) return fileName
	if (message) return message
	return remark || ""
}

export function ToolProgressCard({
	tool,
	onClick,
	isLastMessage = true,
	onMouseEnter,
	onMouseLeave,
}: {
	tool?: ToolCallViewModel
	onClick?: () => void
	isLastMessage?: boolean
	onMouseEnter?: NodeProps["onMouseEnter"]
	onMouseLeave?: NodeProps["onMouseLeave"]
}) {
	const detailData = tool?.detail?.data || {}
	const progress = getProgressValue(detailData.progress)
	const hasProgress = progress !== null
	const progressLabel = getProgressLabel({
		fileName: typeof detailData.file_name === "string" ? detailData.file_name : undefined,
		message: typeof detailData.message === "string" ? detailData.message : undefined,
		remark: tool?.remark,
	})

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: progressLabel,
		placement: "top",
		checkOverflow: true,
	})

	const showScanEffect = hasProgress && progress < 100 && isLastMessage
	if (tool?.name === "download_from_urls")
		return (
			<DownloadProgress
				data={detailData}
				action={typeof tool.action === "string" ? tool.action : undefined}
				progress={progress}
				state={tool.downloadProgress}
				rawArguments={tool.rawArguments}
				showScan={
					isLastMessage &&
					tool.status !== "finished" &&
					tool.status !== "error" &&
					tool.status !== "suspended" &&
					tool.status !== "response_missing" &&
					detailData.status !== "cancelled"
				}
			/>
		)

	return (
		<div
			data-testid="tool-progress-node"
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border">
				<div
					data-testid="tool-progress-trigger"
					className="relative inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg bg-white pb-1.5 pl-1.5 pt-1.5 dark:bg-card"
					onClick={onClick}
				>
					{showScanEffect && (
						<div className="pointer-events-none absolute -left-[120px] top-0 z-0 h-full w-[120px] animate-scan bg-gradient-to-r from-transparent from-[40%] to-[#eee] will-change-transform" />
					)}
					<ToolIconBadge toolName={tool?.name} />
					<span className="relative z-[1] w-fit flex-none text-xs font-normal leading-4 text-foreground">
						{tool?.action}
					</span>
					{progressLabel && (
						<span
							{...tooltipProps}
							className={cn(
								"relative z-[1] min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4",
								"text-muted-foreground",
							)}
						>
							{progressLabel}
						</span>
					)}
					{hasProgress && (
						<div className="relative z-[1] mr-1.5 flex flex-none flex-row items-center justify-center gap-2.5 rounded-[1000px] bg-fill px-2.5 py-0.5">
							<span className="text-xs leading-4 text-muted-foreground">
								{progress}%
							</span>
						</div>
					)}
				</div>
			</div>
			{renderTooltip()}
		</div>
	)
}

function ToolProgressNode(props: NodeProps) {
	const node = superMagicStore.getMessageNode(props.node?.super_message_id)
	const rawTool =
		node?.tool && typeof node.tool === "object"
			? (node.tool as Record<string, unknown>)
			: undefined
	const toolId = typeof rawTool?.id === "string" ? rawTool.id : undefined
	const canonical =
		props.selectedTopic?.id && toolId
			? superMagicStore.toolResponseMap.get(props.selectedTopic.id)?.get(toolId)
			: undefined
	const tool = rawTool
		? ({ ...rawTool, ...canonical, attachments: [] } as ToolCallViewModel)
		: undefined
	return (
		<ToolProgressCard
			tool={tool}
			onClick={props.onClick}
			isLastMessage={props.checkIsLastMessage?.(node?.message_id || "") ?? true}
			onMouseEnter={props.onMouseEnter}
			onMouseLeave={props.onMouseLeave}
		/>
	)
}

export const ToolProgress = memo(observer(ToolProgressNode))
