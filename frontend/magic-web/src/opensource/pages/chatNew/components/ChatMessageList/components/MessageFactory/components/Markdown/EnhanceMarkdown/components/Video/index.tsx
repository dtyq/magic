import { useState, useRef, type VideoHTMLAttributes } from "react"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "./styles"

interface VideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
	src?: string
	poster?: string
}

/**
 * Modern Video component with enhanced user experience
 */
function Video(props: VideoProps) {
	const { src, poster, className, style, onError, onLoadStart, onCanPlay, ...restProps } = props

	const { styles, cx } = useStyles()
	const videoRef = useRef<HTMLVideoElement>(null)
	const [error, setError] = useState(false)

	const handleVideoError = useMemoizedFn((e: React.SyntheticEvent<HTMLVideoElement>) => {
		setError(true)
		onError?.(e)
	})

	const handleRetry = useMemoizedFn(() => {
		setError(false)
		if (videoRef.current) {
			videoRef.current.load()
		}
	})

	// Error state
	if (error) {
		return (
			<div className={cx(styles.container, styles.errorContainer, className)} style={style}>
				<div className={styles.errorContent}>
					<span>Failed to load video</span>
					<button className={styles.retryButton} onClick={handleRetry}>
						Retry
					</button>
				</div>
			</div>
		)
	}

	// No src provided
	if (!src) {
		return (
			<div className={cx(styles.container, styles.placeholder, className)} style={style}>
				<div className={styles.placeholderContent}>
					<span>No video source provided</span>
				</div>
			</div>
		)
	}

	return (
		<div className={cx(styles.container, className)} style={style}>
			<video
				ref={videoRef}
				{...restProps}
				src={src}
				poster={poster}
				className={styles.video}
				onError={handleVideoError}
				onLoadStart={onLoadStart}
				onCanPlay={onCanPlay}
				controls
				preload="metadata"
			>
				Your browser does not support the video tag.
			</video>
		</div>
	)
}

export default Video
