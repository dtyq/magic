import type { NodeProps } from "../../../types"
import { cn } from "@/utils/cn"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import ToolGenerationProgress from "@/pages/superMagic/components/MessageList/components/shared/ToolGenerationProgress"
import { MonitorPlay } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"
import { getToolDesignProjectInfo } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { getToolCardInteractionTarget, selectToolDetail } from "../../../toolDetailSelection"
import type { ReactNode } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"

export interface ToolDataLike {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	rawArguments?: string
	detail?: {
		type?: string
		data?: Record<string, unknown>
	}
	attachments?: FileItem[]
}

export interface DefaultToolProps extends Partial<NodeProps> {
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: string
}

interface ToolMessageNode {
	tool?: ToolDataLike
}

function DefaultTool(props: DefaultToolProps) {
	const { t } = useTranslation("super")
	const filesStore = useMessageListProjectFilesStore()
	const { onMouseEnter, onMouseLeave, loading, classNames } = props
	const node = superMagicStore.getMessageNode(props?.node?.super_message_id) as
		ToolMessageNode | undefined
	const tool = props.toolData || node?.tool
	const interactionTarget = useMemo(
		() => getToolCardInteractionTarget(tool?.name, tool?.detail),
		[tool?.name, tool?.detail],
	)
	const interactionTargetType = interactionTarget.type
	const hasInteraction = interactionTargetType !== "disabled"

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	const onClick = () => {
		if (tool?.status !== "error") {
			props?.onClick?.()
		}
	}

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
			<>
				<VerticalLine height={28} className="text-input" />
				<MagicTooltip title={t("playbackControl.viewProcess")}>
					<div
						className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
						onClick={handleOpenPlaybackTab}
						data-testid="handle-open-playback-tab"
					>
						<MonitorPlay size={16} className="text-foreground" />
					</div>
				</MagicTooltip>
			</>
		)
	}, [showSuffixIcon, t, handleOpenPlaybackTab])

	return (
		<div
			className={cn("h-fit w-full flex-none overflow-hidden", classNames)}
			data-tool={tool?.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			data-testid="on-mouse-enter"
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-md border border-border shadow-sm">
				<div
					className={cn(
						"inline-flex h-7 w-fit items-center gap-1.5 overflow-hidden rounded-md bg-white p-1.5 dark:bg-card",
						hasInteraction && "cursor-pointer",
						renderSuffixIcon && "rounded-r-none",
					)}
					onClick={hasInteraction ? onClick : undefined}
					data-testid="default-tool"
				>
					<ToolIconBadge toolName={tool?.name} />
					<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
						{tool?.action}
					</span>
					<ToolGenerationProgress
						toolCallId={tool?.id}
						status={tool?.status}
						detail={tool?.detail}
					/>
					<span
						{...tooltipProps}
						className={cn(
							"min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground",
							{ "rounded-r-none": showSuffixIcon },
						)}
					>
						{tool?.remark || ""}
					</span>
				</div>
				{loading ? (
					<div
						style={{ padding: 4, display: "inline-flex", alignItems: "center", gap: 6 }}
					>
						<IconLoader2 size={14} className="animate-spin" />
					</div>
				) : (
					renderSuffixIcon
				)}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default observer(DefaultTool)
