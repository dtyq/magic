import { aiLLMService } from "@/services/ai"
import type { SelfMediaOpsOverview, SelfMediaOpsOverviewActionKey } from "./selfMediaOpsOverview"
import { formatSelfMediaCompactNumber, formatSelfMediaPercent } from "./selfMediaOpsOverview"

export type SelfMediaHomeDailyInsightStatus = "idle" | "loading" | "cached" | "generated" | "error"

export interface SelfMediaHomeDailyInsightAction {
	id: string
	title: string
	description: string
	cta: string
	kind: SelfMediaOpsOverviewActionKey
	postKey?: string
	targetTitle?: string
}

export interface SelfMediaHomeDailyInsightPayload {
	version: 1
	date: string
	generatedAt: string
	stateSignature: string
	welcomeTitle?: string
	greeting: string
	summary: string
	actions: SelfMediaHomeDailyInsightAction[]
}

export interface SelfMediaHomeDailyInsightStorage {
	loadHomeDailyInsight: () => Promise<SelfMediaHomeDailyInsightPayload | null>
	saveHomeDailyInsight: (payload: SelfMediaHomeDailyInsightPayload) => Promise<void>
}

export interface ResolveSelfMediaHomeDailyInsightOptions {
	overview: SelfMediaOpsOverview
	displayName?: string
	storage: SelfMediaHomeDailyInsightStorage
	now?: Date
	force?: boolean
	model?: string
	generate?: (
		options: GenerateSelfMediaHomeDailyInsightOptions,
	) => Promise<SelfMediaHomeDailyInsightPayload>
}

export interface GenerateSelfMediaHomeDailyInsightOptions {
	overview: SelfMediaOpsOverview
	displayName?: string
	date: string
	now?: Date
	model?: string
	signal?: AbortSignal
}

const MAX_DAILY_ACTIONS = 4
const MAX_WELCOME_TITLE_LENGTH = 24
const HOME_DAILY_INSIGHT_VERSION = 1 as const

export function getSelfMediaHomeInsightDateKey(now = new Date()) {
	const year = now.getFullYear()
	const month = String(now.getMonth() + 1).padStart(2, "0")
	const day = String(now.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function formatSelfMediaHomeInsightGreeting(greeting: string | undefined, fallback: string) {
	const fallbackText = readText(fallback) || "运营工作台已准备就绪"
	const rawGreeting = readText(greeting)
	if (!rawGreeting) return fallbackText

	const cleaned = normalizeGreetingText(rawGreeting)
	if (!cleaned) return fallbackText
	const simpleGreeting = resolveSimpleGreeting(cleaned)
	if (simpleGreeting) return simpleGreeting
	return cleaned
}

export function formatSelfMediaHomeWelcomeTitle(
	value: string | undefined,
	fallback: string,
	overview?: SelfMediaOpsOverview,
) {
	const fallbackText = overview
		? buildFallbackSelfMediaHomeWelcomeTitle(overview)
		: readText(fallback) || "今日重点：推进运营闭环"
	const cleaned = normalizeGreetingText(readText(value))
	if (!cleaned) return fallbackText
	const compact = cleaned.replace(/[。.!！]+$/g, "")
	if (compact.length > MAX_WELCOME_TITLE_LENGTH) return fallbackText
	return compact
}

export function buildSelfMediaHomeInsightSignature(overview: SelfMediaOpsOverview) {
	const completion = overview.completion
	return [
		`stage:${overview.operationStage}`,
		`posts:${overview.totalPosts}`,
		`reads:${Math.round(overview.totalReads)}`,
		`engagement:${Math.round(overview.totalEngagement)}`,
		`rate:${formatSelfMediaPercent(overview.engagementRate)}`,
		`source:${completion.source.done}/${completion.source.total}`,
		`metrics:${completion.metrics.done}/${completion.metrics.total}`,
		`comments:${completion.comments.done}/${completion.comments.total}`,
		`review:${completion.review.done}/${completion.review.total}`,
		`best:${overview.bestPost?.postKey ?? ""}`,
		`weak:${overview.weakestPost?.postKey ?? ""}`,
	].join("|")
}

export async function resolveSelfMediaHomeDailyInsight({
	overview,
	displayName,
	storage,
	now = new Date(),
	force = false,
	model,
	generate = generateSelfMediaHomeDailyInsight,
}: ResolveSelfMediaHomeDailyInsightOptions): Promise<{
	insight: SelfMediaHomeDailyInsightPayload
	status: Exclude<SelfMediaHomeDailyInsightStatus, "idle" | "loading">
}> {
	const date = getSelfMediaHomeInsightDateKey(now)
	const cached = await storage.loadHomeDailyInsight()
	if (!force && cached?.date === date) {
		return { insight: cached, status: "cached" }
	}

	try {
		const insight = await generate({ overview, displayName, date, now, model })
		await storage.saveHomeDailyInsight(insight)
		return { insight, status: "generated" }
	} catch {
		const fallback = buildFallbackSelfMediaHomeDailyInsight({
			overview,
			displayName,
			date,
			now,
		})
		await storage.saveHomeDailyInsight(fallback).catch(() => undefined)
		return { insight: fallback, status: "error" }
	}
}

export async function generateSelfMediaHomeDailyInsight({
	overview,
	displayName,
	date,
	now = new Date(),
	model,
	signal,
}: GenerateSelfMediaHomeDailyInsightOptions): Promise<SelfMediaHomeDailyInsightPayload> {
	const fallback = buildFallbackSelfMediaHomeDailyInsight({ overview, displayName, date, now })
	const result = await aiLLMService.chat(
		[
			{
				role: "user",
				content: buildDailyInsightPrompt(overview, displayName, date),
			},
		],
		{
			model,
			temperature: 0.6,
			signal,
			systemPrompt:
				"你是自媒体运营助手。只输出 JSON，不要 Markdown。建议必须具体、克制、可执行。",
		},
	)

	return normalizeDailyInsightPayload(result.content, fallback, overview)
}

export function buildFallbackSelfMediaHomeDailyInsight({
	overview,
	displayName,
	date,
	now = new Date(),
}: {
	overview: SelfMediaOpsOverview
	displayName?: string
	date: string
	now?: Date
}): SelfMediaHomeDailyInsightPayload {
	const name = displayName?.trim()
	const bestPost = overview.bestPost
	const weakPost = overview.weakestPost
	const welcomeTitle = buildFallbackSelfMediaHomeWelcomeTitle(overview)
	const greeting = name ? `${name}，今天先把内容资产用起来` : "今天先把内容资产用起来"
	const summary =
		overview.operationStage === "closed"
			? "发布、数据、评论和复盘已经闭环，适合复用高互动样本并规划下一篇。"
			: "先处理当前链路瓶颈，让数据和复盘尽快进入可判断状态。"
	const actions: SelfMediaHomeDailyInsightAction[] = []

	if (weakPost) {
		actions.push({
			id: "improve-weak-post",
			title: "修复低互动文章",
			description: `${weakPost.title} 的互动率是 ${formatSelfMediaPercent(
				weakPost.engagementRate,
			)}，优先检查标题承诺和评论引导。`,
			cta: "去优化",
			kind: "improve-weak-post",
			postKey: weakPost.postKey,
			targetTitle: weakPost.title,
		})
	}
	if (bestPost) {
		actions.push({
			id: "repurpose-best-post",
			title: "复用高互动结构",
			description: `${bestPost.title} 已拿到 ${formatSelfMediaCompactNumber(
				bestPost.engagement,
				"zh-CN",
			)} 次互动，适合拆成下一篇的开头和结构模板。`,
			cta: "看样本",
			kind: "repurpose-best-post",
			postKey: bestPost.postKey,
			targetTitle: bestPost.title,
		})
	}
	actions.push({
		id: "plan-next-post",
		title: "规划下一篇内容",
		description: "基于今天的复盘和高互动样本，继续生成下一篇选题。",
		cta: "新建文章",
		kind: "plan-next-post",
	})

	return {
		version: HOME_DAILY_INSIGHT_VERSION,
		date,
		generatedAt: now.toISOString(),
		stateSignature: buildSelfMediaHomeInsightSignature(overview),
		welcomeTitle,
		greeting,
		summary,
		actions: actions.slice(0, MAX_DAILY_ACTIONS),
	}
}

function buildDailyInsightPrompt(
	overview: SelfMediaOpsOverview,
	displayName: string | undefined,
	date: string,
) {
	const completion = overview.completion
	const actionCandidates = buildDailyInsightActionCandidates(overview)
	return JSON.stringify(
		{
			task: "为自媒体首页生成今日运营问候和下一步建议",
			requirements: [
				"每天只生成一次，所以文案要像当天打开工作台时能直接使用的提示",
				"welcomeTitle 用于首页顶部欢迎语，只表达今天最重要的重点，不能超过 24 个中文字符，不要包含用户姓名、早上好/下午好/晚上好、具体日期、星期或几点几分",
				"greeting 不要包含早上好/下午好/晚上好、具体日期、星期或几点几分，直接给运营结论或工作状态",
				"如果链路未完成，优先给补链路动作",
				"如果链路已闭环，给复用、二次分发、下一篇规划等动作",
				"最多 4 个 actions",
				"actions 只能从 actionCandidates 中选择；kind、postKey、targetTitle 必须与候选动作一致",
				"输出字段必须是 welcomeTitle, greeting, summary, actions",
			],
			user: { displayName: displayName || "" },
			date,
			state: {
				stage: overview.operationStage,
				totalPosts: overview.totalPosts,
				totalReads: overview.totalReads,
				totalEngagement: overview.totalEngagement,
				engagementRate: overview.engagementRate,
				completion,
				bestPost: overview.bestPost,
				weakestPost: overview.weakestPost,
				nextActions: overview.nextActions,
			},
			actionCandidates,
			outputShape: {
				welcomeTitle: "string，例如：今日重点：绑定发布链接",
				greeting: "string，例如：运营工作台已准备就绪，优先推进数据同步和复盘",
				summary: "string",
				actions: [
					{
						id: "string",
						title: "string",
						description: "string",
						cta: "string",
						kind: "bind-source|sync-metrics|collect-comments|generate-review|improve-weak-post|repurpose-best-post|plan-next-post",
						postKey: "optional string",
						targetTitle:
							"optional string, the exact article name shown in the UI when postKey is present",
					},
				],
			},
		},
		null,
		2,
	)
}

function normalizeDailyInsightPayload(
	content: string,
	fallback: SelfMediaHomeDailyInsightPayload,
	overview: SelfMediaOpsOverview,
): SelfMediaHomeDailyInsightPayload {
	try {
		const parsed = JSON.parse(cleanJson(content)) as Partial<SelfMediaHomeDailyInsightPayload>
		const actionCandidates = buildDailyInsightActionCandidates(overview)
		const actions = Array.isArray(parsed.actions)
			? parsed.actions
					.map((item, index) =>
						normalizeDailyInsightAction(item, index, actionCandidates),
					)
					.filter((item): item is SelfMediaHomeDailyInsightAction => Boolean(item))
					.slice(0, MAX_DAILY_ACTIONS)
			: []
		return {
			...fallback,
			welcomeTitle: formatSelfMediaHomeWelcomeTitle(
				readText(parsed.welcomeTitle),
				fallback.welcomeTitle || "",
				overview,
			),
			greeting: formatSelfMediaHomeInsightGreeting(
				readText(parsed.greeting),
				fallback.greeting,
			),
			summary: readText(parsed.summary) || fallback.summary,
			actions: actions.length > 0 ? actions : fallback.actions,
		}
	} catch {
		return fallback
	}
}

function buildFallbackSelfMediaHomeWelcomeTitle(overview: SelfMediaOpsOverview) {
	const completion = overview.completion
	if (completion.source.done < completion.source.total) return "今日重点：绑定发布链接"
	if (completion.metrics.done < completion.metrics.total) return "今日重点：同步发布数据"
	if (completion.comments.done < completion.comments.total) return "今日重点：处理评论反馈"
	if (completion.review.done < completion.review.total) return "今日重点：完成运营复盘"
	if (overview.weakestPost) return "今日重点：修复低互动文章"
	if (overview.bestPost) return "今日重点：复用高互动样本"
	return "今日重点：规划下一篇内容"
}

function normalizeDailyInsightAction(
	value: unknown,
	index: number,
	actionCandidates: SelfMediaHomeDailyInsightAction[],
): SelfMediaHomeDailyInsightAction | null {
	if (!value || typeof value !== "object") return null
	const record = value as Record<string, unknown>
	const title = readText(record.title)
	const description = readText(record.description)
	const cta = readText(record.cta)
	const kind = readActionKind(record.kind)
	if (!title || !description || !cta || !kind) return null
	const postKey = readText(record.postKey) || undefined
	const candidate = findDailyInsightActionCandidate(actionCandidates, kind, postKey)
	if (!candidate) return null

	return {
		id: readText(record.id) || `${kind}-${index}`,
		title,
		description,
		cta,
		kind: candidate.kind,
		postKey: candidate.postKey,
		targetTitle: candidate.targetTitle,
	}
}

function buildDailyInsightActionCandidates(
	overview: SelfMediaOpsOverview,
): SelfMediaHomeDailyInsightAction[] {
	const candidates = overview.nextActions.map((action, index) => ({
		id: `${action.key}-${index}`,
		title: action.title,
		description: action.description,
		cta: action.cta,
		kind: action.key,
		postKey: action.postKey,
		targetTitle: action.targetTitle,
	}))

	if (candidates.length > 0) return candidates.slice(0, MAX_DAILY_ACTIONS)

	const fallback = buildFallbackSelfMediaHomeDailyInsight({
		overview,
		date: getSelfMediaHomeInsightDateKey(),
	}).actions

	return fallback.slice(0, MAX_DAILY_ACTIONS)
}

function findDailyInsightActionCandidate(
	candidates: SelfMediaHomeDailyInsightAction[],
	kind: SelfMediaOpsOverviewActionKey,
	postKey?: string,
) {
	return candidates.find((candidate) => candidate.kind === kind && candidate.postKey === postKey)
}

function readActionKind(value: unknown): SelfMediaOpsOverviewActionKey | null {
	const text = readText(value)
	if (
		text === "bind-source" ||
		text === "sync-metrics" ||
		text === "collect-comments" ||
		text === "generate-review" ||
		text === "improve-weak-post" ||
		text === "repurpose-best-post" ||
		text === "plan-next-post"
	) {
		return text
	}
	return null
}

function readText(value: unknown) {
	return typeof value === "string" ? value.trim() : ""
}

function normalizeGreetingText(value: string) {
	return value
		.replace(
			/今天是\s*\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日[，,、\s]*(?:周[一二三四五六日天]|星期[一二三四五六日天])?[。.!！]?/g,
			"",
		)
		.replace(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g, "")
		.replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g, "")
		.replace(/(?:周|星期)[一二三四五六日天]/g, "")
		.replace(/\d{1,2}[:：]\d{2}(?::\d{2})?/g, "")
		.replace(/(?:早上|上午|中午|下午|晚上|凌晨)好[，,、\s]*/g, "")
		.replace(/[，,、\s]+[。.!！]/g, "。")
		.replace(/[。.!！]{2,}/g, "。")
		.replace(/^[，,、\s。.!！]+|[，,、\s。.!！]+$/g, "")
}

function resolveSimpleGreeting(value: string) {
	if (/[运营工作台准备优先重点推进同步复盘内容数据发布建议机会]/.test(value)) return null
	const name = value.replace(/[，,、\s。.!！]/g, "")
	if (!name || !/^[\u4e00-\u9fa5A-Za-z0-9_-]{2,16}$/.test(name)) return null
	return `${name}，运营工作台已准备就绪`
}

function cleanJson(content: string) {
	const trimmed = content.trim()
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
	return fenced ? fenced[1].trim() : trimmed
}
