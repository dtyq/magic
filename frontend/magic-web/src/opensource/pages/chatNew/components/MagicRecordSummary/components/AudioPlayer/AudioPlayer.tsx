import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import useStyle from "../../styles"

interface AudioPlayerProps {
	audioUrl: string
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl }) => {
	const { fontSize } = useFontSize()
	const { styles } = useStyle({ fontSize })
	const audioRef = useRef<HTMLAudioElement | null>(null) // 引用音频对象
	const [isPlaying, setIsPlaying] = useState(false) // 播放状态
	const [currentTime, setCurrentTime] = useState(0) // 当前播放时间
	const [duration, setDuration] = useState(0) // 音频总时长

	useEffect(() => {
		const audio = new Audio(audioUrl) // 创建一个音频对象
		audioRef.current = audio

		const handleLoadedMetadata = () => {
			setDuration(audio.duration)
		}

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime)
		}

		const handleEnded = () => {
			setIsPlaying(false) // 音频播放完毕后重置状态
			setCurrentTime(0)
		}

		// 绑定音频事件
		audio.addEventListener("loadedmetadata", handleLoadedMetadata)
		audio.addEventListener("timeupdate", handleTimeUpdate)
		audio.addEventListener("ended", handleEnded)

		return () => {
			// 清理事件绑定
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
			audio.removeEventListener("timeupdate", handleTimeUpdate)
			audio.removeEventListener("ended", handleEnded)
			audioRef.current = null
		}
	}, [audioUrl])

	// 播放或暂停音频
	const togglePlay = () => {
		const audio = audioRef.current
		if (!audio) return

		if (isPlaying) {
			audio.pause()
		} else {
			audio.play()
		}
		setIsPlaying(!isPlaying)
	}

	// 格式化时间（秒 -> hh:mm:ss）
	const formatTime = (time: number) => {
		const hours = Math.floor(time / 3600)
		const minutes = Math.floor((time % 3600) / 60)
		const seconds = Math.floor(time % 60)
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
	}

	return (
		<div className={styles.audioPlayer}>
			{/* SVG 播放/暂停按钮 */}
			{isPlaying ? (
				<svg
					width="30"
					height="30"
					viewBox="0 0 30 30"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					onClick={togglePlay}
					className={styles.playIcon}
				>
					<rect width="30" height="30" rx="15" fill="#FF7D00" />
					<rect x="9" y="9" width="4" height="12" rx="2" fill="white" />
					<rect x="17" y="9" width="4" height="12" rx="2" fill="white" />
				</svg>
			) : (
				<svg
					width="30"
					height="30"
					viewBox="0 0 30 30"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					onClick={togglePlay}
					className={styles.playIcon}
				>
					<rect width="30" height="30" rx="15" fill="#315CEC" />
					<path
						d="M21.0769 13.3159C22.3077 14.0644 22.3077 15.9356 21.0769 16.6841L12.7692 21.7366C11.5385 22.4851 10 21.5494 10 20.0524L10 9.94758C10 8.45057 11.5385 7.51493 12.7692 8.26344L21.0769 13.3159Z"
						fill="white"
					/>
				</svg>
			)}

			{/* 显示播放时间 */}
			<span className={styles.duration}>
				{!!currentTime || isPlaying ? formatTime(currentTime) : formatTime(duration)}
			</span>
		</div>
	)
}

export default AudioPlayer
