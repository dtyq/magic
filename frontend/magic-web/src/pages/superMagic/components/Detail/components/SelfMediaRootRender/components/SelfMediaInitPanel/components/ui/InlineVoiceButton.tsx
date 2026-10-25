import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Mic } from "lucide-react"
import { cn } from "@/utils/cn"
import { useVoiceInput } from "@/components/business/VoiceInput/hooks"
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission"

interface InlineVoiceButtonProps {
	value?: string
	onResult: (text: string) => void
	onError?: (error: Error) => void
	/** Position variant: 'input' for single-line inputs, 'textarea' for multi-line textareas */
	variant?: "input" | "textarea"
	className?: string
}

/**
 * Lightweight inline voice-input button that sits inside input/textarea fields.
 * Shows a small mic icon on hover/focus, animates when recording.
 */
export default function InlineVoiceButton({
	value = "",
	onResult,
	onError,
	variant = "input",
	className,
}: InlineVoiceButtonProps) {
	const { t } = useTranslation("super")
	const resultRef = useRef(onResult)
	resultRef.current = onResult
	const valueRef = useRef(value)
	valueRef.current = value
	const onErrorRef = useRef(onError)
	onErrorRef.current = onError
	const baseTextRef = useRef(value)
	const committedTextRef = useRef("")
	const currentSegmentRef = useRef("")

	const { handlePermissionError } = useMicrophonePermission()

	const { status, toggleRecording, disconnect } = useVoiceInput({
		onResult: (text) => {
			if (text.startsWith('sult":{"additions":{"log_id":')) {
				return
			}

			const nextText = mergeVoiceTranscription(text, {
				committedText: committedTextRef.current,
				currentSegment: currentSegmentRef.current,
			})
			committedTextRef.current = nextText.committedText
			currentSegmentRef.current = nextText.currentSegment
			resultRef.current(`${baseTextRef.current}${nextText.transcription}`)
		},
		onError: (error) => {
			try {
				handlePermissionError(error)
			} catch (nonPermissionError) {
				onErrorRef.current?.(nonPermissionError as Error)
			}
		},
	})

	const isActive = status === "recording" || status === "processing" || status === "connecting"

	const handleToggle = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!isActive) {
				baseTextRef.current = valueRef.current
				committedTextRef.current = ""
				currentSegmentRef.current = ""
			}

			try {
				await toggleRecording()
			} catch (error) {
				try {
					handlePermissionError(error as Error)
				} catch (nonPermissionError) {
					onErrorRef.current?.(nonPermissionError as Error)
				}
			}
		},
		[toggleRecording, handlePermissionError, isActive],
	)

	// 组件卸载时断开连接，释放资源
	useEffect(() => {
		return () => {
			disconnect()
		}
	}, [disconnect])

	return (
		<button
			type="button"
			className={cn(
				"absolute flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
				variant === "input" ? "right-1 top-1/2 -translate-y-1/2" : "right-1.5 top-1.5",
				isActive
					? "text-orange-500 hover:text-orange-600"
					: "opacity-0 hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100",
				className,
			)}
			title={
				isActive
					? t("detail.selfMedia.initPanel.voiceInput.stop", "停止语音输入")
					: t("detail.selfMedia.initPanel.voiceInput.start", "语音输入")
			}
			onClick={handleToggle}
			data-testid="handle-toggle"
		>
			{isActive ? (
				<span className="flex items-center gap-px">
					<span className="h-2 w-0.5 animate-pulse rounded-full bg-orange-500" />
					<span className="h-3 w-0.5 animate-pulse rounded-full bg-orange-500 delay-75" />
					<span className="h-2 w-0.5 animate-pulse rounded-full bg-orange-500 delay-150" />
				</span>
			) : (
				<Mic size={12} />
			)}
		</button>
	)
}

interface VoiceTranscriptionState {
	committedText: string
	currentSegment: string
}

function mergeVoiceTranscription(text: string, state: VoiceTranscriptionState) {
	let { committedText, currentSegment } = state

	if (!text) {
		committedText += currentSegment
		currentSegment = ""
		return {
			committedText,
			currentSegment,
			transcription: committedText,
		}
	}

	if (committedText && text.startsWith(committedText)) {
		currentSegment = text.slice(committedText.length)
		return {
			committedText,
			currentSegment,
			transcription: text,
		}
	}

	if (!currentSegment || text.startsWith(currentSegment) || currentSegment.startsWith(text)) {
		currentSegment = text
		return {
			committedText,
			currentSegment,
			transcription: `${committedText}${currentSegment}`,
		}
	}

	committedText += currentSegment
	currentSegment = text

	return {
		committedText,
		currentSegment,
		transcription: `${committedText}${currentSegment}`,
	}
}
