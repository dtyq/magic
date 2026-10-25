import { useEffect, useState } from "react"
import { resolveGenerationProgress } from "@/utils/generationProgress"

/**
 * 后端声明「这次调用正在生成媒体」的详情类型。
 *
 * 这是唯一的准入依据：由发起的工具自己决定要不要带，前端不再按工具名白名单猜。
 * 工具名会随注册名、别名、子代理委托而变（例如 `generate_canvas_images` 内部委托
 * `generate_images` 执行），白名单必然漏；而「正在生成」是后端的已知事实，直接透传即可。
 */
const GENERATION_PROGRESS_DETAIL_TYPE = "generation_progress"

/** `response_missing` 只表示历史恢复时未找到最终响应，不是强终态。 */
const TERMINAL_TOOL_STATUSES = new Set(["finished", "error", "suspended"])

/** 估算精度远低于 1 秒，每秒推进一次即可。 */
const TICK_INTERVAL_MS = 1000

/**
 * 缺少后端任务起点时，记录工具调用首次带上生成详情的当前时刻作为兼容锚点。
 *
 * 用模块级 Map 而不是组件 ref：消息列表会回收重挂载节点，ref 会丢失锚点导致进度回退。
 * 任务进入终态时删除，因此条目数只与并发中的生成任务数量相关。
 *
 * 键取 `toolCallId`，卡片没有它时退到后端任务 id（生成详情一定带），这样没有
 * tool_call_id 的卡片也能记下自己的起点、正常算出进度。
 */
const firstSeenAtByAnchorKey = new Map<string, number>()

/** 工具卡上的详情；只有生成详情这一种带预期完成时间。 */
export interface ToolGenerationProgressDetail {
	type?: string
	data?: Record<string, unknown>
}

/**
 * 读生成详情的数据体；不是该类型时返回 undefined。
 *
 * 后端在 magic-service 建单成功后才补发它，所以它可能一直缺席（历史消息、建单失败、
 * 纯素材操作）；缺席时组件不渲染，也就不会在非生成工具上显示假进度。
 */
function readGenerationProgressData(
	detail?: ToolGenerationProgressDetail,
): Record<string, unknown> | undefined {
	if (detail?.type !== GENERATION_PROGRESS_DETAIL_TYPE) {
		return undefined
	}
	const data = detail.data
	return data && typeof data === "object" ? data : undefined
}

/** 只接受非空字符串，其余（含数字、null）一律当缺席。 */
function readNonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value ? value : undefined
}

export interface ToolGenerationProgressProps {
	toolCallId?: string
	status?: string
	/** 工具详情；后端补发的任务起止时间挂在它的 data 上。 */
	detail?: ToolGenerationProgressDetail
}

interface GenerationProgressProps {
	anchorKey?: string
	active: boolean
	startedAt?: string
	expectedFinishedAt?: string
}

/**
 * 所有生成入口共用的百分比展示。调用方只决定该项是否仍在生成，时间换算始终走同一套算法。
 */
export function GenerationProgress({
	anchorKey,
	active,
	startedAt,
	expectedFinishedAt,
}: GenerationProgressProps) {
	const [observedAtMs, setObservedAtMs] = useState<number | null>(null)
	const [nowMs, setNowMs] = useState(() => Date.now())

	useEffect(() => {
		if (!anchorKey) return
		if (!active) {
			firstSeenAtByAnchorKey.delete(anchorKey)
			return
		}
		const anchor = firstSeenAtByAnchorKey.get(anchorKey) ?? Date.now()
		firstSeenAtByAnchorKey.set(anchorKey, anchor)
		setObservedAtMs(anchor)
	}, [active, anchorKey])

	useEffect(() => {
		if (!active) return
		const timer = setInterval(() => setNowMs(Date.now()), TICK_INTERVAL_MS)
		return () => clearInterval(timer)
	}, [active])

	if (!active || !anchorKey || observedAtMs === null) return null

	const percent = resolveGenerationProgress({
		status: "processing",
		startedAtMs: observedAtMs,
		startedAt,
		expectedFinishedAt,
		nowMs,
	})

	return (
		<span data-testid="generation-progress" className="tabular-nums text-muted-foreground">
			{percent}%
		</span>
	)
}

/**
 * 工具卡里的媒体生成百分比。
 *
 * 进度由 `generationProgress.ts` 使用后端任务起止时间估算；历史数据缺少任务起点时，
 * 才回退到本端观察时刻。聊天工具卡和画布元素走同一个入口，因此两端显示同一个数字。
 */
function ToolGenerationProgress({ toolCallId, status, detail }: ToolGenerationProgressProps) {
	const generationProgressData = readGenerationProgressData(detail)
	const isGenerating = !TERMINAL_TOOL_STATUSES.has(status ?? "")
	// 只有后端声明了「正在生成」的工具才需要锚点和定时器；否则消息列表里每个进行中的
	// 工具卡都会各起一个每秒定时器，而它们并不显示进度。
	const isActive = Boolean(generationProgressData) && isGenerating
	const startedAt = readNonEmptyString(generationProgressData?.started_at)
	const expectedFinishedAt = readNonEmptyString(generationProgressData?.expected_finished_at)
	// 锚点的键：优先工具调用 id，卡片没有时用后端任务 id。
	const anchorKey = toolCallId ?? readNonEmptyString(generationProgressData?.task_id)

	if (!generationProgressData) {
		return null
	}
	if (!anchorKey) {
		return null
	}
	if (!isActive) {
		// 终态仍挂载一次公共组件，让它清理兼容旧数据使用的本地时间锚点。
		return (
			<GenerationProgress
				anchorKey={anchorKey}
				active={false}
				startedAt={startedAt}
				expectedFinishedAt={expectedFinishedAt}
			/>
		)
	}

	return (
		// 挂在工具卡的同一行内、紧跟 action 文案：自身不能带外边距（会错位），
		// flex-none 保证 remark 被省略号截断时百分比依然可见。
		// 字号与行高都要跟 action 文案一致——小字号即便基线对齐，视觉重心仍偏低，
		// 看起来就是「没对齐」。
		<div className="flex-none text-xs leading-4" data-testid="tool-generation-progress">
			<GenerationProgress
				anchorKey={anchorKey}
				active={isActive}
				startedAt={startedAt}
				expectedFinishedAt={expectedFinishedAt}
			/>
		</div>
	)
}

export default ToolGenerationProgress
