/**
 * 画布内联预览与全屏层各持有一个 HTMLVideoElement，通过 consumerId 在 VideoPlaybackManager 中登记与复用。
 */

/** 内联 Konva 预览区域对应的播放会话 id */
export function buildInlineVideoPlaybackConsumerId(elementId: string): string {
	return `video:inline:${elementId}`
}

/** 全屏浮层对应的播放会话 id */
export function buildFullscreenVideoPlaybackConsumerId(elementId: string): string {
	return `video:fullscreen:${elementId}`
}
