/**
 * 分享页 Playback 开始播放时发布。无参数。
 */
export type SuperMagicPlaybackStartArgs = []

/**
 * 所有 steps 均变为 finished / error 时发布，标志 Playback 播放结束。
 * 传入完整的 steps 列表和当前话题 ID，供订阅方更新播放状态。
 */
export interface SuperMagicPlaybackEndPayload {
	process: Array<{ status?: string; [key: string]: unknown }>
	topic_id: string
}
