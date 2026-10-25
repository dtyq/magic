import { pick } from "lodash-es"
import { getToolDesignProjectInfo } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	getToolCardInteractionTarget,
	selectToolFile,
	selectToolDetail,
} from "../../toolDetailSelection"
import type { ToolCallViewModel } from "./types"

interface HandleToolCallInteractionOptions {
	toolData: ToolCallViewModel
	onSelectDetail?: (detail: unknown) => void
	filesStore?: ProjectFilesStore
}

export function handleToolCallInteraction({
	toolData,
	onSelectDetail,
	filesStore,
}: HandleToolCallInteractionOptions) {
	const toolInfo = pick(toolData, ["name", "url", "action", "remark", "id"])
	const newDetail = {
		...toolData.detail,
		...toolInfo,
		attachments: toolData.attachments,
	}

	const target = getToolCardInteractionTarget(toolData.name, toolData.detail)
	if (target.type === "disabled" || target.type === "inline") return

	if (target.type === "canvas") {
		const { designProjectId, designProject, elements } = getToolDesignProjectInfo(
			toolData,
			filesStore,
		)
		const canvasDesignId = String(designProjectId || "")
		if (!canvasDesignId) return
		pubsub.publish(PubSubEvents.Open_File_Tab, {
			...designProject,
			fileId: canvasDesignId,
		})
		if (elements.length > 0 && canvasDesignId) {
			setTimeout(() => {
				pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
					canvasDesignId,
					elementIds: elements.map((item) => item.id),
					selectElement: [elements[0].id],
					animated: false,
					padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
				})
			}, 200)
		}
		return
	}

	if (
		selectToolFile({
			detail: newDetail,
			target,
			onSelectDetail,
			filesStore,
		})
	) {
		return
	}

	selectToolDetail({ detail: newDetail, onSelectDetail })
}
