import { useMemo, useState } from "react"
import { useDebounce, useMemoizedFn } from "ahooks"
import dayjs from "@/lib/dayjs"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { useChatWorkspace } from "@/pages/superMagic/hooks/useChatWorkspace"

const CHAT_LIST_PAGE_SIZE = 100

function isRunningLikeStatus(status: string | undefined | null) {
	return status === "running" || status === "waiting_for_user"
}

export interface ChatConversationListItem {
	id: string
	title: string
	timeLabel: string
	isPinned: boolean
	isRunning: boolean
	project: ProjectListItem
}

export interface UseChatConversationListResult {
	items: ChatConversationListItem[]
	isLoading: boolean
	searchValue: string
	setSearchValue: (value: string) => void
	debouncedSearchValue: string
	isEmpty: boolean
	isSearchEmpty: boolean
	reload: () => Promise<void>
	/** 是否还有更多分页数据（搜索态下始终为 false） */
	hasMore: boolean
	/** 加载下一页数据并追加到列表末尾 */
	loadMore: () => Promise<void>
	/** 立即从本地列表移除某项（乐观更新），下次 reload 后以服务端数据为准 */
	optimisticRemove: (id: string) => void
}

/**
 * 统一装配 chat 工作区列表页的请求、服务端搜索和展示映射，避免展示层感知接口细节。
 */
export function useChatConversationList(): UseChatConversationListResult {
	const { t, i18n } = useTranslation(["super", "common"])
	const { timezone } = useTimezone()
	const [searchValue, setSearchValue] = useState("")
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 250 })
	/** 当前已加载到第几页，reload 时重置为 1 */
	const [currentPage, setCurrentPage] = useState(1)
	const {
		chatProjects,
		chatProjectsTotal,
		isLoadingChatProjects,
		refreshChatProjects,
		loadMoreChatProjects,
	} = useChatWorkspace({
		projectsEnabled: true,
		projectPageSize: CHAT_LIST_PAGE_SIZE,
		projectKeyword: debouncedSearchValue,
	})

	/**
	 * 待删除项 ID 集合，用于在服务端响应前立即隐藏对应行（乐观更新）。
	 * reload 完成后此集合会被清空，以服务端真实数据为准。
	 */
	const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set())

	/**
	 * 在 hook 内完成时区格式化，让视图只消费可展示的文案，后续接点击进入时也不需要改 View。
	 * 过滤 pendingRemoveIds：删除/移出 chat 工作区后，在 reload 确认前列表先隐藏对应行。
	 */
	const items = useMemo<ChatConversationListItem[]>(() => {
		return chatProjects
			.filter((p) => !pendingRemoveIds.has(p.id))
			.map((project) => ({
				id: project.id,
				title: project.project_name || t("super:chat.unnamedChat"),
				timeLabel: formatConversationTime({
					rawTime: project.last_active_at || project.updated_at || project.created_at,
					timezone,
					language: i18n.language,
					minutesAgoText: (count) => t("super:chatList.minutesAgo", { count }),
					yesterdayText: t("common:format.yesterday"),
				}),
				isPinned: Boolean(project.is_pinned),
				isRunning:
					isRunningLikeStatus(project.current_topic_status) ||
					isRunningLikeStatus(project.project_status),
				project,
			}))
	}, [chatProjects, pendingRemoveIds, i18n.language, t, timezone])

	/**
	 * 显式重试复用当前关键字，保证列表与搜索态保持同一个后端查询结果。
	 * reload 后仅移除服务端已确认不存在的 pending id，避免列表接口短暂滞后时把已删项重新展示出来。
	 */
	const reload = useMemoizedFn(async () => {
		setCurrentPage(1)
		const latestProjects = await refreshChatProjects({
			pageSize: CHAT_LIST_PAGE_SIZE,
			keyword: debouncedSearchValue,
		})
		const latestProjectIds = new Set(latestProjects.map((project) => project.id))
		setPendingRemoveIds((prev) => {
			const next = new Set(prev)
			for (const id of prev) {
				if (!latestProjectIds.has(id)) next.delete(id)
			}
			return next
		})
	})

	/**
	 * 立即从本地列表移除指定项（不等服务端响应），提供即时视觉反馈。
	 * 调用方仍需在后台触发 reload 以同步最终状态。
	 */
	const optimisticRemove = useMemoizedFn((id: string) => {
		setPendingRemoveIds((prev) => new Set([...prev, id]))
	})

	/**
	 * 加载下一页数据追加到列表末尾。
	 * 搜索态下不调用（hasMore 为 false 时 InfiniteScroll 不会触发此函数）。
	 */
	const loadMore = useMemoizedFn(async () => {
		const nextPage = currentPage + 1
		await loadMoreChatProjects(nextPage, {
			pageSize: CHAT_LIST_PAGE_SIZE,
			keyword: debouncedSearchValue,
		})
		setCurrentPage(nextPage)
	})

	return {
		items,
		isLoading: isLoadingChatProjects,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		// 乐观删除后过滤掉 pending 项，避免已删除但 server 未确认时 isEmpty 误判
		isEmpty:
			!debouncedSearchValue &&
			chatProjects.filter((p) => !pendingRemoveIds.has(p.id)).length === 0,
		isSearchEmpty: Boolean(debouncedSearchValue) && chatProjects.length === 0,
		// 搜索态下禁用无限滚动（搜索结果一次性返回，不需要分页）
		hasMore: !debouncedSearchValue && chatProjects.length < chatProjectsTotal,
		reload,
		loadMore,
		optimisticRemove,
	}
}

interface FormatConversationTimeParams {
	rawTime?: string
	timezone: string
	language: string
	minutesAgoText: (count: number) => string
	yesterdayText: string
}

/**
 * 原型里的时间展示同时包含“分钟级相对时间”和“日期时间”，这里集中封装，避免多个列表项重复拼接规则。
 */
function formatConversationTime({
	rawTime,
	timezone,
	language,
	minutesAgoText,
	yesterdayText,
}: FormatConversationTimeParams) {
	if (!rawTime) return ""

	const targetTime = dayjs(rawTime).tz(timezone)
	const currentTime = dayjs().tz(timezone)
	const minuteDiff = currentTime.diff(targetTime, "minute")

	if (minuteDiff >= 0 && minuteDiff < 60 && currentTime.isSame(targetTime, "day")) {
		return minutesAgoText(Math.max(1, minuteDiff))
	}

	if (currentTime.subtract(1, "day").isSame(targetTime, "day")) {
		return `${yesterdayText} ${targetTime.format("HH:mm")}`
	}

	if (currentTime.isSame(targetTime, "year")) {
		return language.startsWith("zh")
			? targetTime.format("M月D日 HH:mm")
			: targetTime.format("MMM D HH:mm")
	}

	return language.startsWith("zh")
		? targetTime.format("YYYY年M月D日 HH:mm")
		: targetTime.format("YYYY MMM D HH:mm")
}
