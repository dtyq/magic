import { useDebounceEffect, useUpdate } from "ahooks"
import { useEffect, useRef } from "react"

/**
 * 判断是否正在流式输出
 * @param value 流式输出的值
 * @param delay 流式输出的延迟时间
 * @returns 是否正在流式输出
 */
export const useIsStreaming = (value: string, delay = 500) => {
	const isStreaming = useRef(true)
	const firstRender = useRef(true)
	const update = useUpdate()

	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false
			return
		}

		isStreaming.current = true
		update()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value])

	// 流式输出延迟
	useDebounceEffect(
		() => {
			if (isStreaming.current) isStreaming.current = false
			update()
		},
		[value],
		{
			wait: delay,
		},
	)

	return { isStreaming: isStreaming.current }
}
