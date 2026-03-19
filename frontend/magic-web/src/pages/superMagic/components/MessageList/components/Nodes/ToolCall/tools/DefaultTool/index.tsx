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
import projectFilesStore from "@/stores/projectFiles"
import { LayerElement } from "@/components/CanvasDesign/canvas/types"
import { FileItem } from "@/pages/superMagic/pages/Workspace/types"
import { MonitorPlay } from "lucide-react"
import { MagicTooltip, VerticalLine } from "@/components/base"

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

function DefaultTool(props: NodeProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const fileData = useMemo(() => tool?.detail?.data || {}, [tool?.detail?.data])

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	const onClick = () => {
		if (tool.status !== "error") {
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
			]
			if (designToolNames.includes(tool?.name)) {
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
		if (tool?.status === "error") return false
		if (isEmpty(fileData)) return false
		return true
	}, [tool?.status, fileData])

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
			className="h-fit w-full flex-none overflow-hidden"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-md border border-border shadow-sm">
				<div
					className={cn(
						"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-white p-1.5 dark:bg-card",
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
						{tool?.remark || ""}
					</span>
				</div>
				{renderSuffixIcon}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default observer(DefaultTool)
