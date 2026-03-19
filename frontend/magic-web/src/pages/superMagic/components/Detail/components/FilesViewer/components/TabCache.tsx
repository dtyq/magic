import { memo, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import Render from "../../../Render"
import PlaybackTabContent, { type PlaybackTabContentProps } from "./PlaybackTabContent"
import { PLAYBACK_TAB_ID } from "../hooks/usePlaybackTab"

interface TabCacheProps {
	tab: {
		id: string
		refreshKey?: string
		[key: string]: unknown
	}
	isActive: boolean
	renderProps: Record<string, unknown>
	onActiveFileChange?: (fileId: string | null) => void
	isFullscreen?: boolean
	openFileTab?: (fileId: string, autoEdit?: boolean) => void
	playbackProps?: PlaybackTabContentProps
}

/**
 * TabCache - 单个 Tab 的缓存组件
 * 通过 CSS 控制显隐，保持组件实例挂载状态
 */
const TabCache = memo(
	({
		tab,
		isActive,
		renderProps,
		onActiveFileChange,
		isFullscreen,
		openFileTab,
		playbackProps,
	}: TabCacheProps) => {
		const isPlaybackTab = tab.id === PLAYBACK_TAB_ID
		const tabContentRef = useRef<HTMLDivElement>(null)

		// 使用 useMemo 缓存渲染属性，避免不必要的重新渲染

		// 处理文件激活状态变化
		const handleActiveFileChange = useCallback(
			(fileId: string | null) => {
				onActiveFileChange?.(fileId)
			},
			[onActiveFileChange],
		)

		// 监听 tab 激活状态变化，当 tab 变为非激活时暂停音频播放
		useEffect(() => {
			if (!isActive && tabContentRef.current) {
				// 查找所有 iframe 元素
				const iframes = tabContentRef.current.querySelectorAll("iframe")
				iframes.forEach((iframe) => {
					try {
						// 向 iframe 发送暂停消息
						iframe.contentWindow?.postMessage(
							{
								type: "tabDeactivated",
							},
							"*",
						)
					} catch (error) {
						console.error("发送 tab 切换消息失败:", error)
					}
				})
			}
		}, [isActive])

		// For playback tab, use isFullscreen from playbackProps
		const effectiveIsFullscreen = isPlaybackTab
			? playbackProps?.isFullscreen === true
			: isFullscreen

		return (
			<div
				ref={tabContentRef}
				className={cn(
					"left-0 w-full transition-[opacity,visibility] duration-200",
					effectiveIsFullscreen
						? "fixed top-0 h-full"
						: "absolute top-10 h-[calc(100%-40px)]",
					isPlaybackTab ? "z-[9]" : isActive ? "z-10" : "z-0",
					isActive
						? "pointer-events-auto visible opacity-100"
						: "pointer-events-none invisible opacity-0",
					isPlaybackTab && "bg-white dark:bg-background",
				)}
			>
				{isPlaybackTab && playbackProps ? (
					<PlaybackTabContent {...playbackProps} />
				) : (
					<Render
						key={tab.refreshKey || tab.id}
						{...renderProps}
						onActiveFileChange={handleActiveFileChange}
						openFileTab={openFileTab}
						isTabActive={isActive}
					/>
				)}
			</div>
		)
	},
)

TabCache.displayName = "TabCache"

export default TabCache
