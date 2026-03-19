import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import ReactDOM from "react-dom"
import { cn } from "@/lib/tiptap-utils"

interface TopicResizeHandleProps {
	className?: string
	disabled?: boolean
	onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void
	style?: CSSProperties
}

function TopicResizeHandle({
	className,
	disabled = false,
	onMouseDown,
	style,
}: TopicResizeHandleProps) {
	const [isDragging, setIsDragging] = useState(false)

	const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
		if (disabled) return
		setIsDragging(true)
		onMouseDown(event)
	}

	const handleOverlayMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
		const mouseEvent = new MouseEvent("mousemove", {
			clientX: event.clientX,
			clientY: event.clientY,
			bubbles: true,
			cancelable: true,
		})
		document.dispatchEvent(mouseEvent)
	}

	const handleOverlayMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
		setIsDragging(false)
		const mouseEvent = new MouseEvent("mouseup", {
			clientX: event.clientX,
			clientY: event.clientY,
			bubbles: true,
			cancelable: true,
		})
		document.dispatchEvent(mouseEvent)
	}

	useEffect(() => {
		if (!isDragging) return

		const handleMouseUp = () => {
			setIsDragging(false)
		}

		document.addEventListener("mouseup", handleMouseUp)
		return () => {
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [isDragging])

	return (
		<>
			<div
				style={style}
				data-slot="resizable-handle"
				onMouseDown={handleMouseDown}
				className={cn(
					"focus-visible:outline-hidden relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
					"group relative flex !w-2 cursor-col-resize items-center justify-center !bg-transparent",
					"overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:z-0",
					"before:bg-gradient-to-b before:from-[rgba(239,246,255,0)] before:via-[rgba(210,230,255,1)] before:to-[rgba(239,246,255,0)]",
					"before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100",
					"after:!w-4",
					"data-[panel-group-direction=vertical]:!h-2 data-[panel-group-direction=vertical]:!w-full",
					"data-[panel-group-direction=vertical]:before:bg-gradient-to-r",
					disabled && "pointer-events-none opacity-0",
					className,
				)}
			>
				<div className="relative z-10 flex h-5 shrink-0 items-center justify-center gap-0.5 data-[panel-group-direction=vertical]:h-auto data-[panel-group-direction=vertical]:w-5 data-[panel-group-direction=vertical]:flex-col">
					<div className="h-full w-px shrink-0 rounded-xs bg-muted-foreground transition-colors duration-200 group-hover:bg-primary data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full" />
					<div className="h-full w-px shrink-0 rounded-xs bg-muted-foreground transition-colors duration-200 group-hover:bg-primary data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full" />
				</div>
			</div>

			{isDragging &&
				ReactDOM.createPortal(
					<div
						className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent"
						onMouseMove={handleOverlayMouseMove}
						onMouseUp={handleOverlayMouseUp}
					/>,
					document.body,
				)}
		</>
	)
}

export default TopicResizeHandle
