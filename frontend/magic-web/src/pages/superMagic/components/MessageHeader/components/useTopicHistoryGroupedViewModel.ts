import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import { useTranslation } from "react-i18next"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"

const DEFAULT_GROUP_VISIBLE_COUNT = 10
const GROUP_VISIBLE_INCREMENT = 10
const COLLAPSE_STORAGE_KEY = "super-magic-topic-history-collapse-states"

function getDefaultCollapsedState(groupId: string) {
	return groupId === "archived"
}

export interface TopicHistoryGroupViewModel {
	id: string
	kind: "pinned" | "timeline" | "archived"
	title: string
	topics: Topic[]
	isCollapsed: boolean
	visibleCount: number
	hasMore: boolean
	visibleTopics: Topic[]
}

interface UseTopicHistoryGroupedViewModelParams {
	topics: Topic[]
}

interface TopicHistoryGroupBase {
	id: string
	kind: "pinned" | "timeline" | "archived"
	title: string
	topics: Topic[]
}

export function useTopicHistoryGroupedViewModel({ topics }: UseTopicHistoryGroupedViewModelParams) {
	const { t } = useTranslation("super")
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
		if (typeof window === "undefined") return {}

		try {
			const rawValue = window.localStorage.getItem(COLLAPSE_STORAGE_KEY)
			return rawValue ? JSON.parse(rawValue) : {}
		} catch {
			return {}
		}
	})
	const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})

	const groups = useMemo<TopicHistoryGroupViewModel[]>(() => {
		if (topics.length === 0) return []

		const pinnedTopics = topics
			.filter((topic) => topic.is_pinned && !topic.is_archived)
			.sort((topicA, topicB) => {
				const sortValueA = topicA.pinned_at || topicA.updated_at
				const sortValueB = topicB.pinned_at || topicB.updated_at
				return dayjs(sortValueB).valueOf() - dayjs(sortValueA).valueOf()
			})

		const archivedTopics = topics
			.filter((topic) => topic.is_archived)
			.sort(
				(topicA, topicB) =>
					dayjs(topicB.updated_at).valueOf() - dayjs(topicA.updated_at).valueOf(),
			)

		const timelineTopics = topics
			.filter((topic) => !topic.is_pinned && !topic.is_archived)
			.sort(
				(topicA, topicB) =>
					dayjs(topicB.updated_at).valueOf() - dayjs(topicA.updated_at).valueOf(),
			)

		const todayStart = dayjs().startOf("day")
		const todayTopics: Topic[] = []
		const yesterdayTopics: Topic[] = []
		const olderTopics: Topic[] = []

		timelineTopics.forEach((topic) => {
			const dayDiff = Math.max(
				0,
				todayStart.diff(dayjs(topic.updated_at).startOf("day"), "day"),
			)
			if (dayDiff === 0) {
				todayTopics.push(topic)
				return
			}
			if (dayDiff === 1) {
				yesterdayTopics.push(topic)
				return
			}
			olderTopics.push(topic)
		})

		const timelineGroups: TopicHistoryGroupBase[] = [
			todayTopics.length > 0
				? {
						id: "today",
						kind: "timeline",
						title: t("messageHeader.today"),
						topics: todayTopics,
					}
				: null,
			yesterdayTopics.length > 0
				? {
						id: "yesterday",
						kind: "timeline",
						title: t("messageHeader.yesterday"),
						topics: yesterdayTopics,
					}
				: null,
			olderTopics.length > 0
				? {
						id: "days-3",
						kind: "timeline",
						title: t("messageHeader.daysAgo", { count: 3 }),
						topics: olderTopics,
					}
				: null,
		].filter((group): group is TopicHistoryGroupBase => Boolean(group))

		const nextGroups = [
			pinnedTopics.length > 0
				? {
						id: "pinned",
						kind: "pinned" as const,
						title: t("messageHeader.pinned"),
						topics: pinnedTopics,
					}
				: null,
			...timelineGroups,
			archivedTopics.length > 0
				? {
						id: "archived",
						kind: "archived" as const,
						title: t("messageHeader.archived"),
						topics: archivedTopics,
					}
				: null,
		].filter((group): group is TopicHistoryGroupBase => Boolean(group))

		return nextGroups.map((group) => {
			const visibleCount = visibleCounts[group.id] ?? DEFAULT_GROUP_VISIBLE_COUNT
			return {
				...group,
				isCollapsed: collapsedGroups[group.id] ?? getDefaultCollapsedState(group.id),
				visibleCount,
				hasMore: group.topics.length > visibleCount,
				visibleTopics: group.topics.slice(0, visibleCount),
			}
		})
	}, [collapsedGroups, t, topics, visibleCounts])

	useEffect(() => {
		if (typeof window === "undefined") return
		try {
			window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedGroups))
		} catch {
			// ignore storage write failures
		}
	}, [collapsedGroups])

	useEffect(() => {
		setVisibleCounts((previousValue) => {
			const nextValue = groups.reduce<Record<string, number>>((result, group) => {
				result[group.id] = previousValue[group.id] ?? DEFAULT_GROUP_VISIBLE_COUNT
				return result
			}, {})

			const previousKeys = Object.keys(previousValue)
			const nextKeys = Object.keys(nextValue)
			if (
				previousKeys.length === nextKeys.length &&
				previousKeys.every((key) => previousValue[key] === nextValue[key])
			) {
				return previousValue
			}

			return nextValue
		})
	}, [groups])

	function handleToggleGroup(groupId: string) {
		setCollapsedGroups((previousValue) => ({
			...previousValue,
			[groupId]: !(previousValue[groupId] ?? getDefaultCollapsedState(groupId)),
		}))
	}

	function handleLoadMoreInGroup(groupId: string) {
		setVisibleCounts((previousValue) => ({
			...previousValue,
			[groupId]:
				(previousValue[groupId] ?? DEFAULT_GROUP_VISIBLE_COUNT) + GROUP_VISIBLE_INCREMENT,
		}))
	}

	return {
		groups,
		onToggleGroup: handleToggleGroup,
		onLoadMoreInGroup: handleLoadMoreInGroup,
	}
}
