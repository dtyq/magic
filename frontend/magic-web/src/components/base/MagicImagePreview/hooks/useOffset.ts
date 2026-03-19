import { useEffect, useRef, useState } from "react"
import { useMemoizedFn, useThrottle } from "ahooks"

const useOffset = (imageRef: React.RefObject<HTMLElement>) => {
	const [offset, setOffset] = useState({ x: 0, y: 0 })
	const isDragging = useRef(false)
	const startPos = useRef({ x: 0, y: 0 })
	const lastOffset = useRef({ x: 0, y: 0 })

	const handlePointerDown = useMemoizedFn((e: PointerEvent) => {
		// 防止拖拽svg元素
		if (e.target instanceof SVGSVGElement || e.target instanceof SVGPathElement) return

		// 右键点击，不进行拖拽
		if (e.button === 2) return

		isDragging.current = true
		startPos.current = { x: e.clientX, y: e.clientY }
		lastOffset.current = offset

		if (imageRef.current) {
			imageRef.current.style.cursor = "grabbing"
			imageRef.current.setPointerCapture(e.pointerId)
		}
	})

	const handlePointerMove = useMemoizedFn((e: PointerEvent) => {
		if (!isDragging.current) return

		const deltaX = e.clientX - startPos.current.x
		const deltaY = e.clientY - startPos.current.y

		setOffset({
			x: lastOffset.current.x + deltaX,
			y: lastOffset.current.y + deltaY,
		})
	})

	const handlePointerUp = useMemoizedFn((e: PointerEvent) => {
		isDragging.current = false
		if (imageRef.current) {
			imageRef.current.style.cursor = "grab"
			imageRef.current.releasePointerCapture(e.pointerId)
		}
	})

	useEffect(() => {
		const image = imageRef.current

		image?.addEventListener("pointerdown", handlePointerDown)
		image?.addEventListener("pointermove", handlePointerMove)
		image?.addEventListener("pointerup", handlePointerUp)
		image?.addEventListener("pointercancel", handlePointerUp)

		return () => {
			image?.removeEventListener("pointerdown", handlePointerDown)
			image?.removeEventListener("pointermove", handlePointerMove)
			image?.removeEventListener("pointerup", handlePointerUp)
			image?.removeEventListener("pointercancel", handlePointerUp)
		}
	}, [handlePointerDown, handlePointerMove, handlePointerUp, imageRef])

	return {
		offset: useThrottle(offset, { wait: 50 }),
		setOffset,
	}
}

export default useOffset
