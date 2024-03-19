import { useMemoizedFn } from "ahooks"
import type { MouseEvent as ReactMouseEvent } from "react"
import { magic } from "@/opensource/enhance/magicElectron"

/**
 * @description electron 中全局拖拽事件
 */
const useDrag = () => {
	const onMouseDown = useMemoizedFn((event: ReactMouseEvent<HTMLDivElement>) => {
		// 右击不移动，只有左击的时候触发
		if (event.button === 2) return
		// 记录位置
		const mouseX: number = event.clientX
		const mouseY: number = event.clientY

		function onMousemove(event: MouseEvent) {
			if (magic?.view?.setViewPositionV2) {
				magic?.view?.setViewPositionV2({
					x: event.clientX - mouseX,
					y: event.clientY - mouseY,
				})
			} else {
				magic?.view?.setViewPosition({
					x: mouseX,
					y: mouseY,
				})
			}
		}

		function onMouseup() {
			document.removeEventListener("mousemove", onMousemove)
			document.removeEventListener("mouseup", onMouseup)
		}

		document.addEventListener("mousemove", onMousemove)
		document.addEventListener("mouseup", onMouseup)
	})

	return {
		onMouseDown,
	}
}
export default useDrag
