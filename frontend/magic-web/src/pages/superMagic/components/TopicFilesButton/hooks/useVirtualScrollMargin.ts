import { useLayoutEffect, useState, type RefObject } from "react"

/** 树和网格共用滚动区时，虚拟行坐标必须包含各自列表在滚动内容中的偏移。 */
export function useVirtualScrollMargin(scrollElementRef?: RefObject<HTMLElement>) {
	const [element, setElement] = useState<HTMLDivElement | null>(null)
	const [scrollMargin, setScrollMargin] = useState(0)
	useLayoutEffect(() => {
		const scroll = scrollElementRef?.current
		if (!element || !scroll) return
		const update = () =>
			setScrollMargin(
				element.getBoundingClientRect().top -
					scroll.getBoundingClientRect().top -
					scroll.clientTop +
					scroll.scrollTop,
			)
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		observer.observe(scroll)
		if (scroll.firstElementChild) observer.observe(scroll.firstElementChild)
		return () => observer.disconnect()
	}, [element, scrollElementRef])
	return {
		ref: scrollElementRef ? setElement : undefined,
		scrollMargin: scrollElementRef ? scrollMargin : 0,
	}
}
