import type { NodeProps } from "@/pages/superMagic/components/MessageList/components/Nodes/types"
import { cn } from "@/utils/cn"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/hooks/useToolTooltip"
import ToolGenerationProgress from "@/pages/superMagic/components/MessageList/components/shared/ToolGenerationProgress"
import ToolWaitCountdown from "@/pages/superMagic/components/MessageList/components/shared/ToolWaitCountdown"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { getToolDesignProjectInfo } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"
import { MonitorPlay, CircleAlert } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"
import type { ReactNode } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import {
	getToolCardInteractionTarget,
	selectToolDetail,
	type ToolCardInteractionTarget,
} from "../../../../toolDetailSelection"

interface ToolDataLike {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	/** 工具调用的原始 arguments 字符串；等待工具的 sleep 时长要从这里读。 */
	rawArguments?: string
	detail?: {
		type?: string
		data?: Record<string, unknown>
	}
	interactionTarget?: ToolCardInteractionTarget
	attachments?: FileItem[]
}

interface DefaultToolProps {
	suffix?: ReactNode
	cardClassName?: string
	node?: NodeProps["node"]
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: string
	onClick?: NodeProps["onClick"]
	onSelectDetail?: NodeProps["onSelectDetail"]
	onMouseEnter?: NodeProps["onMouseEnter"]
	onMouseLeave?: NodeProps["onMouseLeave"]
}

function DefaultTool(props: DefaultToolProps) {
	const { t } = useTranslation("super")
	const filesStore = useMessageListProjectFilesStore()
	const { onMouseEnter, onMouseLeave, loading, classNames, onClick } = props
	const node = superMagicStore.getMessageNode(props?.node?.super_message_id) as
		{ tool?: ToolDataLike } | undefined
	const tool = props.toolData || node?.tool
	const interactionTarget =
		props.toolData?.interactionTarget ?? getToolCardInteractionTarget(tool?.name, tool?.detail)
	const interactionTargetType = interactionTarget.type
	const hasInteraction = interactionTargetType !== "disabled"

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	// Open playback tab on icon click
	const handleOpenPlaybackTab = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (!hasInteraction) return
			const detail = { ...tool?.detail, id: tool?.id }
			selectToolDetail({ detail, onSelectDetail: props?.onSelectDetail })
			if (interactionTargetType === "canvas") {
				const { designProjectId, elements } = getToolDesignProjectInfo(tool, filesStore)
				if (!designProjectId) return
				pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
					isFromPlaybackToolNode: true,
					canvasDesignId: designProjectId,
					elementIds: elements.map((item) => item.id),
					animated: false,
					selectElement: false,
				})
			}
		},
		[filesStore, hasInteraction, interactionTargetType, props?.onSelectDetail, tool],
	)

	const showSuffixIcon = hasInteraction

	const renderSuffixIcon = useMemo(() => {
		if (!showSuffixIcon) return null

		return (
			<div className="ml-auto mr-[6px] inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary">
				<VerticalLine height={28} className="text-input" />
				{tool?.status === "suspended" ? (
					<div
						className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
						onClick={handleOpenPlaybackTab}
						data-testid="handle-open-playback-tab"
					>
						<CircleAlert size={16} className="text-foreground" />
					</div>
				) : (
					<MagicTooltip title={t("playbackControl.viewProcess")}>
						<div
							className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
							onClick={handleOpenPlaybackTab}
							data-testid="handle-open-playback-tab-2"
						>
							<MonitorPlay size={16} className="text-foreground" />
						</div>
					</MagicTooltip>
				)}
			</div>
		)
	}, [showSuffixIcon, t, handleOpenPlaybackTab, tool?.status])

	return (
		<div
			className={cn("h-fit w-full flex-none overflow-hidden", classNames)}
			data-tool={tool?.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			data-testid="on-mouse-enter"
		>
			<div
				className={cn(
					"inline-flex h-fit w-fit max-w-full items-center overflow-hidden rounded-md border border-border bg-white pl-1.5 shadow-sm dark:bg-card",
					!loading && "gap-1.5",
					props.cardClassName,
				)}
			>
				<div
					className={cn(
						"inline-flex h-7 w-fit items-center gap-1.5 overflow-hidden py-1.5 pr-1.5",
						props.suffix !== undefined && "min-w-0 flex-1",
						hasInteraction && "cursor-pointer",
					)}
					onClick={hasInteraction ? onClick : undefined}
					data-testid="default-tool"
				>
					<ToolIconBadge toolName={tool?.name} />
					{tool?.action && (
						<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
							{tool?.action}
						</span>
					)}
					<ToolGenerationProgress
						toolCallId={tool?.id}
						status={tool?.status}
						detail={tool?.detail}
					/>
					{tool?.remark && (
						<span
							{...tooltipProps}
							className={cn(
								"min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground",
								{ "rounded-r-none": showSuffixIcon },
							)}
						>
							{tool?.remark || ""}
						</span>
					)}
				</div>
				{loading ? (
					<div className="ml-auto mr-[6px] inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary">
						<div className="inline-flex items-center gap-[6px] p-[4px]">
							<IconLoader2 size={14} className="animate-spin" />
						</div>
					</div>
				) : (
					(props.suffix ?? renderSuffixIcon)
				)}
			</div>
			<ToolWaitCountdown
				toolCallId={tool?.id}
				toolName={tool?.name}
				status={tool?.status}
				rawArguments={tool?.rawArguments}
				detail={tool?.detail}
			/>
			{renderTooltip()}
		</div>
	)
}

export default observer(DefaultTool)
