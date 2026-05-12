import type { RefObject } from "react"
import { Minimize2, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import chromeStyles from "../FullscreenMediaShell/chrome.module.css"
import styles from "./MediaControls.module.css"

function formatTime(seconds: number): string {
	const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
	const minutes = Math.floor(totalSeconds / 60)
	const remainingSeconds = totalSeconds % 60
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

/** 全屏底部控制条：进度、音量、退出全屏（视频 / 音频共用） */
export interface MediaControlsProps {
	visible: boolean
	/**
	 * 为 true 时（音频全屏）：底部渐变层始终可点，时间与进度条常显；
	 * `visible` 仅控制播放 / 音量 / 退出按钮区；进度行固定高度，避免随显隐跳动。
	 */
	progressAlwaysVisible?: boolean
	duration: number
	progressRangeRef: RefObject<HTMLInputElement | null>
	currentTimeLabelRef: RefObject<HTMLSpanElement | null>
	onProgressInput: (value: number) => void
	onScrubStart: () => void
	onScrubEnd: () => void
	isPlaying: boolean
	isMuted: boolean
	volume: number
	onTogglePlay: () => void
	onToggleMute: () => void
	onVolumeChange: (value: number) => void
	onExitClick: () => void
}

export default function MediaControls(props: MediaControlsProps) {
	const {
		visible,
		progressAlwaysVisible = false,
		duration,
		progressRangeRef,
		currentTimeLabelRef,
		onProgressInput,
		onScrubStart,
		onScrubEnd,
		isPlaying,
		isMuted,
		volume,
		onTogglePlay,
		onToggleMute,
		onVolumeChange,
		onExitClick,
	} = props

	const { t } = useCanvasDesignI18n()

	const actionsChromeClass = visible
		? styles.pinnedSecondaryVisible
		: styles.pinnedSecondaryHidden

	const progressInput = (
		<input
			ref={progressRangeRef}
			className={styles.progress}
			type="range"
			defaultValue={0}
			min={0}
			max={100}
			step={0.05}
			aria-label={t("video.fullscreen.progress", "播放进度")}
			aria-valuemin={0}
			aria-valuemax={100}
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId)
				onScrubStart()
			}}
			onPointerUp={(event) => {
				try {
					event.currentTarget.releasePointerCapture(event.pointerId)
				} catch {
					// 已释放或非 capture 场景
				}
				onScrubEnd()
			}}
			onInput={(event) => onProgressInput(Number(event.currentTarget.value))}
			onChange={(event) => onProgressInput(Number(event.currentTarget.value))}
		/>
	)

	const actionsBlock = (
		<div className={styles.actions}>
			<div className={styles.actionGroup}>
				<button
					type="button"
					className={styles.iconButton}
					onClick={onTogglePlay}
					aria-label={
						isPlaying
							? t("video.fullscreen.pause", "暂停")
							: t("video.fullscreen.play", "播放")
					}
				>
					{isPlaying ? <Pause size={22} /> : <Play size={22} />}
				</button>

				<div className={styles.volumeGroup}>
					<button
						type="button"
						className={styles.iconButton}
						onClick={onToggleMute}
						aria-label={
							isMuted
								? t("video.fullscreen.unmute", "取消静音")
								: t("video.fullscreen.mute", "静音")
						}
					>
						{isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
					</button>

					<div className={styles.volumeSliderWrap}>
						<input
							className={styles.volumeSlider}
							type="range"
							min={0}
							max={1}
							step={0.01}
							value={isMuted ? 0 : volume}
							onChange={(event) => onVolumeChange(Number(event.target.value))}
							aria-label={t("video.fullscreen.volume", "音量")}
						/>
					</div>
				</div>
			</div>

			<div className={styles.actionGroup}>
				<button
					type="button"
					className={styles.iconButton}
					onClick={onExitClick}
					aria-label={t("video.fullscreen.exit", "退出全屏")}
				>
					<Minimize2 size={22} />
				</button>
			</div>
		</div>
	)

	if (progressAlwaysVisible) {
		const layerClassName = [
			chromeStyles.layer,
			styles.root,
			styles.rootAudioPinned,
			chromeStyles.layerVisible,
		].join(" ")

		return (
			<div
				className={layerClassName}
				onClick={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<div className={styles.timeRow}>
					<span ref={currentTimeLabelRef}>00:00</span>
					<span>{formatTime(duration)}</span>
				</div>

				<div className={styles.progressPinnedWrap}>{progressInput}</div>

				<div className={actionsChromeClass}>{actionsBlock}</div>
			</div>
		)
	}

	const layerClassName = [
		chromeStyles.layer,
		styles.root,
		visible ? chromeStyles.layerVisible : chromeStyles.layerHidden,
	].join(" ")

	return (
		<div
			className={layerClassName}
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<div className={styles.timeRow}>
				<span ref={currentTimeLabelRef}>00:00</span>
				<span>{formatTime(duration)}</span>
			</div>

			{progressInput}

			{actionsBlock}
		</div>
	)
}
