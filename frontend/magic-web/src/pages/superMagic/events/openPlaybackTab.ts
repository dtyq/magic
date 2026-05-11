/**
 * 详情面板 / Playback Tab 共用的最小 detail 结构。
 * 只声明当前各消费方稳定依赖或反复出现的公共字段，其余字段继续通过索引签名透传。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Open_Playback_Tab, {
 *   id: "tool_123",
 *   name: "generate_canvas_images",
 *   type: "design",
 *   data: { file_id: "file_123" },
 * })
 */
export interface SuperMagicDetailPayload {
	id?: string
	name?: string
	type?: string
	url?: string
	action?: string
	remark?: string
	attachments?: unknown[]
	data?: {
		text?: string
		file_id?: string
		source_file_id?: string
		[key: string]: unknown
	}
	[key: string]: unknown
}

/**
 * 打开 Playback Tab 时发布，payload 直接透传 detail 对象。
 * 当前发布侧仍保留历史透传模式，但已收敛为共享 detail 最小结构。
 */
export type SuperMagicOpenPlaybackTabPayload = SuperMagicDetailPayload
