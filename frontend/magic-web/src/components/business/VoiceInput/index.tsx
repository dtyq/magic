import { memo, useEffect, forwardRef, useImperativeHandle, useCallback, useRef } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useTranslation } from "react-i18next"
import { useVoiceInput, getHotkeyDisplayText } from "./hooks"
import type { VoiceInputProps, VoiceInputRef } from "./types"
import MagicIcon from "../../base/MagicIcon"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SpinLoading } from "antd-mobile"
import { GuideTourElementId } from "@/pages/superMagic/components/LazyGuideTour"
import { IconMicrophone } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Mic } from "lucide-react"

// Voice Wave Animation Component
const VoiceWave = ({ iconSize }: { iconSize: number }) => {
	return (
		<div
			className="flex h-full w-full items-center justify-center"
			style={{ height: iconSize, gap: iconSize * 0.1 }}
		>
			<div
				className="w-0.5 animate-voice-wave rounded-full bg-orange-500"
				style={{ height: iconSize * 0.4, animationDelay: "0s" }}
			/>
			<div
				className="w-0.5 animate-voice-wave rounded-full bg-orange-500"
				style={{ height: iconSize * 0.6, animationDelay: "0.1s" }}
			/>
			<div
				className="w-0.5 animate-voice-wave rounded-full bg-orange-500"
				style={{ height: iconSize * 0.8, animationDelay: "0.2s" }}
			/>
			<div
				className="w-0.5 animate-voice-wave rounded-full bg-orange-500"
				style={{ height: iconSize * 0.6, animationDelay: "0.3s" }}
			/>
			<div
				className="w-0.5 animate-voice-wave rounded-full bg-orange-500"
				style={{ height: iconSize * 0.4, animationDelay: "0.4s" }}
			/>
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
				disabled = false,
				placeholder,
				style,
				className,
				children,
				config,
				iconSize = 20,
				enableHotkey = true,
			},
			ref,
		) => {
			const { t } = useTranslation("component")
			const { status, isRecording, toggleRecording, stopRecording } = useVoiceInput({
				config,
				onResult,
				onError,
				onStatusChange,
			})

			// Handle hotkey press
			const handleHotkey = useCallback(() => {
				console.log("触发handleHotkey")

				if (disabled) return
				toggleRecording()
			}, [disabled, toggleRecording])

			// Use ref to keep the latest handleHotkey function
			const handleHotkeyRef = useRef(handleHotkey)
			handleHotkeyRef.current = handleHotkey

			const hotkeyDisplay = getHotkeyDisplayText()

			useImperativeHandle(
				ref,
				() => ({
					stopRecording,
					isRecording,
					status,
				}),
				[stopRecording, isRecording, status],
			)

			useEffect(() => {
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
						return <VoiceWave iconSize={iconSize} />
					case "connecting":
						return (
							<SpinLoading
								style={{
									width: iconSize,
									height: iconSize,
								}}
							/>
						)
					default:
						return <Mic size={iconSize} />
				}
			}

			const getTooltipText = () => {
				const hotkeyText = enableHotkey ? `(${hotkeyDisplay})` : ""
				switch (status) {
					case "idle":
						return `${t("voiceInput.tooltip.idle")}${hotkeyText}`
					case "recording":
						return `${t("voiceInput.tooltip.recording")}${hotkeyText}`
					case "error":
						return t("voiceInput.tooltip.error")
					default:
						return placeholder || t("voiceInput.tooltip.default")
				}
			}

			const handleClick = () => {
				if (disabled) return
				toggleRecording()
			}

			return (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							id={GuideTourElementId.VoiceInputButton}
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
					<TooltipContent side="top">{getTooltipText()}</TooltipContent>
				</Tooltip>
			)
		},
	),
)

VoiceInput.displayName = "VoiceInput"

export default VoiceInput
export type { VoiceInputProps, VoiceInputRef } from "./types"
