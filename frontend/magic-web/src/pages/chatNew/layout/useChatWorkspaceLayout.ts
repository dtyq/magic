import { useEffect, useState, type RefObject } from "react"
import { resolveChatWorkspaceLayout } from "./resolveWorkspaceLayout"
import type { ChatWorkspaceLayoutResult, ChatWorkspaceSpec } from "./types"
function getAvailableSize(container: HTMLElement | null) {
	if (container) {
		const { width, height } = container.getBoundingClientRect()
		return { width, height }
	}

	return {
		width: typeof window === "undefined" ? 0 : window.innerWidth,
		height: typeof window === "undefined" ? 0 : window.innerHeight,
	}
}

export function useChatWorkspaceLayout(
	containerRef: RefObject<HTMLElement | null>,
	spec: ChatWorkspaceSpec,
): ChatWorkspaceLayoutResult {
	const [layout, setLayout] = useState<ChatWorkspaceLayoutResult>(() =>
		resolveChatWorkspaceLayout({
			availableWidth: getAvailableSize(containerRef.current).width,
			availableHeight: getAvailableSize(containerRef.current).height,
			spec,
		}),
	)

	useEffect(() => {
		const updateLayout = () => {
			const { width, height } = getAvailableSize(containerRef.current)
			setLayout(
				resolveChatWorkspaceLayout({
					availableWidth: width,
					availableHeight: height,
					spec,
				}),
			)
		}

		updateLayout()
		const container = containerRef.current
		const resizeObserver =
			container && typeof ResizeObserver !== "undefined"
				? new ResizeObserver(updateLayout)
				: undefined
		resizeObserver?.observe(container)
		window.addEventListener("resize", updateLayout)
		return () => {
			resizeObserver?.disconnect()
			window.removeEventListener("resize", updateLayout)
		}
	}, [containerRef, spec])

	return layout
}
