import type { SelfMediaPostOpsMetricsPayload } from "./SelfMediaFileStorageService"
import type { SelfMediaPostOpsArtifacts } from "./selfMediaOpsArtifactStates"
import { getSelfMediaPostPublishStatus } from "./selfMediaPostPublishStatus"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"

export interface SelfMediaOpsOverviewInput {
	posts: SelfMediaPlatformPostItem[]
	artifactsByPostKey: Map<string, SelfMediaPostOpsArtifacts>
	metricsByPostKey: Map<string, SelfMediaPostOpsMetricsPayload | null>
}

export interface SelfMediaOpsOverviewCompletionItem {
	done: number
	total: number
}

export interface SelfMediaOpsOverviewPostSummary {
	postKey: string
	title: string
	platform: SelfMediaPlatformPostItem["platform"]
	index: number
	reads: number
	engagement: number
	engagementRate: number | null
	updatedAt?: string
}

export interface SelfMediaOpsOverviewEngagementTotals {
	likes: number
	comments: number
	saves: number
	shares: number
}

export type SelfMediaOpsOverviewActionKey =
	| "bind-source"
	| "sync-metrics"
	| "collect-comments"
	| "generate-review"
	| "improve-weak-post"
	| "repurpose-best-post"
	| "plan-next-post"

export type SelfMediaOpsOverviewStage = "empty" | "setup" | "syncing" | "reviewing" | "closed"

export interface SelfMediaOpsOverviewAction {
	key: SelfMediaOpsOverviewActionKey
	postKey?: string
	targetTitle?: string
	title: string
	description: string
	cta: string
	priority: number
}

export interface SelfMediaOpsOverview {
	totalPosts: number
	totalReads: number
	totalEngagement: number
	engagementTotals: SelfMediaOpsOverviewEngagementTotals
	engagementRate: number | null
	completion: Record<keyof SelfMediaPostOpsArtifacts, SelfMediaOpsOverviewCompletionItem>
	bestPost: SelfMediaOpsOverviewPostSummary | null
	weakestPost: SelfMediaOpsOverviewPostSummary | null
	nextActions: SelfMediaOpsOverviewAction[]
	operationStage: SelfMediaOpsOverviewStage
	opportunityCount: number
	lastUpdatedAt?: string
}

const READ_KEYS = ["reads", "readCount", "read_count", "views", "viewCount", "impressions"]
const LIKE_KEYS = ["likes", "feedLikes", "likeCount", "like_count"]
const COMMENT_KEYS = ["comments", "commentCount", "comment_count"]
const SAVE_KEYS = ["saves", "favorites", "collects", "bookmarkCount"]
const SHARE_KEYS = ["shares", "shareCount", "share_count"]
const MAX_NEXT_ACTIONS = 4
const WEAK_ENGAGEMENT_RATE = 0.02

export function getSelfMediaPostKey(item: SelfMediaPlatformPostItem) {
	return `${item.platform}:${item.index}:${item.entry.entry}`
}

export function buildSelfMediaOpsOverview({
	posts,
	artifactsByPostKey,
	metricsByPostKey,
}: SelfMediaOpsOverviewInput): SelfMediaOpsOverview {
	const calculablePosts = posts.filter(
		(post) => getSelfMediaPostPublishStatus(post) !== "archived",
	)
	const total = calculablePosts.length
	const completion: SelfMediaOpsOverview["completion"] = {
		source: { done: 0, total },
		metrics: { done: 0, total },
		comments: { done: 0, total },
		review: { done: 0, total },
	}
	const postSummaries: SelfMediaOpsOverviewPostSummary[] = []
	const nextActions: SelfMediaOpsOverviewAction[] = []
	let totalReads = 0
	let totalEngagement = 0
	const engagementTotals: SelfMediaOpsOverviewEngagementTotals = {
		likes: 0,
		comments: 0,
		saves: 0,
		shares: 0,
	}
	let lastUpdatedAt: string | undefined

	calculablePosts.forEach((post) => {
		const postKey = getSelfMediaPostKey(post)
		const artifacts = artifactsByPostKey.get(postKey) ?? {
			source: false,
			metrics: false,
			comments: false,
			review: false,
		}
		Object.keys(completion).forEach((key) => {
			const artifactKey = key as keyof SelfMediaPostOpsArtifacts
			if (artifacts[artifactKey]) completion[artifactKey].done += 1
		})

		const metrics = metricsByPostKey.get(postKey) ?? null
		const reads = readMetricNumber(metrics, READ_KEYS) ?? 0
		const likes = readMetricNumber(metrics, LIKE_KEYS) ?? 0
		const comments = readMetricNumber(metrics, COMMENT_KEYS) ?? 0
		const saves = readMetricNumber(metrics, SAVE_KEYS) ?? 0
		const shares = readMetricNumber(metrics, SHARE_KEYS) ?? 0
		const engagement = likes + comments + saves + shares
		const engagementRate = reads > 0 ? engagement / reads : null
		const title = getPostTitle(post)
		totalReads += reads
		totalEngagement += engagement
		engagementTotals.likes += likes
		engagementTotals.comments += comments
		engagementTotals.saves += saves
		engagementTotals.shares += shares
		if (metrics?.updatedAt && (!lastUpdatedAt || metrics.updatedAt > lastUpdatedAt)) {
			lastUpdatedAt = metrics.updatedAt
		}

		if (metrics) {
			postSummaries.push({
				postKey,
				title,
				platform: post.platform,
				index: post.index,
				reads,
				engagement,
				engagementRate,
				updatedAt: metrics.updatedAt,
			})
		}

		const action = buildPrimaryActionForPost({ postKey, targetTitle: title, artifacts })
		if (action) nextActions.push(action)
	})

	const bestPost = pickBestPost(postSummaries)
	const weakestPost = pickWeakestPost(postSummaries)
	if (weakestPost && weakestPost.engagementRate !== null) {
		nextActions.push({
			key: "improve-weak-post",
			postKey: weakestPost.postKey,
			targetTitle: weakestPost.title,
			title: "优化低互动文章",
			description: `${weakestPost.title} 的互动率偏低，可以继续让运营助手拆解标题、封面和评论引导。`,
			cta: "去优化",
			priority: 50,
		})
	}
	const operationStage = getOperationStage(completion)
	const continuationActions =
		nextActions.length === 0
			? buildContinuationActions({
					bestPost,
					totalPosts: total,
				})
			: []

	return {
		totalPosts: total,
		totalReads,
		totalEngagement,
		engagementTotals,
		engagementRate: totalReads > 0 ? totalEngagement / totalReads : null,
		completion,
		bestPost,
		weakestPost,
		nextActions: [...nextActions, ...continuationActions]
			.sort((left, right) => left.priority - right.priority)
			.slice(0, MAX_NEXT_ACTIONS),
		operationStage,
		opportunityCount: continuationActions.length,
		lastUpdatedAt,
	}
}

export function formatSelfMediaCompactNumber(value: number, locale?: string) {
	if (!Number.isFinite(value)) return "0"
	const useChineseWan = isChineseLocale(locale)
	if (useChineseWan && value >= 10000) return `${trimNumber(value / 10000)}万`
	if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)}M`
	if (value >= 1000) return `${trimNumber(value / 1000)}k`
	return String(Math.round(value))
}

export function formatSelfMediaMetricDisplay(
	value: SelfMediaPostOpsMetricsPayload["metrics"][string],
	locale?: string,
) {
	const parsed = parseMetricNumber(value)
	if (parsed !== null) return formatSelfMediaCompactNumber(parsed, locale)
	if (typeof value === "string") return value.trim()
	return ""
}

export function formatSelfMediaPercent(value: number | null) {
	if (value === null) return "—"
	return `${trimNumber(value * 100)}%`
}

function buildPrimaryActionForPost({
	postKey,
	targetTitle,
	artifacts,
}: {
	postKey: string
	targetTitle: string
	artifacts: SelfMediaPostOpsArtifacts
}): SelfMediaOpsOverviewAction | null {
	if (!artifacts.source) {
		return {
			key: "bind-source",
			postKey,
			targetTitle,
			title: "绑定已发布链接",
			description: "这篇文章还没绑定发布链接。绑定后，系统才能同步真实阅读、点赞和评论数据。",
			cta: "去绑定",
			priority: 10,
		}
	}
	if (!artifacts.metrics) {
		return {
			key: "sync-metrics",
			postKey,
			targetTitle,
			title: "同步最新数据",
			description: "已检测到发布源。现在可以同步最新阅读、点赞、评论和转发数据。",
			cta: "去同步",
			priority: 20,
		}
	}
	if (!artifacts.comments) {
		return {
			key: "collect-comments",
			postKey,
			targetTitle,
			title: "补充评论反馈",
			description: "这篇文章还缺少评论样本。补齐后，复盘判断会更可靠。",
			cta: "补评论",
			priority: 30,
		}
	}
	if (!artifacts.review) {
		return {
			key: "generate-review",
			postKey,
			targetTitle,
			title: "生成运营复盘",
			description: "数据和评论已经准备好，可以沉淀复盘结论和下一步动作。",
			cta: "去复盘",
			priority: 40,
		}
	}
	return null
}

function getOperationStage(
	completion: SelfMediaOpsOverview["completion"],
): SelfMediaOpsOverviewStage {
	const total = completion.source.total
	if (total <= 0) return "empty"
	if (completion.source.done < total) return "setup"
	if (completion.metrics.done < total) return "syncing"
	if (completion.comments.done < total || completion.review.done < total) return "reviewing"
	return "closed"
}

function buildContinuationActions({
	bestPost,
	totalPosts,
}: {
	bestPost: SelfMediaOpsOverviewPostSummary | null
	totalPosts: number
}): SelfMediaOpsOverviewAction[] {
	if (totalPosts <= 0) return []

	const actions: SelfMediaOpsOverviewAction[] = []
	if (bestPost) {
		actions.push({
			key: "repurpose-best-post",
			postKey: bestPost.postKey,
			targetTitle: bestPost.title,
			title: "复用高互动结构",
			description: `${bestPost.title} 的互动效率最高，可以拆解标题、开头和评论引导，复用到下一篇。`,
			cta: "看样本",
			priority: 60,
		})
	}

	actions.push({
		key: "plan-next-post",
		title: "规划下一篇内容",
		description: "当前运营链路已闭环，可以基于复盘结论继续生成新选题或做二次分发。",
		cta: "新建文章",
		priority: 70,
	})

	return actions
}

function pickBestPost(posts: SelfMediaOpsOverviewPostSummary[]) {
	return posts.reduce<SelfMediaOpsOverviewPostSummary | null>((best, item) => {
		if (!best) return item
		if ((item.engagementRate ?? 0) > (best.engagementRate ?? 0)) return item
		if (
			(item.engagementRate ?? 0) === (best.engagementRate ?? 0) &&
			item.engagement > best.engagement
		) {
			return item
		}
		return best
	}, null)
}

function pickWeakestPost(posts: SelfMediaOpsOverviewPostSummary[]) {
	return posts.reduce<SelfMediaOpsOverviewPostSummary | null>((weakest, item) => {
		if (item.reads <= 0 || item.engagementRate === null) return weakest
		if (item.engagementRate >= WEAK_ENGAGEMENT_RATE) return weakest
		if (!weakest) return item
		return item.engagementRate < (weakest.engagementRate ?? Number.POSITIVE_INFINITY)
			? item
			: weakest
	}, null)
}

function readMetricNumber(
	payload: SelfMediaPostOpsMetricsPayload | null,
	keys: string[],
): number | null {
	if (!payload) return null
	for (const key of keys) {
		const parsed = parseMetricNumber(payload.metrics[key])
		if (parsed !== null) return parsed
	}
	return null
}

function parseMetricNumber(
	value: SelfMediaPostOpsMetricsPayload["metrics"][string],
): number | null {
	if (value === null || value === undefined) return null
	if (typeof value === "number") return Number.isFinite(value) ? value : null
	if (typeof value === "object") return parseMetricNumber(value.value)
	const normalized = value.trim().replace(/,/g, "").toLowerCase()
	if (!normalized || normalized === "-") return null
	const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)(k|w|万)?$/)
	if (!match) return null
	const numeric = Number(match[1])
	if (!Number.isFinite(numeric)) return null
	const unit = match[2]
	if (unit === "k") return numeric * 1000
	if (unit === "w" || unit === "万") return numeric * 10000
	return numeric
}

function getPostTitle(item: SelfMediaPlatformPostItem) {
	return (
		item.post.meta.feedTitle ||
		item.post.meta.title ||
		item.entry.name ||
		`文章 ${item.index + 1}`
	)
}

function isChineseLocale(locale?: string) {
	return (locale || "zh-CN").toLowerCase().startsWith("zh")
}

function trimNumber(value: number) {
	const rounded = Math.round(value * 10) / 10
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
