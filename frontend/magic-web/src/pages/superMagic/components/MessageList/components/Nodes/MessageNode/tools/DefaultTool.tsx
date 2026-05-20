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
import { useScrollAreaAutoScroll } from "../../shared/hooks/useScrollAreaAutoScroll"

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

interface DefaultToolProps extends Partial<NodeProps> {
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: string
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

function DefaultTool(props: DefaultToolProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave, loading, classNames, onClick } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| { tool?: ToolDataLike }
		| undefined
	const tool = props.toolData || node?.tool
	const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])

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
	}, [tool?.status, fileData])

	const renderSuffixIcon = useMemo(() => {
		if (!showSuffixIcon) return null

		return (
			<div className="ml-auto mr-[6px] inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary">
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
			</div>
		)
	}, [showSuffixIcon, t, handleOpenPlaybackTab, tool?.status])

	return (
		<div
			className={cn("h-fit w-full flex-none overflow-hidden", classNames)}
			data-tool={tool?.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div
				className={cn(
					"inline-flex h-fit w-fit max-w-full items-center overflow-hidden rounded-md border border-border bg-white pl-1.5 shadow-sm dark:bg-card",
					!loading && "gap-1.5",
				)}
			>
				<div
					className={cn(
						"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden py-1.5 pr-1.5",
						isEmpty(fileData) && "cursor-not-allowed",
					)}
					onClick={onClick}
				>
					<ToolIconBadge toolName={tool?.name} />
					{tool?.action && (
						<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
							{tool?.action}
						</span>
					)}
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
					renderSuffixIcon
				)}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default observer(DefaultTool)
