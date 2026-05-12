/**
 * 视频媒体元数据与播放状态（只读快照），不依赖 Konva。
 * 与 VideoPlaybackController 分工：本类负责监听与聚合状态，控制器仅负责 play/pause 命令。
 */

/** 触发媒体快照回调的原因分类 */
export type VideoMediaChangeReason = "metadata" | "time" | "buffer" | "playback" | "error" | "stall"

export interface VideoMediaBufferedRange {
	/** 已缓冲区间起点（秒） */
	start: number
	/** 已缓冲区间终点（秒） */
	end: number
}

/** HTMLVideoElement 只读快照，供进度条与缓冲 UI 使用 */
export interface VideoMediaSnapshot {
	/** 总时长（秒），未知时为 0 */
	duration: number
	/** 当前播放位置（秒） */
	currentTime: number
	/** 视频轨像素宽 */
	videoWidth: number
	/** 视频轨像素高 */
	videoHeight: number
	/** HTMLMediaElement.readyState */
	readyState: number
	paused: boolean
	ended: boolean
	/** 播放速率 */
	playbackRate: number
	/** 已缓冲时间区间列表 */
	buffered: VideoMediaBufferedRange[]
	/** video.error?.code，无错误为 null */
	errorCode: number | null
	/** 播放中因缺数据卡住（waiting），与首包加载无关 */
	isBuffering: boolean
}

/** 媒体状态变更订阅回调 */
export type VideoMediaListener = (event: {
	reason: VideoMediaChangeReason
	snapshot: VideoMediaSnapshot
}) => void

function copyBuffered(ranges: TimeRanges): VideoMediaBufferedRange[] {
	const out: VideoMediaBufferedRange[] = []
	for (let i = 0; i < ranges.length; i++) {
		out.push({ start: ranges.start(i), end: ranges.end(i) })
	}
	return out
}

function snapshotFromVideo(video: HTMLVideoElement): Omit<VideoMediaSnapshot, "isBuffering"> {
	const err = video.error
	return {
		duration: Number.isFinite(video.duration) ? video.duration : 0,
		currentTime: video.currentTime,
		videoWidth: video.videoWidth,
		videoHeight: video.videoHeight,
		readyState: video.readyState,
		paused: video.paused,
		ended: video.ended,
		playbackRate: video.playbackRate,
		buffered: copyBuffered(video.buffered),
		errorCode: err ? err.code : null,
	}
}

const EMPTY_SNAPSHOT: VideoMediaSnapshot = {
	duration: 0,
	currentTime: 0,
	videoWidth: 0,
	videoHeight: 0,
	readyState: 0,
	paused: true,
	ended: false,
	playbackRate: 1,
	buffered: [],
	errorCode: null,
	isBuffering: false,
}

/**
 * 订阅 video 标签事件并聚合为 VideoMediaSnapshot，不负责调用 play/pause
 */
export class VideoMediaState {
	private video?: HTMLVideoElement
	private listeners = new Set<VideoMediaListener>()
	private waitingForData = false

	private onLoadedMetadata = () => this.emit("metadata")
	private onDurationChange = () => this.emit("metadata")
	private onRateChange = () => this.emit("metadata")
	private onTimeUpdate = () => this.emit("time")
	private onProgress = () => this.emit("buffer")
	private onPlay = () => this.emit("playback")
	private onPlaying = () => {
		this.waitingForData = false
		this.emit("playback")
	}
	private onPause = () => {
		this.waitingForData = false
		this.emit("playback")
	}
	private onEnded = () => {
		this.waitingForData = false
		this.emit("playback")
	}
	private onWaiting = () => {
		const v = this.video
		if (!v || v.paused || v.ended) {
			return
		}
		this.waitingForData = true
		this.emit("stall")
	}
	private onError = () => this.emit("error")

	private buildSnapshot(): VideoMediaSnapshot {
		if (!this.video) {
			return { ...EMPTY_SNAPSHOT, buffered: [] }
		}
		const base = snapshotFromVideo(this.video)
		const isBuffering = this.waitingForData && !base.paused && !base.ended
		return { ...base, isBuffering }
	}

	private emit(reason: VideoMediaChangeReason): void {
		if (!this.video) {
			return
		}
		const snapshot = this.buildSnapshot()
		this.listeners.forEach((fn) => fn({ reason, snapshot }))
	}

	/** 绑定 video 并注册监听，立即推送一帧快照 */
	public attach(video: HTMLVideoElement): void {
		this.detachListenersOnly()
		this.video = video
		this.waitingForData = false

		video.addEventListener("loadedmetadata", this.onLoadedMetadata)
		video.addEventListener("durationchange", this.onDurationChange)
		video.addEventListener("ratechange", this.onRateChange)
		video.addEventListener("timeupdate", this.onTimeUpdate)
		video.addEventListener("progress", this.onProgress)
		video.addEventListener("play", this.onPlay)
		video.addEventListener("playing", this.onPlaying)
		video.addEventListener("waiting", this.onWaiting)
		video.addEventListener("pause", this.onPause)
		video.addEventListener("ended", this.onEnded)
		video.addEventListener("error", this.onError)

		this.emit("metadata")
		this.emit("playback")
		this.emit("buffer")
	}

	/** 返回取消订阅函数 */
	public subscribe(listener: VideoMediaListener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	/** 当前时刻快照（无 video 时为零值） */
	public getSnapshot(): VideoMediaSnapshot {
		return this.buildSnapshot()
	}

	private detachListenersOnly(): void {
		if (!this.video) {
			return
		}
		const v = this.video
		v.removeEventListener("loadedmetadata", this.onLoadedMetadata)
		v.removeEventListener("durationchange", this.onDurationChange)
		v.removeEventListener("ratechange", this.onRateChange)
		v.removeEventListener("timeupdate", this.onTimeUpdate)
		v.removeEventListener("progress", this.onProgress)
		v.removeEventListener("play", this.onPlay)
		v.removeEventListener("playing", this.onPlaying)
		v.removeEventListener("waiting", this.onWaiting)
		v.removeEventListener("pause", this.onPause)
		v.removeEventListener("ended", this.onEnded)
		v.removeEventListener("error", this.onError)
	}

	/** 移除监听并清空订阅者 */
	public detach(): void {
		this.detachListenersOnly()
		this.video = undefined
		this.listeners.clear()
	}

	/** 等价于 detach */
	public destroy(): void {
		this.detach()
	}
}
