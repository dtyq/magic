/**
 * 视频播放命令：绑定已有 HTMLVideoElement，仅提供 play/pause/toggle。
 * 媒体元数据与事件请使用 VideoMediaState。
 */
export class VideoPlaybackController {
	private video?: HTMLVideoElement

	/** 切换绑定的 video，更换前会 pause 旧实例 */
	public attach(video: HTMLVideoElement): void {
		if (this.video === video) {
			return
		}
		if (this.video) {
			this.video.pause()
		}
		this.video = video
	}

	/** 当前绑定的 HTMLVideoElement */
	public getVideo(): HTMLVideoElement | undefined {
		return this.video
	}

	/** 未绑定时视为已暂停 */
	public get paused(): boolean {
		return this.video?.paused ?? true
	}

	/** 调用底层 video.play()（不吞 Promise 拒绝，由调用方 catch） */
	public async play(): Promise<void> {
		await this.video?.play()
	}

	/** 暂停当前绑定的 video */
	public pause(): void {
		this.video?.pause()
	}

	/** 在当前实例上播放/暂停切换 */
	public toggle(): void {
		if (!this.video) {
			return
		}
		if (this.video.paused) {
			void this.video.play()
		} else {
			this.video.pause()
		}
	}

	/** pause 并解除引用 */
	public detach(): void {
		if (this.video) {
			this.video.pause()
		}
		this.video = undefined
	}

	/** 等价于 detach */
	public destroy(): void {
		this.detach()
	}
}
