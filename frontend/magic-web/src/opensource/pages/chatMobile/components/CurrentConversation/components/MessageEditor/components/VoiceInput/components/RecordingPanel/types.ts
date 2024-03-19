import type { RecordingState, AudioWaveformData } from "../../types"

export interface RecordingPanelProps {
	recordingState: RecordingState
	waveformData: AudioWaveformData
	onClose?: () => void
	onCancel?: () => void
	onSendText?: (text?: string) => void
	onSendVoice?: () => void
	onEditText?: () => void
	onReset?: () => void
	className?: string
	// Touch event handlers for continuing to listen to touch events in fullscreen mode
	touchHandlers?: {
		onTouchStart?: (event: React.TouchEvent) => void
		onTouchMove?: (event: React.TouchEvent) => void
		onTouchEnd?: (event: React.TouchEvent) => void
		onMouseDown?: (event: React.MouseEvent) => void
		onMouseMove?: (event: React.MouseEvent) => void
		onMouseUp?: (event: React.MouseEvent) => void
		onMouseLeave?: (event: React.MouseEvent) => void
		onContextMenu?: (event: React.MouseEvent) => void
	}
}

export interface WaveformProps {
	color: string
	backgroundColor: string
}
