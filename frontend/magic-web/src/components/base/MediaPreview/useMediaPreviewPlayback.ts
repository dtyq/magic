import { useCallback, useRef } from "react"

interface PlaybackState {
	src: string
	time: number
	volume: number
	muted: boolean
	rate: number
	shouldResume: boolean
}

/** 同一资源换签名地址时恢复播放；组件卸载后状态一起释放。 */
export function useMediaPreviewPlayback() {
	const state = useRef<PlaybackState | null>(null)
	const remember = useCallback((media: HTMLMediaElement) => {
		const src = media.getAttribute("src") || ""
		// 换 src 会产生自动 pause/timeupdate，不能覆盖旧地址最后的有效播放状态。
		if (media.readyState < 1 || (state.current && state.current.src !== src)) return
		state.current = {
			src,
			time: media.currentTime,
			volume: media.volume,
			muted: media.muted,
			rate: media.playbackRate,
			shouldResume: !media.paused && !media.ended,
		}
	}, [])
	const restore = useCallback((media: HTMLMediaElement): PlaybackState | null => {
		const saved = state.current
		const src = media.getAttribute("src") || ""
		if (!saved) return null
		media.currentTime = Number.isFinite(media.duration)
			? Math.min(saved.time, media.duration)
			: saved.time
		media.volume = saved.volume
		media.muted = saved.muted
		media.playbackRate = saved.rate
		state.current = { ...saved, src }
		return saved
	}, [])
	const reset = useCallback(() => {
		state.current = null
	}, [])
	return { remember, restore, reset }
}
