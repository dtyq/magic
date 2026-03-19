import { useState, RefObject } from "react"
import { useLocalStorageState } from "ahooks"
import { platformKey } from "@/utils/storage"

interface UseResizableSidebarProps {
	containerRef: RefObject<HTMLElement>
	defaultWidth?: number
	minWidth?: number
	storageKey?: string
}

export const useResizableSidebar = ({
	containerRef,
	defaultWidth = 200,
	minWidth = 160,
	storageKey = "ppt-sidebar-width",
}: UseResizableSidebarProps) => {
	const [sidebarWidth, setSidebarWidth] = useLocalStorageState<number>(platformKey(storageKey), {
		defaultValue: defaultWidth,
	})
	const [isResizing, setIsResizing] = useState(false)

	const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsResizing(true)
		const startX = e.clientX
		const startWidth = sidebarWidth || defaultWidth
		const containerWidth = containerRef.current?.offsetWidth || window.innerWidth
		const maxWidth = containerWidth / 2

		const handleMouseMove = (mouseEvent: MouseEvent) => {
			const newWidth = startWidth + (mouseEvent.clientX - startX)
			setSidebarWidth(Math.min(Math.max(newWidth, minWidth), maxWidth))
		}

		const handleMouseUp = () => {
			setIsResizing(false)
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}

		document.addEventListener("mousemove", handleMouseMove)
		document.addEventListener("mouseup", handleMouseUp)
	}

	return {
		sidebarWidth: sidebarWidth || defaultWidth,
		setSidebarWidth,
		isResizing,
		handleResizeStart,
	}
}
