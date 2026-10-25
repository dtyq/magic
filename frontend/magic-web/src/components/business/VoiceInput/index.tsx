import {
	memo,
	useEffect,
	forwardRef,
	useImperativeHandle,
	useCallback,
	useRef,
	useState,
} from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useTranslation } from "react-i18next"
import { useVoiceInput, getHotkeyDisplayText } from "./hooks"
import type { VoiceInputProps, VoiceInputRef } from "./types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/utils/cn"
import { Mic } from "lucide-react"
import type { AudioChunkParams } from "@/services/voiceToText"

const DEFAULT_WAVE_BAR_COUNT = 11
const WAVE_MIN_LEVEL = 0.16
const WAVE_SMOOTHING_FACTOR = 0.65
const WAVE_GAIN = 9

function createIdleWaveLevels(barCount = DEFAULT_WAVE_BAR_COUNT): number[] {
	return Array.from({ length: barCount }, (_, index) => {
		const center = (barCount - 1) / 2
		const distanceFromCenter = Math.abs(index - center) / center
		return WAVE_MIN_LEVEL + (1 - distanceFromCenter) * 0.18
	})
}

function clampLevel(level: number): number {
	if (Number.isNaN(level) || !Number.isFinite(level)) return WAVE_MIN_LEVEL
	if (level < WAVE_MIN_LEVEL) return WAVE_MIN_LEVEL
	if (level > 1) return 1
	return level
}

function calculateAudioLevel(audioData: ArrayBuffer): number {
	if (audioData.byteLength < Int16Array.BYTES_PER_ELEMENT) return WAVE_MIN_LEVEL

	const samples = new Int16Array(audioData)
	if (samples.length === 0) return WAVE_MIN_LEVEL

	let sumSquares = 0
	for (let index = 0; index < samples.length; index += 1) {
		const normalizedSample = samples[index] / 32768
		sumSquares += normalizedSample * normalizedSample
	}

	const rms = Math.sqrt(sumSquares / samples.length)
	return clampLevel(rms * WAVE_GAIN)
}

function createNextWaveLevels(previousLevels: number[], level: number): number[] {
	const previousTail = previousLevels[previousLevels.length - 1] ?? WAVE_MIN_LEVEL
	const smoothedLevel = previousTail * WAVE_SMOOTHING_FACTOR + level * (1 - WAVE_SMOOTHING_FACTOR)

	return [...previousLevels.slice(1), clampLevel(smoothedLevel)]
}

function VoiceWave({
	iconSize,
	levels,
	className,
}: {
	iconSize: number
	levels: number[]
	className?: string
}) {
	return (
		<div
			className={cn(
				"flex h-full w-full items-center justify-center overflow-hidden",
				className,
			)}
			data-testid="voice-input-waveform"
			style={{ height: iconSize, gap: iconSize * 0.1 }}
		>
			{levels.map((level, index) => (
				<div
					key={index}
					className="w-0.5 shrink-0 rounded-full bg-orange-500 transition-[height] duration-150 ease-out"
					data-testid="voice-input-waveform-bar"
					style={{ height: Math.max(3, iconSize * clampLevel(level)) }}
				/>
			))}
		</div>
	)
}

export const VoiceInput = memo(
	forwardRef<VoiceInputRef, VoiceInputProps>(
		(
			{
				onResult,
				onError,
				onStatusChange,
				onRecordingChange,
				onAudioChunk,
				onWaveformLevelsChange,
				disabled = false,
				placeholder,
				className,
				children,
				toggleOnClick = true,
				config,
				iconSize = 20,
				waveformBarCount = DEFAULT_WAVE_BAR_COUNT,
				waveformClassName,
				enableHotkey = true,
				tooltipText,
				tooltipSide,
			},
			ref,
		) => {
			const { t } = useTranslation("component")
			const [waveLevels, setWaveLevels] = useState(() =>
				createIdleWaveLevels(waveformBarCount),
			)
			const isVoiceWaveVisibleRef = useRef(false)
			const handleAudioChunk = useCallback(
				(params: AudioChunkParams) => {
					onAudioChunk?.(params)
					if (!isVoiceWaveVisibleRef.current) return

					const nextLevel = calculateAudioLevel(params.audioData)
					setWaveLevels((currentLevels) => {
						const nextLevels = createNextWaveLevels(currentLevels, nextLevel)
						onWaveformLevelsChange?.(nextLevels)
						return nextLevels
					})
				},
				[onAudioChunk, onWaveformLevelsChange],
			)
			const { status, isRecording, toggleRecording, stopRecording, disconnect } =
				useVoiceInput({
					config,
					onResult,
					onError,
					onStatusChange,
					onAudioChunk: handleAudioChunk,
				})
			const isVoiceWaveVisible =
				status === "connecting" || status === "recording" || status === "processing"
			const hasReportedRecordingStateRef = useRef(false)

			// Handle hotkey press
			const handleHotkey = useCallback(() => {
				if (disabled) return
				void toggleRecording()
			}, [disabled, toggleRecording])

			// Use ref to keep the latest handleHotkey function
			const handleHotkeyRef = useRef(handleHotkey)
			handleHotkeyRef.current = handleHotkey

			const hotkeyDisplay = getHotkeyDisplayText()

			useImperativeHandle(
				ref,
				() => ({
					stopRecording,
					disconnect,
					isRecording,
					status,
				}),
				[stopRecording, disconnect, isRecording, status],
			)

			useEffect(() => {
				isVoiceWaveVisibleRef.current = isVoiceWaveVisible
				if (!isVoiceWaveVisible) {
					const idleLevels = createIdleWaveLevels(waveformBarCount)
					setWaveLevels(idleLevels)
					onWaveformLevelsChange?.(idleLevels)
				}
			}, [isVoiceWaveVisible, onWaveformLevelsChange, waveformBarCount])

			useEffect(() => {
				if (!hasReportedRecordingStateRef.current && !isRecording) {
					hasReportedRecordingStateRef.current = true
					return
				}

				hasReportedRecordingStateRef.current = true
				onRecordingChange?.(isRecording)
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [isRecording])

			useEffect(() => {
				const handleVoiceInputToggle = () => {
					handleHotkeyRef.current()
				}

				pubsub.subscribe(PubSubEvents.Toggle_Voice_Input, handleVoiceInputToggle)
				return () => {
					pubsub?.unsubscribe(PubSubEvents.Toggle_Voice_Input, handleVoiceInputToggle)
				}
			}, [])

			const getIcon = () => {
				switch (status) {
					case "recording":
					case "processing":
					case "connecting":
						return (
							<VoiceWave
								iconSize={iconSize}
								levels={waveLevels}
								className={waveformClassName}
							/>
						)
					default:
						return <Mic size={iconSize} />
				}
			}

			const getTooltipText = () => {
				if (tooltipText) return tooltipText
				const hotkeyText = enableHotkey ? `(${hotkeyDisplay})` : ""
				switch (status) {
					case "idle":
						return `${t("voiceInput.tooltip.idle")} ${hotkeyText}`
					case "recording":
						return `${t("voiceInput.tooltip.recording")} ${hotkeyText}`
					case "error":
						return t("voiceInput.tooltip.error")
					default:
						return placeholder || t("voiceInput.tooltip.default")
				}
			}

			const handleClick = () => {
				if (disabled) return
				if (!toggleOnClick) return
				void toggleRecording()
			}

			return (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className={cn(
								"relative flex items-center justify-center rounded-md border-0 transition-all",
								"hover:opacity-80 active:opacity-60",
								"disabled:cursor-not-allowed disabled:opacity-60",
								// base: idle, connecting, default
								"bg-fill text-foreground dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
								// recording / processing
								(status === "recording" || status === "processing") &&
									"bg-orange-50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
								// error
								status === "error" &&
									"bg-destructive text-destructive-foreground opacity-90 dark:bg-destructive dark:text-destructive-foreground",
								className,
							)}
							onClick={handleClick}
							disabled={disabled}
							aria-label={getTooltipText()}
							data-testid="voice-input-button"
							data-status={status}
							data-recording={isRecording}
						>
							{children || getIcon()}
						</button>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide ?? "top"}>{getTooltipText()}</TooltipContent>
				</Tooltip>
			)
		},
	),
)

VoiceInput.displayName = "VoiceInput"

export default VoiceInput
export type { VoiceInputProps, VoiceInputRef, VoiceInputStatus } from "./types"
