import { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { isEmpty } from "lodash-es"
import type { PlaybackTabItem } from "../types"
import type { Topic, TaskStatus } from "@/opensource/pages/superMagic/pages/Workspace/types"

export const PLAYBACK_TAB_ID = "__playback__"

interface UsePlaybackTabProps {
	selectedTopic?: Topic | null
	topicName?: string // 直接传入话题名称（用于分享场景）
	messages?: unknown[]
	currentTopicStatus?: TaskStatus
	autoDetail?: unknown
	onTabChange?: (tab: PlaybackTabItem | null) => void
	hasActiveFileTab?: boolean // 当前是否有激活的文件tab
}

interface UsePlaybackTabReturn {
	playbackTab: PlaybackTabItem | null
	openPlaybackTab: (options?: { toolData?: unknown; forceActivate?: boolean }) => void
	closePlaybackTab: () => void
	updatePlaybackTab: (updates: Partial<PlaybackTabItem>) => void
	isPlaybackTab: (tabId: string) => boolean
}

export function usePlaybackTab(props: UsePlaybackTabProps): UsePlaybackTabReturn {
	const { selectedTopic, topicName, messages, onTabChange, hasActiveFileTab } = props
	const { t } = useTranslation("super")

	const [playbackTab, setPlaybackTab] = useState<PlaybackTabItem | null>(null)

	// 判断是否为演示模式tab
	const isPlaybackTab = useCallback((tabId: string) => {
		return tabId === PLAYBACK_TAB_ID
	}, [])

	// 获取话题名称（优先使用 topicName，其次使用 selectedTopic.topic_name）
	const getTopicName = useCallback(() => {
		return topicName || selectedTopic?.topic_name || t("fileViewer.defaultTopicName")
	}, [topicName, selectedTopic?.topic_name, t])

	// 打开/创建演示模式tab
	const openPlaybackTab = useCallback(
		(options?: { toolData?: unknown; forceActivate?: boolean }) => {
			const { toolData, forceActivate } = options || {}

			// 决定是否激活playbackTab：
			// 1. 如果forceActivate为true，强制激活（用户主动点击工具调用）
			// 2. 如果forceActivate为false，不激活（明确指定不激活）
			// 3. 如果forceActivate为undefined，根据当前是否有激活的文件tab来决定
			//    - 如果当前有激活的文件tab，则不激活playbackTab（保持用户当前的预览状态）
			//    - 如果当前没有激活的文件tab，则激活playbackTab
			const shouldActivate = forceActivate !== undefined ? forceActivate : !hasActiveFileTab

			const tab: PlaybackTabItem = {
				id: PLAYBACK_TAB_ID,
				type: "playback",
				title: t("fileViewer.playbackTabTitle"), // 固定为"话题回放"
				isPlaybackTab: true,
				topicId: selectedTopic?.chat_topic_id || "",
				topicName: getTopicName(),
				active: shouldActivate,
				closeable: true,
				fileData: {} as any,
				toolData,
			}
			setPlaybackTab(tab)
			onTabChange?.(tab)
		},
		[selectedTopic?.chat_topic_id, getTopicName, onTabChange, t, hasActiveFileTab],
	)

	// 关闭演示模式tab
	const closePlaybackTab = useCallback(() => {
		setPlaybackTab(null)
		onTabChange?.(null)
	}, [onTabChange])

	// 更新演示模式tab
	const updatePlaybackTab = useCallback(
		(updates: Partial<PlaybackTabItem>) => {
			setPlaybackTab((prev) => {
				if (!prev) return null
				const updated = { ...prev, ...updates }
				onTabChange?.(updated)
				return updated
			})
		},
		[onTabChange],
	)

	// 监听话题切换自动更新
	useEffect(() => {
		if (!playbackTab) return

		const hasToolSteps = messages?.some((msg: any) => {
			const tool = msg?.tool || msg?.assistant?.tool
			return tool && !isEmpty(tool)
		})

		if (hasToolSteps) {
			updatePlaybackTab({
				title: t("fileViewer.playbackTabTitle"), // 固定为"话题回放"
				topicId: selectedTopic?.chat_topic_id || "",
				topicName: getTopicName(),
			})
		}
		// 如果没有工具调用，保留现有tab（需求5）
	}, [
		selectedTopic?.chat_topic_id,
		topicName,
		messages,
		// playbackTab,
		// updatePlaybackTab,
		t,
		// getTopicName,
	])

	return {
		playbackTab,
		openPlaybackTab,
		closePlaybackTab,
		updatePlaybackTab,
		isPlaybackTab,
	}
}
