import { useMemoizedFn } from "ahooks"
import { useEffect, useState } from "react"

export default function useResize () {

	const [ windowSize, setWindowSize ] = useState({ width: 0, height: 0 })

	const updateResize = useMemoizedFn((event) => {
		setWindowSize({
			width: event.target.innerWidth,
			height: event.target.innerHeight
		})
	})

	const setInitialSize = useMemoizedFn(() => {
		setWindowSize({
			width: window.innerWidth,
			height: window.innerHeight
		})
	})

	useEffect(() => {
		setInitialSize()
		window.addEventListener("resize", (event) => updateResize(event))
		return () => {
			window.removeEventListener("resize", updateResize)
		}
	}, [ setInitialSize, updateResize ])

	return {
		windowSize
	}
}
