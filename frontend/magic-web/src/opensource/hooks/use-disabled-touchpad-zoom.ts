import { useEffect } from "react"

const useDisabledTouchpadZoom = () => {
	useEffect(() => {
		function disabledMouseWheel(e: WheelEvent) {
			/* * 无论是ctrl+滚轮，还是在触控板或者触摸屏上双指缩放 都会有如下规律
			 * 1、ctrlKey = true
			 * 2、delteX = 0
			 * 3、delteY != 0
			 * */
			if (e.ctrlKey && Math.abs(e.deltaY) !== 0) {
				e.preventDefault()
			}
		}

		document.addEventListener("wheel", disabledMouseWheel, { passive: false })

		return () => {
			document.removeEventListener("wheel", disabledMouseWheel)
		}
	})
}

export default useDisabledTouchpadZoom
