import type { NodeProps } from "../../../types"
import { cn } from "@/lib/utils"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { MonitorPlay } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"
import {
	getToolDesignProjectInfo,
	type ToolDesignProjectData,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import type { ReactNode } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"

export interface ToolDataLike {
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

export interface DefaultToolProps extends Partial<NodeProps> {
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: string
}

interface ToolMessageNode {
	tool?: ToolDesignProjectData
}

function DefaultTool(props: DefaultToolProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave, loading, classNames } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| ToolMessageNode
		| undefined
	const tool = props.toolData || node?.tool
	const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])

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
			if (isEmpty(fileData)) return
			const detail = { ...tool?.detail, id: tool?.id }
			pubsub.publish(PubSubEvents.Open_Playback_Tab, detail)
			props?.onSelectDetail?.({
				...detail,
				isFromNode: true,
			})
			const designToolNames = [
				// 旧(保留,用于兼容旧消息)
				"create_design_project",
				"create_canvas_element",
				"update_canvas_element",
				"batch_create_canvas_elements",
				"batch_update_canvas_elements",
				"reorder_canvas_elements",
				"query_canvas_overview",
				"query_canvas_element",
				"generate_images_to_canvas",
				"search_images_to_canvas",
				"generate_videos_to_canvas",
				"query_video_generation",

				// 新
				"create_canvas",
				"generate_canvas_images",
				"generate_canvas_videos",
			]
			if (tool?.name && designToolNames.includes(tool.name)) {
				const { designProjectId, elements } = getToolDesignProjectInfo(tool)
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
		[fileData, props, tool],
	)

	const showSuffixIcon = useMemo(() => {
		if (isEmpty(fileData)) return false
		return true
	}, [fileData])

	const renderSuffixIcon = useMemo(() => {
		if (!showSuffixIcon) return null

		return (
			<>
				<VerticalLine height={28} className="text-input" />
				<MagicTooltip title={t("playbackControl.viewProcess")}>
					<div
						className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-r-[4px] bg-white hover:bg-fill active:bg-fill-secondary dark:bg-card"
						onClick={handleOpenPlaybackTab}
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
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-md border border-border shadow-sm">
				<div
					className={cn(
						"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-white p-1.5 dark:bg-card",
						isEmpty(fileData) && "cursor-not-allowed",
						renderSuffixIcon && "rounded-r-none",
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
