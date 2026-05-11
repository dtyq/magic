import { useCallback, useMemo, type MouseEvent, lazy } from "react"
import { observer } from "mobx-react-lite"
import DefaultTool from "./tools/DefaultTool"
import WriteFileTool from "./tools/WriteFile"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useTranslation } from "react-i18next"
import { isEmpty, pick } from "lodash-es"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getToolDesignProjectInfo } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import { DisabledDetailToolTypes } from "@/pages/superMagic/components/Detail/constants"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { MCPTool } from "./tools/MCPTool"

const AskUserToolCall = lazy(() => import("./tools/askUser"))

interface ToolCallItem {
	id: string
	type: "function"
	function: {
		name: string
		label: string
		arguments: string
	}
	tool?: {
		id?: string
		name?: string
		action?: string
		status?: string
		remark?: string
		detail?: Record<string, unknown>
		attachments?: Array<any> | null
		[key: string]: unknown
	}
}

interface ToolCallProps {
	topicId: string
	correlationId: string
	classNames?: string
	toolCall: ToolCallItem
	selectedTopic?: Topic | null
	isShare?: boolean
	onSelectDetail?: (detail: any) => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

function parseToolArguments(argumentsText: string): Record<string, unknown> {
	if (!argumentsText) return {}

	try {
		const parsed = JSON.parse(argumentsText) as Record<string, unknown>
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
		return { value: parsed }
	} catch {
		return { value: argumentsText }
	}
}

export const ToolCall = observer(function ToolCall(props: ToolCallProps) {
	const {
		topicId,
		correlationId,
		toolCall,
		classNames,
		onMouseEnter,
		onMouseLeave,
		onSelectDetail,
		selectedTopic,
		isShare,
	} = props
	const { t } = useTranslation("super")

	const toolResponse = superMagicStore.toolResponseMap.get(topicId)?.get(toolCall?.id)
	const effectiveResponse = toolResponse || toolCall?.tool
	const streamState = superMagicStore.getStreamState(topicId, correlationId)
	const isStreamActive = !!streamState
	const isToolLoading = !effectiveResponse && isStreamActive
	const toolData = useMemo(() => {
		const parsedArguments = parseToolArguments(toolCall?.function?.arguments || "")
		const originalDetail = effectiveResponse?.detail
		const toolDetail = (originalDetail || {}) as Record<string, unknown>
		const detailData = (toolDetail?.data || {}) as Record<string, unknown>

		return {
			id: toolCall?.id,
			name: toolCall?.function?.name,
			action: effectiveResponse?.action || toolCall?.function?.label,
			remark: effectiveResponse?.remark || toolCall?.tool?.remark,
			status: effectiveResponse?.status,
			attachments: effectiveResponse?.attachments || [],
			detail: originalDetail
				? {
						...toolDetail,
						data: {
							...detailData,
							...parsedArguments,
							arguments: toolCall?.function?.arguments,
						},
					}
				: toolCall?.function?.arguments
					? { data: { ...parsedArguments, arguments: toolCall.function.arguments } }
					: undefined,
		}
	}, [
		toolCall?.id,
		toolCall?.function?.name,
		toolCall?.function?.arguments,
		toolCall?.tool,
		t,
		effectiveResponse,
	])

	const onClick = useCallback(() => {
		const toolInfo = pick(toolData, ["name", "url", "action", "remark", "id"])
		const toolResponse = superMagicStore.toolResponseMap.get(topicId)?.get(toolCall?.id)
		const newDetail = { ...toolResponse?.detail, ...toolInfo }

		if (DisabledDetailToolTypes.includes(toolData?.name) || isEmpty(toolData?.detail)) return

		const toolName = toolData?.name
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
			"generate_videos_to_canvas",
			"query_video_generation",
			"create_canvas",
			"generate_canvas_images",
			"generate_canvas_videos",
		]

		if (toolName && designToolNames.includes(toolName)) {
			const { designProjectId, designProject, elements } = getToolDesignProjectInfo(toolData)
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				...designProject,
				fileId: designProjectId,
			})
			if (elements.length > 0 && designProjectId) {
				setTimeout(() => {
					pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
						canvasDesignId: designProjectId,
						elementIds: elements.map((item) => item.id),
						selectElement: [elements[0].id],
						animated: false,
						padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
					})
				}, 200)
			}
			return
		}

		const detailData = newDetail as { data?: { source_file_id?: string } }
		if (detailData?.data?.source_file_id) {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: detailData.data.source_file_id })
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, detailData.data.source_file_id)
		} else {
			// 否则走原有逻辑：点击工具调用时，打开playback tab
			pubsub.publish(PubSubEvents.Open_Playback_Tab, detailData)
		}

		onSelectDetail?.({ ...newDetail, isFromNode: true })
	}, [toolData, correlationId, onSelectDetail])

	// For the MCP tool, special judgment is required based on `tool.name`, where the name in `function.name` corresponds to the method in MCP
	if (toolCall?.tool?.name === "mcp_tool_call") {
		return (
			<MCPTool
				onClick={onClick}
				toolData={toolData}
				loading={isToolLoading}
				classNames={classNames}
				onSelectDetail={onSelectDetail}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (toolCall?.function?.name === "ask_user") {
		return (
			<AskUserToolCall
				toolData={toolData}
				loading={!toolResponse}
				classNames={classNames}
				selectedTopic={selectedTopic}
				isShare={isShare}
				onSelectDetail={onSelectDetail}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}
	if (toolCall?.function?.name === "write_file") {
		return (
			<WriteFileTool
				onClick={onClick}
				toolData={toolData}
				loading={isToolLoading}
				classNames={classNames}
				onSelectDetail={onSelectDetail}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}
	return (
		<DefaultTool
			onClick={onClick}
			toolData={toolData}
			loading={isToolLoading}
			classNames={classNames}
			onSelectDetail={onSelectDetail}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		/>
	)
})
