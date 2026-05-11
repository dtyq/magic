import type { PaddingInsetConfig, Marker } from "@/components/CanvasDesign/canvas/types"
import type { IdentifyImageMarkResponse } from "@/components/CanvasDesign/types.magic"
import type { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import type { SuperMagicMessageQueueMessage } from "@/types/chat/intermediate_message"

/**
 * Super_Magic_Focus_Canvas_Element 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Focus_Canvas_Element, {
 *   canvasDesignId: "design_123",
 *   elementIds: ["element_1"],
 *   animated: true,
 * })
 */
export interface SuperMagicFocusCanvasElementPayload {
	isFromPlaybackToolNode?: boolean
	canvasDesignId: string
	elementIds: string[]
	selectElement?: string[] | boolean
	animated?: boolean
	padding?: PaddingInsetConfig
}

/**
 * Super_Magic_Marker_Data_Updated 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
 *   markerId: "marker_1",
 *   designProjectId: "design_123",
 *   loading: false,
 * })
 */
export interface SuperMagicMarkerDataUpdatedPayload {
	markerId?: string
	designProjectId?: string
	result?: IdentifyImageMarkResponse
	error?: string
	suggestions?: IdentifyImageMarkResponse["suggestions"]
	selectedSuggestionIndex?: number
	loading?: boolean
	updates?: Array<{
		markerId: string
		data: Partial<CanvasMarkerMentionData>
	}>
}

/**
 * Super_Magic_Marker_Removed 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Marker_Removed, {
 *   markerId: "marker_1",
 *   designProjectId: "design_123",
 *   source: "chat",
 * })
 */
export interface SuperMagicMarkerRemovedPayload {
	markerId: string
	designProjectId?: string
	source: "canvas" | "chat"
}

/**
 * Super_Magic_Markers_Synced_To_Manager 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Markers_Synced_To_Manager, {
 *   designProjectId: "design_123",
 * })
 */
export interface SuperMagicMarkersSyncedToManagerPayload {
	designProjectId?: string
}

/**
 * Super_Magic_Clear_Canvas_Markers 的标准 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Super_Magic_Clear_Canvas_Markers, { reason: "topic-changed" })
 */
export interface SuperMagicClearCanvasMarkersPayload {
	reason?: string
}

/**
 * SuperMagicMessageQueueConsumed 的参数 contract。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.SuperMagicMessageQueueConsumed, message)
 */
export type SuperMagicQueueConsumedArgs = [message?: SuperMagicMessageQueueMessage]

/**
 * Marker 更新草稿结构。
 */
export interface SuperMagicMarkerUpdateDraft {
	markerId: string
	designProjectId: string
	data: Partial<CanvasMarkerMentionData>
}

/**
 * Marker 数据别名。
 */
export type SuperMagicMarkerData = Marker
