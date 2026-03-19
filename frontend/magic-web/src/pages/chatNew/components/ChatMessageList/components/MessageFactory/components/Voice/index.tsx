import { VoiceConversationMessage } from "@/types/chat/conversation_message"
import { memo, useRef, useState, useCallback, useEffect } from "react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import IconVoice from "@/enhance/tabler/icons-react/icons/IconVoice"
import FlexBox from "@/components/base/FlexBox"
import { observer } from "mobx-react-lite"
import ChatFileService from "@/services/chat/file/ChatFileService"

const useStyles = createStyles(({ css }) => ({
	voice: css`
		min-width: 120px;
		cursor: pointer;

		/* Remove mobile touch highlight */
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		-khtml-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
		touch-action: manipulation;
	`,
}))

function Voice({ content }: { content?: VoiceConversationMessage["voice"] }) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const audioRef = useRef<HTMLAudioElement>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	const files = content?.attachments
	const fileInfo = ChatFileService.getFileInfoCache(content?.attachments?.[0]?.file_id)
	const { url } = fileInfo ?? {}

	const handlePlayPause = useCallback(async () => {
		if (!audioRef.current || !url) {
			setHasError(true)
			return
		}

		// Reset error state
		setHasError(false)

		if (isPlaying) {
			audioRef.current.pause()
			setIsPlaying(false)
		} else {
			try {
				setIsLoading(true)
				await audioRef.current.play()
				setIsPlaying(true)
			} catch (error) {
				console.error("Audio playback failed:", error)
				setIsPlaying(false)
				setHasError(true)
			} finally {
				setIsLoading(false)
			}
		}
	}, [isPlaying, url])

	const handleAudioEnded = useCallback(() => {
		setIsPlaying(false)
		setCurrentTime(0)
		setIsLoading(false)
	}, [])

	const handleTimeUpdate = useCallback(() => {
		if (audioRef.current) {
			setCurrentTime(audioRef.current.currentTime)
		}
	}, [])

	const handleAudioError = useCallback(() => {
		setIsPlaying(false)
		setIsLoading(false)
		setHasError(true)
	}, [])

	const handleAudioLoadStart = useCallback(() => {
		setIsLoading(true)
		setHasError(false)
	}, [])

	const handleAudioCanPlay = useCallback(() => {
		setIsLoading(false)
	}, [])

	// Set up audio event listeners
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return

		audio.addEventListener("loadstart", handleAudioLoadStart)
		audio.addEventListener("canplay", handleAudioCanPlay)
		audio.addEventListener("error", handleAudioError)

		return () => {
			audio.removeEventListener("loadstart", handleAudioLoadStart)
			audio.removeEventListener("canplay", handleAudioCanPlay)
			audio.removeEventListener("error", handleAudioError)
		}
	}, [handleAudioLoadStart, handleAudioCanPlay, handleAudioError])

	if (!files || files.length === 0) {
		return null
	}

	const voiceDuration = formatDuration(content?.duration || 0)
	const displayTime = isPlaying ? formatDuration(Math.floor(currentTime)) : voiceDuration

	// Show error state with retry option
	if (hasError) {
		return (
			<FlexBox className={styles.voice} gap={4} align="center">
				<MagicIcon
					component={IconVoice}
					size={24}
					color="currentColor"
					style={{ opacity: 0.5 }}
				/>
				<FlexBox vertical gap={2}>
					<span style={{ color: "#ff4d4f", fontSize: "12px" }}>
						{t("voice.playbackError")}
					</span>
					<span
						style={{
							color: "#1890ff",
							fontSize: "10px",
							cursor: "pointer",
							textDecoration: "underline",
						}}
						onClick={handlePlayPause}
					>
						{t("voice.retry")}
					</span>
				</FlexBox>
			</FlexBox>
		)
	}

	return (
		<FlexBox className={styles.voice} gap={4} align="center" onClick={handlePlayPause}>
			<MagicIcon
				component={IconVoice}
				size={24}
				color="currentColor"
				style={{ opacity: isLoading ? 0.5 : 1 }}
			/>
			{isLoading ? t("voice.loading") : displayTime}
			{url && (
				<audio
					ref={audioRef}
					src={url}
					onEnded={handleAudioEnded}
					onTimeUpdate={handleTimeUpdate}
					preload="metadata"
					style={{ display: "none" }}
				/>
			)}
		</FlexBox>
	)
}

export default memo(observer(Voice))

function formatDuration(duration: number): string {
	const minutes = Math.floor(duration / 60)
	const seconds = Math.floor(duration % 60)
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
