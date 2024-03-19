export interface RecordingMessage {
	id: string
	speaker: string
	content: string
	timestamp: string
}

export interface RecordingSummaryProps {
	isRecording?: boolean
	messages?: RecordingMessage[]
	duration?: string
	onCancel?: () => void
	onComplete?: () => void
	position?: { x: number; y: number }
	onPositionChange?: (position: { x: number; y: number }) => void
}

export interface DragState {
	isDragging: boolean
	dragOffset: { x: number; y: number }
}
