import { useLayoutEffect, useRef, useState } from "react"

export function useObserveBoxSize(active: boolean) {
	const ref = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState({ w: 0, h: 0 })
	useLayoutEffect(() => {
		if (!active) {
			return
		}
		const el = ref.current
		if (!el) {
			return
		}
		const read = () => {
			const cr = el.getBoundingClientRect()
			setSize({ w: cr.width, h: cr.height })
		}
		read()
		const ro = new ResizeObserver(read)
		ro.observe(el)
		return () => ro.disconnect()
	}, [active])
	return { ref, w: size.w, h: size.h }
}
