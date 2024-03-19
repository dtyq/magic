import type { NodeProps } from "../types"
// import { useTranslation } from "react-i18next"
import { ToolsMap } from "./tools"
import { isEmpty, pick } from "lodash-es"
import { memo, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import DefaultTool, { getToolDesignProjectInfo } from "./tools/DefaultTool"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { filterClickableMessageWithoutRevoked } from "@/opensource/pages/superMagic/utils/handleMessage"

function ToolCall(props: NodeProps) {
	const { onSelectDetail } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	// const { data, name } = tool?.detail || {}
	// const tabs = data?.groups || []

	// const { t } = useTranslation("super")

	const ToolComponent = ToolsMap?.[tool?.name] || DefaultTool

	// 调用onSelectDetail时检查是否为选中节点并添加isFromNode标记
	const handleSelectDetail = (detail: any) => {
		switch (tool?.name) {
			case "create_design_project":
			case "create_canvas_element":
			case "update_canvas_element":
			case "batch_create_canvas_elements":
			case "batch_update_canvas_elements":
			case "reorder_canvas_elements":
			case "query_canvas_overview":
			case "query_canvas_element":
			case "generate_images_to_canvas":
			case "search_images_to_canvas":
				const { designProjectId, designProject, elements } = getToolDesignProjectInfo(tool)
				pubsub.publish(PubSubEvents.Open_File_Tab, {
					...designProject,
					fileId: designProjectId,
				})
				if (elements.length > 0 && designProjectId) {
					// 延迟等待tab打开
					setTimeout(() => {
						pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
							canvasDesignId: designProjectId,
							elementIds: elements.map((item) => item.id),
							selectElement: [elements[0].id],
							animated: false,
							padding: {
								top: "25%",
								right: "25%",
								bottom: "25%",
								left: "25%",
							},
						})
					}, 200)
				}
				return
			default:
				break
		}
		// 如果有 source_file_id，说明这是一个会涉及变更项目文件区域的工具调用
		// 直接打开文件 tab 并定位到文件树
		if (detail?.data?.source_file_id) {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: detail.data.source_file_id })
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, detail.data.source_file_id)
		} else {
			// 否则走原有逻辑：点击工具调用时，打开playback tab
			pubsub.publish(PubSubEvents.Open_Playback_Tab, detail)
		}

		// 确保onSelectDetail存在，且节点被选中或选中状态未定义
		if (onSelectDetail) {
			onSelectDetail({
				...detail,
				isFromNode: true,
			})
		}
	}

	const onProxyClick = () => {
		const toolInfo = pick(tool, ["name", "url", "action", "remark", "id"])
		const newDetail = { ...tool?.detail, ...toolInfo }
		console.log("往上传递数据", newDetail, toolInfo, node)
		if (!filterClickableMessageWithoutRevoked(node) || isEmpty(tool?.detail)) {
			return
		}

		handleSelectDetail?.(newDetail)
	}

	return (
		<Suspense fallback={null}>
			<ToolComponent {...props} onClick={onProxyClick} />
		</Suspense>
	)
}

export default memo(observer(ToolCall))
