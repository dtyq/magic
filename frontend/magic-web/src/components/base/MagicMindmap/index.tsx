import type { AggregateAISearchCardMindMapChildren } from "@/types/chat/conversation_message"
import { createStyles } from "antd-style"
import type { HTMLAttributes } from "react"
import { memo, useEffect, useRef } from "react"
import MindMap from "simple-mind-map"

interface MagicMindMapProps extends HTMLAttributes<HTMLDivElement> {
	data?: AggregateAISearchCardMindMapChildren | null
	readonly?: boolean
}

const useStyles = createStyles(({ css }) => {
	return {
		mindmap: css`
			width: 100%;
			height: 381px;
		`,
	}
})

const MagicMindMap = memo(({ data, className, readonly = true, ...props }: MagicMindMapProps) => {
	const { styles, cx } = useStyles()
	const ref = useRef<HTMLDivElement>(null)
	const mindmapRef = useRef<MindMap | null>(null)

	useEffect(() => {
		if (ref.current && data) {
			try {
				mindmapRef.current = new MindMap({
					el: ref.current,
					data,
					readonly,
					initRootNodePosition: ["5%", "center"],
					isLimitMindMapInCanvas: true,
					mousewheelAction: "zoom",
					mousewheelMoveStep: 10,
					mouseScaleCenterUseMousePosition: false,
					fit: true,
				} as any)

				mindmapRef.current.setThemeConfig({
					lineWidth: 2,
					lineStyle: "curve",
				})
			} catch (error) {
				console.error(error)
			}
		}

		return () => {
			if (mindmapRef.current) {
				mindmapRef.current?.destroy()
				mindmapRef.current = null
			}
		}
	}, [data, readonly])

	useEffect(() => {
		const dom = ref.current
		const callback = () => {
			mindmapRef.current?.resize()
		}
		dom?.addEventListener("resize", callback)

		return () => {
			dom?.removeEventListener("resize", callback)
		}
	}, [])

	if (!data) return null

	return <div ref={ref} className={cx(styles.mindmap, className)} {...props} />
})

export default MagicMindMap
