import { memo } from "react"
import { observer } from "mobx-react-lite"
import type { NodeProps } from "@/opensource/pages/superMagic/components/MessageList/components/Nodes/types"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { cn } from "@/opensource/lib/utils"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

function AudioUnderstandingProgressNode(props: NodeProps) {
	const { onMouseEnter, onMouseLeave, checkIsLastMessage } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const detailData = tool?.detail?.data || {}

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: detailData?.file_name,
		placement: "top",
		checkOverflow: true,
	})

	const onClick = () => {
		if (tool.status !== "error") {
			props?.onClick?.()
		}
	}

	const progress = detailData?.progress || 0
	const isLastMessage = checkIsLastMessage?.(node?.message_id) ?? true
	const showScanEffect = progress < 100 && isLastMessage
	const isAudioUnderstanding = Number.isInteger(tool?.detail?.data?.progress)

	return (
		<div
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border">
				<div
					className="relative inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg bg-white pb-1.5 pl-1.5 pt-1.5 dark:bg-card"
					onClick={onClick}
				>
					{showScanEffect && isAudioUnderstanding && (
						<div className="pointer-events-none absolute -left-[120px] top-0 z-0 h-full w-[120px] animate-scan bg-gradient-to-r from-transparent from-[40%] to-[#eee] will-change-transform" />
					)}
					<ToolIconBadge toolName={tool?.name} />
					<span className="relative z-[1] w-fit flex-none text-xs font-normal leading-4 text-foreground">
						{tool?.action}
					</span>
					{isAudioUnderstanding && (
						<>
							<span
								{...tooltipProps}
								className={cn(
									"relative z-[1] min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4",
									"text-muted-foreground",
								)}
							>
								{detailData?.file_name || ""}
							</span>
							<div className="relative z-[1] mr-1.5 flex flex-none flex-row items-center justify-center gap-2.5 rounded-[1000px] bg-fill px-2.5 py-0.5">
								<span className="text-xs leading-4 text-muted-foreground">
									{progress}%
								</span>
							</div>
						</>
					)}
				</div>
			</div>
			{renderTooltip()}
		</div>
	)
}

export const AudioUnderstandingProgress = memo(observer(AudioUnderstandingProgressNode))
