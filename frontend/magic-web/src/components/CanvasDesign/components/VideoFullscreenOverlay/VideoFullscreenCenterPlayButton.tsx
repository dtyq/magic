import { VideoSolidPause, VideoSolidPlay } from "../ui/icons"
import styles from "./VideoFullscreenCenterPlayButton.module.css"

/** 全屏层中央大号播放/暂停，与边缘控制条显隐策略独立 */
export interface VideoFullscreenCenterPlayButtonProps {
	visible: boolean
	isPlaying: boolean
	onToggle: () => void
	playAriaLabel: string
	pauseAriaLabel: string
}

/** 全屏视频中央播放切换按钮 */
export default function VideoFullscreenCenterPlayButton(
	props: VideoFullscreenCenterPlayButtonProps,
) {
	const { visible, isPlaying, onToggle, playAriaLabel, pauseAriaLabel } = props

	const wrapClassName = [styles.wrap, visible ? styles.wrapVisible : styles.wrapHidden].join(" ")

	const iconClass = `${styles.icon} ${styles.iconSvg}`

	return (
		<div className={wrapClassName} aria-hidden={!visible}>
			<button
				type="button"
				className={styles.centerButton}
				onClick={(event) => {
					event.stopPropagation()
					onToggle()
				}}
				onPointerDown={(event) => event.stopPropagation()}
				aria-label={isPlaying ? pauseAriaLabel : playAriaLabel}
			>
				{isPlaying ? (
					<VideoSolidPause className={iconClass} color="currentColor" />
				) : (
					<VideoSolidPlay
						className={`${iconClass} ${styles.playIcon}`}
						color="currentColor"
					/>
				)}
			</button>
		</div>
	)
}
