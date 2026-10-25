import { aiLLMService } from "@/services/ai"
import type { SelfMediaOpsOverview } from "./selfMediaOpsOverview"
import { formatSelfMediaCompactNumber, formatSelfMediaPercent } from "./selfMediaOpsOverview"
import { buildSelfMediaHomeInsightSignature } from "./selfMediaHomeInsight"
import { buildSelfMediaOpsHealth } from "./selfMediaOpsOverviewPresentation"

export type SelfMediaOpsHealthInsightStatus = "idle" | "loading" | "cached" | "generated" | "error"
export type SelfMediaOpsHealthInsightLevel = "good" | "warning" | "risk"
export type SelfMediaOpsHealthInsightConfidence = "low" | "medium" | "high"

export interface SelfMediaOpsHealthInsightPayload {
	version: 1
	generatedAt: string
	stateSignature: string
	score: number
	level: SelfMediaOpsHealthInsightLevel
	summary: string
	reasons: string[]
	nextAction?: string
	confidence: SelfMediaOpsHealthInsightConfidence
}

export interface SelfMediaOpsHealthInsightStorage {
	loadOpsHealthInsight: () => Promise<SelfMediaOpsHealthInsightPayload | null>
	saveOpsHealthInsight: (payload: SelfMediaOpsHealthInsightPayload) => Promise<void>
}

export interface ResolveSelfMediaOpsHealthInsightOptions {
	overview: SelfMediaOpsOverview
	storage: SelfMediaOpsHealthInsightStorage
	force?: boolean
	model?: string
	now?: Date
	generate?: (
		options: GenerateSelfMediaOpsHealthInsightOptions,
	) => Promise<SelfMediaOpsHealthInsightPayload>
}

export interface GenerateSelfMediaOpsHealthInsightOptions {
	overview: SelfMediaOpsOverview
	model?: string
	now?: Date
	signal?: AbortSignal
}

const OPS_HEALTH_INSIGHT_VERSION = 1 as const
const MAX_REASON_COUNT = 3

export function buildSelfMediaOpsHealthInsightSignature(overview: SelfMediaOpsOverview) {
	return buildSelfMediaHomeInsightSignature(overview)
}

export async function resolveSelfMediaOpsHealthInsight({
	overview,
	storage,
	force = false,
	model,
	now = new Date(),
	generate = generateSelfMediaOpsHealthInsight,
}: ResolveSelfMediaOpsHealthInsightOptions): Promise<{
	insight: SelfMediaOpsHealthInsightPayload
	status: Exclude<SelfMediaOpsHealthInsightStatus, "idle" | "loading">
}> {
	const stateSignature = buildSelfMediaOpsHealthInsightSignature(overview)
	const cached = await storage.loadOpsHealthInsight().catch(() => null)
	if (!force && cached?.stateSignature === stateSignature) {
		return { insight: cached, status: "cached" }
	}

	try {
		const insight = await generate({ overview, model, now })
		await storage.saveOpsHealthInsight(insight)
		return { insight, status: "generated" }
	} catch {
		const fallback = buildFallbackSelfMediaOpsHealthInsight({ overview, now })
		await storage.saveOpsHealthInsight(fallback).catch(() => undefined)
		return { insight: fallback, status: "error" }
	}
}

export async function generateSelfMediaOpsHealthInsight({
	overview,
	model,
	now = new Date(),
	signal,
}: GenerateSelfMediaOpsHealthInsightOptions): Promise<SelfMediaOpsHealthInsightPayload> {
	const fallback = buildFallbackSelfMediaOpsHealthInsight({ overview, now })
	const result = await aiLLMService.chat(
		[
			{
				role: "user",
				content: buildOpsHealthPrompt(overview),
			},
		],
		{
			model,
			temperature: 0.35,
			signal,
			systemPrompt:
				"你是自媒体运营质检助手。只输出 JSON，不要 Markdown。健康度必须同时参考链路完成度和真实运营数据，不能把流程完成度直接等同于运营健康度。",
		},
	)

	return normalizeOpsHealthInsightPayload(result.content, fallback)
}

export function buildFallbackSelfMediaOpsHealthInsight({
	overview,
	now = new Date(),
}: {
	overview: SelfMediaOpsOverview
	now?: Date
}): SelfMediaOpsHealthInsightPayload {
	const workflowHealth = buildSelfMediaOpsHealth(overview)
	const hasCompleteWorkflow =
		workflowHealth.total > 0 && workflowHealth.done === workflowHealth.total
	const hasNoRealData =
		overview.totalPosts > 0 && overview.totalReads <= 0 && overview.totalEngagement <= 0
	const score = hasCompleteWorkflow && hasNoRealData ? 58 : workflowHealth.score
	const level = getHealthLevel(score)
	const completionText = `链路完成度 ${workflowHealth.score}%`
	const dataText = `总阅读 ${formatSelfMediaCompactNumber(
		overview.totalReads,
		"zh-CN",
	)}，总互动 ${formatSelfMediaCompactNumber(overview.totalEngagement, "zh-CN")}`
	const summary =
		hasCompleteWorkflow && hasNoRealData
			? "流程链路已经闭环，但真实阅读和互动数据仍为 0，需要确认数据源读取或重新同步。"
			: buildFallbackHealthSummary(overview, score)
	const reasons = [
		completionText,
		dataText,
		overview.engagementRate === null
			? "暂无可判断的真实互动率"
			: `平均互动率 ${formatSelfMediaPercent(overview.engagementRate)}`,
	]

	return {
		version: OPS_HEALTH_INSIGHT_VERSION,
		generatedAt: now.toISOString(),
		stateSignature: buildSelfMediaOpsHealthInsightSignature(overview),
		score,
		level,
		summary,
		reasons,
		nextAction: buildFallbackHealthNextAction(overview, hasNoRealData),
		confidence: hasNoRealData ? "medium" : "low",
	}
}

function buildOpsHealthPrompt(overview: SelfMediaOpsOverview) {
	const workflowHealth = buildSelfMediaOpsHealth(overview)
	return JSON.stringify(
		{
			task: "计算自媒体运营健康度",
			requirements: [
				"score 是 AI 运营健康度，取 0-100 的整数",
				"score 不能直接等于链路完成度；链路完成但真实数据为 0 时，不得给 90 分以上",
				"level 只能是 good、warning、risk",
				"reasons 最多 3 条，必须包含链路和真实数据判断",
				"summary 用一句话解释为什么是这个分数",
				"nextAction 给一个最该做的动作",
				"confidence 只能是 low、medium、high",
			],
			state: {
				stage: overview.operationStage,
				totalPosts: overview.totalPosts,
				totalReads: overview.totalReads,
				totalEngagement: overview.totalEngagement,
				engagementTotals: overview.engagementTotals,
				engagementRate: overview.engagementRate,
				workflowCompletionScore: workflowHealth.score,
				workflowCompletion: overview.completion,
				bestPost: overview.bestPost,
				weakestPost: overview.weakestPost,
				nextActions: overview.nextActions,
			},
			outputShape: {
				score: "number 0-100",
				level: "good|warning|risk",
				summary: "string",
				reasons: ["string"],
				nextAction: "string",
				confidence: "low|medium|high",
			},
		},
		null,
		2,
	)
}

function normalizeOpsHealthInsightPayload(
	content: string,
	fallback: SelfMediaOpsHealthInsightPayload,
): SelfMediaOpsHealthInsightPayload {
	try {
		const parsed = JSON.parse(cleanJson(content)) as Partial<SelfMediaOpsHealthInsightPayload>
		const score = normalizeScore(parsed.score, fallback.score)
		const reasons = Array.isArray(parsed.reasons)
			? parsed.reasons.map(readText).filter(Boolean).slice(0, MAX_REASON_COUNT)
			: []
		return {
			...fallback,
			score,
			level: normalizeLevel(parsed.level, getHealthLevel(score)),
			summary: readText(parsed.summary) || fallback.summary,
			reasons: reasons.length > 0 ? reasons : fallback.reasons,
			nextAction: readText(parsed.nextAction) || fallback.nextAction,
			confidence: normalizeConfidence(parsed.confidence, fallback.confidence),
		}
	} catch {
		return fallback
	}
}

function buildFallbackHealthSummary(overview: SelfMediaOpsOverview, score: number) {
	if (overview.totalPosts <= 0) return "暂无文章，健康度先按空工作台状态处理。"
	if (score < 70) return "当前运营链路仍有缺口，健康度主要受数据或复盘缺失影响。"
	if (overview.bestPost) return "运营链路和真实互动数据可用，可以优先复用表现最佳的文章。"
	return "运营链路基本可用，下一步适合继续生成内容并补足真实反馈。"
}

function buildFallbackHealthNextAction(overview: SelfMediaOpsOverview, hasNoRealData: boolean) {
	if (hasNoRealData) return "重新同步阅读和互动数据，确认数据源是否可读。"
	const nextAction = overview.nextActions[0]
	if (nextAction) return nextAction.title
	if (overview.bestPost) return `复用 ${overview.bestPost.title} 的高互动结构。`
	return "规划下一篇内容。"
}

function normalizeScore(value: unknown, fallback: number) {
	const numeric = typeof value === "number" ? value : Number(value)
	if (!Number.isFinite(numeric)) return fallback
	return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizeLevel(
	value: unknown,
	fallback: SelfMediaOpsHealthInsightLevel,
): SelfMediaOpsHealthInsightLevel {
	return value === "good" || value === "warning" || value === "risk" ? value : fallback
}

function normalizeConfidence(
	value: unknown,
	fallback: SelfMediaOpsHealthInsightConfidence,
): SelfMediaOpsHealthInsightConfidence {
	return value === "low" || value === "medium" || value === "high" ? value : fallback
}

function getHealthLevel(score: number): SelfMediaOpsHealthInsightLevel {
	if (score >= 80) return "good"
	if (score >= 50) return "warning"
	return "risk"
}

function readText(value: unknown) {
	return typeof value === "string" ? value.trim() : ""
}

function cleanJson(content: string) {
	const trimmed = content.trim()
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
	return fenced ? fenced[1].trim() : trimmed
}
