import "./animations.css"

// Recording indicator with breathing light animation
function RecordingIndicator() {
	return (
		<div className="relative inline-flex h-3 w-3 flex-shrink-0 items-center justify-center">
			<div className="recording-indicator-pulse absolute h-3 w-3 rounded-full bg-[rgba(255,77,79,0.3)] [z-index:1]" />
			<div className="recording-indicator-dot relative h-2 w-2 rounded-full bg-[#ff4d4f] [z-index:2]" />
		</div>
	)
}

export default RecordingIndicator
