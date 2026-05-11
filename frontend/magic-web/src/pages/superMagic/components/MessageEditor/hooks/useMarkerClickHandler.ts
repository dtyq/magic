import { useCallback } from "react"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType, CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import { JSONContent } from "@tiptap/core"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	findMarkerByMarkNumber,
	extractMarkNumber,
	extractMarkerData,
} from "../utils/markerContentUtils"

/**
 * Marker 点击场景配置
 */
export type MarkerClickScene =
	| "messageEditorMentionList" // MessageEditor 中的 mentionList
	| "messageEditorTiptap" // MessageEditor 中的 tiptapEditor
	| "messageList" // 消息列表
	| "draftBox" // 草稿箱

/**
 * Marker 点击上下文配置
 */
export interface MarkerClickContext {
	/** 场景类型 */
	scene: MarkerClickScene
	/** 是否禁用点击 */
	disabled?: boolean
	/** 转换后的 marker 数据（可选） */
	transformedMarkerData?: CanvasMarkerMentionData | null
	/** 消息的 content（用于消息列表中查找完整数据） */
	messageContent?: JSONContent | string | Record<string, unknown>
}

/**
 * Marker 点击处理 Hook
 *
 * @param context - 点击上下文配置
 * @returns handleMarkerClick 函数
 */
export function useMarkerClickHandler(context: MarkerClickContext) {
	const { scene, disabled, transformedMarkerData, messageContent } = context

	const handleMarkerClick = useCallback(
		(item: TiptapMentionAttributes) => {
			// 只处理 DESIGN_MARKER 类型
			if (item.type !== MentionItemType.DESIGN_MARKER) {
				return
			}

			// 如果禁用，直接返回
			if (disabled) {
				return
			}

			// 提取完整的 marker 数据
			let markerData: CanvasMarkerMentionData | null = null

			// 根据场景决定数据提取策略
			if (scene === "messageList") {
				// 消息列表：优先从 content 中查找
				const markNumber = extractMarkNumber(item.data)
				if (markNumber !== undefined && messageContent) {
					markerData = findMarkerByMarkNumber(messageContent, markNumber)
				}
				// 如果没找到，尝试使用转换后的数据
				if (!markerData && transformedMarkerData) {
					markerData = transformedMarkerData
				}
			} else {
				// 其他场景：使用转换后的数据或直接使用 item.data
				markerData = extractMarkerData(
					item.data,
					transformedMarkerData || null,
					messageContent,
				)
			}

			// 验证数据完整性
			if (
				!markerData?.marker_id ||
				!markerData?.element_id ||
				!markerData?.design_project_id
			) {
				return
			}

			const elementId = markerData.element_id
			const designProjectId = markerData.design_project_id

			if (scene === "draftBox") {
				// 草稿箱应该被 disabled 拦截，这里不应该执行到
				return
			}

			pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
				canvasDesignId: designProjectId,
				elementIds: [elementId],
				animated: true,
				selectElement: true,
				padding: {
					top: "25%",
					right: "25%",
					bottom: "25%",
					left: "25%",
				},
			})
		},
		[scene, disabled, transformedMarkerData, messageContent],
	)

	return {
		handleMarkerClick,
	}
}
