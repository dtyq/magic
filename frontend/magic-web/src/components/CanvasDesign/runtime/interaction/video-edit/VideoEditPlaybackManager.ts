import type { Canvas } from "../../core/Canvas"
import type {
	AudioPlaybackPrepareOptions,
	AudioPlaybackSnapshotHandler,
} from "../../resources/audio/AudioPlaybackManager"

export interface VideoEditAudioSource {
	audioElementId: string
	path: string
}

/**
 * 管理 VideoEdit 的独立音频播放会话。
 *
 * 音频资源解析、缓存和全局互斥仍复用画布基础设施；但每个 VideoEdit 使用自己的
 * session key，因此不会与被引用的 AudioElement 共享 HTMLAudioElement、进度或状态。
 */
export class VideoEditPlaybackManager {
	private readonly canvas: Canvas
	private readonly sources = new Map<string, VideoEditAudioSource>()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public bindAudio(editorId: string, source: VideoEditAudioSource | undefined): void {
		const previous = this.sources.get(editorId)
		if (
			previous?.audioElementId === source?.audioElementId &&
			previous?.path === source?.path
		) {
			return
		}
		if (previous) {
			this.canvas.audioPlaybackManager?.release?.(this.getSessionId(editorId))
		}
		if (source) {
			this.sources.set(editorId, source)
		} else {
			this.sources.delete(editorId)
		}
	}

	public subscribe(editorId: string, handler: AudioPlaybackSnapshotHandler): () => void {
		return (
			this.canvas.audioPlaybackManager?.subscribe?.(this.getSessionId(editorId), handler) ??
			(() => undefined)
		)
	}

	public toggle(editorId: string, source: VideoEditAudioSource): Promise<boolean> {
		this.bindAudio(editorId, source)
		return (
			this.canvas.audioPlaybackManager?.toggle?.(this.getSessionId(editorId), source.path) ??
			Promise.resolve(false)
		)
	}

	public prepare(
		editorId: string,
		source: VideoEditAudioSource,
		options?: AudioPlaybackPrepareOptions,
	): Promise<boolean> {
		this.bindAudio(editorId, source)
		return (
			this.canvas.audioPlaybackManager?.prepare?.(
				this.getSessionId(editorId),
				source.path,
				options,
			) ?? Promise.resolve(false)
		)
	}

	public seek(editorId: string, progress: number): void {
		this.canvas.audioPlaybackManager?.seek?.(this.getSessionId(editorId), progress)
	}

	public release(editorId: string): void {
		this.sources.delete(editorId)
		this.canvas.audioPlaybackManager?.release?.(this.getSessionId(editorId))
	}

	public destroy(): void {
		Array.from(this.sources.keys()).forEach((editorId) => this.release(editorId))
	}

	private getSessionId(editorId: string): string {
		return `video-edit:audio:${editorId}`
	}
}
