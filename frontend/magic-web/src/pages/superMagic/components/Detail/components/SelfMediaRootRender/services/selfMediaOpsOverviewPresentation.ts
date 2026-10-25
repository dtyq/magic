import type { SelfMediaOpsOverview, SelfMediaOpsOverviewActionKey } from "./selfMediaOpsOverview"
import { formatSelfMediaCompactNumber, formatSelfMediaPercent } from "./selfMediaOpsOverview"

export type SelfMediaOpsMetricKey = "reads" | "engagement" | "rate"
export type SelfMediaOpsMetricMotionState = "active" | "idle"

export interface SelfMediaOpsMetricDrillDown {
	title: string
	subtitle: string
	rows: Array<{
		label: string
		value: string
	}>
}

interface SelfMediaOpsPrimarySignal {
	title: string
	description: string
}

interface SelfMediaOpsHealth {
	score: number
	done: number
	total: number
}

const bottleneckCopy: Array<{
	key: keyof SelfMediaOpsOverview["completion"]
	label: string
	description: string
}> = [
	{
		key: "source",
		label: "待绑定发布链接",
		description: "先绑定已发布链接，系统才能同步真实阅读、互动和评论数据。",
	},
	{
		key: "metrics",
		label: "待同步数据",
		description: "先同步阅读、点赞、评论数据，解锁互动率判断。",
	},
	{
		key: "comments",
		label: "待补充评论",
		description: "补齐评论样本，解锁评论情绪和选题反馈。",
	},
	{
		key: "review",
		label: "待生成复盘",
		description: "生成运营复盘，沉淀下一轮选题和优化动作。",
	},
]

const actionUnlockCopyMap = {
	"bind-source": "解锁阅读/互动同步",
	"sync-metrics": "解锁互动率判断",
	"collect-comments": "解锁评论情绪分析",
	"generate-review": "沉淀下一轮优化",
	"improve-weak-post": "生成标题/封面优化建议",
	"repurpose-best-post": "复用高效内容资产",
	"plan-next-post": "进入下一轮创作",
} satisfies Record<SelfMediaOpsOverviewActionKey, string>

export function buildSelfMediaOpsPrimarySignal(
	overview: SelfMediaOpsOverview,
): SelfMediaOpsPrimarySignal {
	const activeBottleneck = getActiveBottleneckFromAction(overview)
	if (activeBottleneck) return activeBottleneck

	const bottlenecks = bottleneckCopy
		.map((item, index) => {
			const completion = overview.completion[item.key]
			return {
				...item,
				index,
				remaining: Math.max(completion.total - completion.done, 0),
			}
		})
		.filter((item) => item.remaining > 0)
		.sort((left, right) => right.remaining - left.remaining || left.index - right.index)

	const bottleneck = bottlenecks[0]
	if (!bottleneck) {
		return {
			title: "运营链路已闭环",
			description: "数据、评论与复盘已齐，可以继续新建文章或做二次分发。",
		}
	}

	return {
		title: `当前瓶颈：${bottleneck.remaining} 篇${bottleneck.label}`,
		description: bottleneck.description,
	}
}

export function buildSelfMediaOpsHealth(overview: SelfMediaOpsOverview): SelfMediaOpsHealth {
	const values = Object.values(overview.completion)
	const done = values.reduce((total, item) => total + item.done, 0)
	const total = values.reduce((sum, item) => sum + item.total, 0)
	return {
		score: total > 0 ? Math.round((done / total) * 100) : 100,
		done,
		total,
	}
}

export function buildSelfMediaOpsMetricStatusLabels(
	overview: SelfMediaOpsOverview,
): Record<SelfMediaOpsMetricKey, string> {
	const metrics = overview.completion.metrics
	const status = getSyncedMetricStatus(metrics.done, metrics.total)
	return {
		reads: status,
		engagement: status,
		rate: status,
	}
}

export function buildSelfMediaOpsMetricDisplay(
	overview: SelfMediaOpsOverview,
	values: Record<SelfMediaOpsMetricKey, string>,
): Record<
	SelfMediaOpsMetricKey,
	{
		label: string
		value: string
	}
> {
	return {
		reads: { label: "总阅读", value: values.reads },
		engagement: { label: "总互动", value: values.engagement },
		rate: { label: "平均互动率", value: values.rate },
	}
}

export function buildSelfMediaOpsMetricMotionStates(
	overview: SelfMediaOpsOverview,
): Record<SelfMediaOpsMetricKey, SelfMediaOpsMetricMotionState> {
	const metrics = overview.completion.metrics
	const motion: SelfMediaOpsMetricMotionState =
		metrics.total > 0 && metrics.done < metrics.total ? "active" : "idle"

	return {
		reads: motion,
		engagement: motion,
		rate: motion,
	}
}

export function getSelfMediaOpsActionUnlockCopy(key: SelfMediaOpsOverviewActionKey) {
	return actionUnlockCopyMap[key]
}

export function buildSelfMediaOpsMetricDrillDowns(
	overview: SelfMediaOpsOverview,
): Record<SelfMediaOpsMetricKey, SelfMediaOpsMetricDrillDown> {
	const bestPost = overview.bestPost
	const weakestPost = overview.weakestPost
	const lastUpdatedAt = overview.lastUpdatedAt
		? formatSelfMediaOverviewDateTime(overview.lastUpdatedAt)
		: "等待同步"

	return {
		reads: {
			title: "阅读拆解",
			subtitle: "看样本规模与流量集中度",
			rows: [
				{ label: "样本文章", value: `${overview.totalPosts} 篇` },
				{ label: "表现最佳", value: bestPost?.title ?? "暂无有效数据" },
				{ label: "最近同步", value: lastUpdatedAt },
			],
		},
		engagement: {
			title: "互动拆解",
			subtitle: "看互动总量与待跟进文章",
			rows: [
				{
					label: "总互动",
					value: formatSelfMediaCompactNumber(overview.totalEngagement, "zh-CN"),
				},
				{ label: "低互动", value: weakestPost?.title ?? "暂无低互动样本" },
				{ label: "待办事项", value: `${overview.nextActions.length} 项` },
			],
		},
		rate: {
			title: "效率拆解",
			subtitle: "找出高效样本和风险内容",
			rows: [
				{ label: "平均互动率", value: formatSelfMediaPercent(overview.engagementRate) },
				{
					label: "最佳互动率",
					value: formatSelfMediaPercent(bestPost?.engagementRate ?? null),
				},
				{
					label: "低互动率",
					value: formatSelfMediaPercent(weakestPost?.engagementRate ?? null),
				},
			],
		},
	}
}

function getSyncedMetricStatus(done: number, total: number) {
	if (total <= 0) return "暂无文章"
	if (done <= 0) return "等待同步"
	if (done < total) return `已同步 ${done}/${total}`
	return "已同步完成"
}

function getActiveBottleneckFromAction(
	overview: SelfMediaOpsOverview,
): SelfMediaOpsPrimarySignal | null {
	const firstAction = overview.nextActions[0]
	if (!firstAction) return null

	const completionKey = getCompletionKeyForAction(firstAction.key)
	if (!completionKey) {
		return {
			title: "当前重点：优化低互动文章",
			description: "优先拆解标题、封面和评论引导，把低互动内容变成下一轮改进样本。",
		}
	}

	const completion = overview.completion[completionKey]
	const remaining = Math.max(completion.total - completion.done, 0)
	const copy = bottleneckCopy.find((item) => item.key === completionKey)
	if (!copy || remaining <= 0) return null

	return {
		title: `当前瓶颈：${remaining} 篇${copy.label}`,
		description: copy.description,
	}
}

function getCompletionKeyForAction(
	key: SelfMediaOpsOverviewActionKey,
): keyof SelfMediaOpsOverview["completion"] | null {
	if (key === "bind-source") return "source"
	if (key === "sync-metrics") return "metrics"
	if (key === "collect-comments") return "comments"
	if (key === "generate-review") return "review"
	return null
}

function formatSelfMediaOverviewDateTime(value: string) {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
	if (match) {
		const [, year, month, day, hour, minute] = match
		return `${year}/${month}/${day} ${hour}:${minute}`
	}
	return value
}
