import type { NodeProps } from "../types"
// import { useTranslation } from "react-i18next"
import { ToolsMap } from "./tools"
import { isEmpty, pick } from "lodash-es"
import { Suspense } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import DefaultTool from "./tools/DefaultTool"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { filterClickableMessageWithoutRevoked } from "@/pages/superMagic/utils/handleMessage"
import { getToolDesignProjectInfo } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import { isInlineToolDetail } from "@/pages/superMagic/utils/toolDetailDisplay"
import OperationResultList from "../shared/OperationResultList"
import {
	getToolCardInteractionTarget,
	selectToolFile,
	selectToolDetail,
} from "../toolDetailSelection"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { isToolCallLoading } from "../MessageNode/tool-call/types"
import FileDownloadCard from "../shared/FileDownloadCard"

function ToolCall(props: NodeProps) {
	const { onSelectDetail } = props
	const filesStore = useMessageListProjectFilesStore()
	const node = superMagicStore.getMessageNode(props?.node?.super_message_id) as
		| {
				tool?: {
					id?: string
					name?: string
					action?: string
					remark?: string
					status?: string
					detail?: Record<string, unknown>
					[key: string]: unknown
				}
				[key: string]: unknown
		  }
		| undefined
	const tool = node?.tool
	// const { data, name } = tool?.detail || {}
	// const tabs = data?.groups || []

	// const { t } = useTranslation("super")
	const toolName = typeof tool?.name === "string" ? tool.name : ""
	const loading = isToolCallLoading({ tool })

	const ToolComponent = ToolsMap?.[toolName] || DefaultTool

	// 调用onSelectDetail时检查是否为选中节点并添加isFromNode标记
	const handleSelectDetail = (detail: {
		data?: Record<string, unknown>
		[key: string]: unknown
	}) => {
		const target = getToolCardInteractionTarget(tool?.name, detail)
		if (target.type === "disabled" || target.type === "inline") return

		if (target.type === "canvas") {
			const { designProjectId, designProject, elements } = getToolDesignProjectInfo(
				tool,
				filesStore,
			)
			if (!designProjectId) return
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				...designProject,
				fileId: designProjectId,
			})
			if (elements.length > 0) {
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
		}
		// Resolve explicit file targets first; legacy sources retain attachment checks.

		if (
			selectToolFile({
				detail,
				target,
				onSelectDetail,
				filesStore,
			})
		) {
			return
		}

		selectToolDetail({ detail, onSelectDetail })
	}

	const onProxyClick = () => {
		const toolInfo = pick(tool, ["name", "url", "action", "remark", "id"])
		const newDetail = { ...tool?.detail, ...toolInfo }
		if (!filterClickableMessageWithoutRevoked(node, props?.node) || isEmpty(tool?.detail)) {
			return
		}

		handleSelectDetail?.(newDetail)
	}

	if (tool && toolName === "create_client_side_file_bundle") {
		return (
			<FileDownloadCard
				toolData={tool}
				loading={loading}
				className={props.classNames?.markdown}
				onMouseEnter={props.onMouseEnter}
				onMouseLeave={props.onMouseLeave}
			/>
		)
	}

	if (
		tool &&
		(isInlineToolDetail(tool.detail) ||
			(toolName === "web_search" && tool.detail?.type === "search"))
	) {
		return (
			<OperationResultList
				toolData={tool}
				loading={loading}
				onSelectDetail={onSelectDetail}
				className={props.classNames?.markdown}
				onMouseEnter={props.onMouseEnter}
				onMouseLeave={props.onMouseLeave}
			/>
		)
	}

	return (
		<Suspense fallback={null}>
			<ToolComponent {...props} loading={loading} onClick={onProxyClick} />
		</Suspense>
	)
}

export default observer(ToolCall)
