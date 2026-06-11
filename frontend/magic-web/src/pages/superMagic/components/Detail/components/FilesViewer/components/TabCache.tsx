import { memo, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import useFullscreenMode from "@/hooks/useFullscreenMode"
import Render from "../../../Render"
import PlaybackTabContent, { type PlaybackTabContentProps } from "./PlaybackTabContent"
import KnowledgeBaseTabContent from "./KnowledgeBaseTabContent"
import { PLAYBACK_TAB_ID } from "../hooks/usePlaybackTab"
import {
	KNOWLEDGE_BASE_TAB_ID_PREFIX,
	type KnowledgeBaseTabData,
} from "../hooks/useKnowledgeBaseTab"

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
	/** When true, content fills the viewer without reserving tab bar height */
	hideTabBar?: boolean
	knowledgeBaseData?: KnowledgeBaseTabData
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
		hideTabBar = false,
		knowledgeBaseData,
	}: TabCacheProps) => {
		const isPlaybackTab = tab.id === PLAYBACK_TAB_ID
		const isKnowledgeBaseTab = tab.id.startsWith(KNOWLEDGE_BASE_TAB_ID_PREFIX)
		const tabContentRef = useRef<HTMLDivElement>(null)
		const isFullscreenMode = useFullscreenMode()

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

		// For playback tab, use isFullscreen from playbackProps; for other tabs, use URL parameter
		const effectiveIsFullscreen = isPlaybackTab
			? playbackProps?.isFullscreen === true
			: isFullscreenMode || isFullscreen
		const fillsViewerWithoutTabBar = hideTabBar && !effectiveIsFullscreen

		return (
			<div
				ref={tabContentRef}
				className={cn(
					"left-0 w-full transition-[opacity,visibility] duration-200",
					effectiveIsFullscreen
						? "fixed top-0 h-full"
						: fillsViewerWithoutTabBar
							? "absolute top-0 h-full"
							: "absolute top-11 h-[calc(100%-44px)]",
					isPlaybackTab ? "z-[9]" : isActive ? "z-10" : "z-0",
					isActive
						? "pointer-events-auto visible opacity-100"
						: "pointer-events-none invisible opacity-0",
					(isPlaybackTab || isKnowledgeBaseTab) && "bg-white dark:bg-background",
				)}
			>
				{isPlaybackTab && playbackProps ? (
					<PlaybackTabContent {...playbackProps} />
				) : isKnowledgeBaseTab && knowledgeBaseData ? (
					<KnowledgeBaseTabContent data={knowledgeBaseData} />
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
