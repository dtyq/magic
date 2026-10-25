import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

/**
 * 等待工具的 tool name。
 *
 * `shell_await` 的纯 sleep 模式是当前唯一「等待 N 秒」的来源：后端
 * `_get_display_operation` 在 arguments 没有 `task_id` 时判定为 SLEEP，
 * 并把 `timeout` 渲染进 action（「等待 40 秒」）。
 */
const WAIT_TOOL_NAME = "shell_await"

/** 后端 SLEEP 分支的默认时长；arguments 缺 `timeout` 时与后端保持一致。 */
const DEFAULT_SLEEP_SECONDS = 30

/** 工具已经结束的状态；其余状态都按「等待中」处理。 */
const TERMINAL_TOOL_STATUSES = new Set(["finished", "error", "suspended", "response_missing"])

/** 计时精度到秒，每秒推进一次即可。 */
const TICK_INTERVAL_MS = 1000

/**
 * 计时起点：工具调用首次进入等待中的当前时刻。
 *
 * 用模块级 Map 而不是组件 ref：消息列表会回收重挂载节点，ref 会丢失锚点导致已等待时间回退。
 * 工具进入终态时删除，因此条目数只与并发中的等待工具数量相关。
 */
const firstSeenAtByToolCallId = new Map<string, number>()

export interface ToolWaitCountdownDetail {
	type?: string
	data?: Record<string, unknown>
}

export interface ToolWaitCountdownProps {
	toolCallId?: string
	toolName?: string
	status?: string
	/** 工具调用的原始 arguments 字符串；`timeout` 就在这里。 */
	rawArguments?: string
	/** 工具详情；arguments 也可能挂在它的 data 上（已完成的工具调用）。 */
	detail?: ToolWaitCountdownDetail
}

/**
 * 读工具调用参数。
 *
 * 优先 `rawArguments`（流式阶段 detail 可能还没到），兜底 `detail.data.arguments`，
 * 与 AskUser 工具卡读取参数的方式一致。流式阶段 arguments 可能还是半截 JSON，
 * 解析失败按参数缺席处理。
 */
function readToolArguments(
	rawArguments?: string,
	detail?: ToolWaitCountdownDetail,
): Record<string, unknown> | undefined {
	for (const candidate of [rawArguments, detail?.data?.arguments]) {
		if (typeof candidate !== "string" || !candidate) continue
		try {
			const parsed: unknown = JSON.parse(candidate)
			if (parsed && typeof parsed === "object") {
				return parsed as Record<string, unknown>
			}
		} catch {
			// 半截 JSON：继续尝试下一个来源。
		}
	}
	return undefined
}

/**
 * 纯 sleep 的总秒数；不是纯 sleep 或时长不可解析时返回 undefined。
 *
 * 判定与后端 `_get_display_operation` 对齐：只有 `task_id` 缺席才是纯 sleep。
 * 带 `task_id` 时是等待后台命令，可能提前返回，没有确定的等待时长，不显示计时。
 */
function resolveSleepTotalSeconds(
	toolName?: string,
	rawArguments?: string,
	detail?: ToolWaitCountdownDetail,
): number | undefined {
	if (toolName !== WAIT_TOOL_NAME) return undefined
	const args = readToolArguments(rawArguments, detail)
	if (!args) return undefined
	if (args.task_id !== undefined && args.task_id !== null) return undefined

	const timeout = args.timeout ?? DEFAULT_SLEEP_SECONDS
	if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0) return undefined
	return Math.floor(timeout)
}

/**
 * 等待工具卡里的已用时间。
 *
 * 纯 sleep 的时长在调用时已确定，所以同时给出已等待和总时长；不显示剩余时间，
 * 因为沙箱调度会让真实结束时间偏离请求值。工具进入终态即停止计时。
 */
function ToolWaitCountdown({
	toolCallId,
	toolName,
	status,
	rawArguments,
	detail,
}: ToolWaitCountdownProps) {
	const { t } = useTranslation("super")
	const totalSeconds = useMemo(
		() => resolveSleepTotalSeconds(toolName, rawArguments, detail),
		[detail, rawArguments, toolName],
	)
	const isWaiting = !TERMINAL_TOOL_STATUSES.has(status ?? "")
	// 没有 toolCallId 就没有稳定的锚点键，重挂载会让已等待时间回退，宁可不显示。
	const isActive = totalSeconds !== undefined && isWaiting && Boolean(toolCallId)
	const [observedAtMs, setObservedAtMs] = useState<number | null>(null)
	const [nowMs, setNowMs] = useState(() => Date.now())

	useEffect(() => {
		if (!toolCallId) {
			return
		}
		if (!isActive) {
			firstSeenAtByToolCallId.delete(toolCallId)
			return
		}
		// 起点取当前时间并按工具调用缓存：重渲染、列表回收重挂载都拿到同一个值。
		const anchor = firstSeenAtByToolCallId.get(toolCallId) ?? Date.now()
		firstSeenAtByToolCallId.set(toolCallId, anchor)
		setObservedAtMs(anchor)
	}, [isActive, toolCallId])

	useEffect(() => {
		if (!isActive) {
			return
		}
		const timer = setInterval(() => setNowMs(Date.now()), TICK_INTERVAL_MS)
		return () => clearInterval(timer)
	}, [isActive])

	if (!isActive || totalSeconds === undefined || observedAtMs === null) {
		return null
	}

	// sleep 不会超过自己请求的时长；沙箱慢时也按总时长封顶，避免出现「已等待 45 秒 / 共 40 秒」。
	const elapsedSeconds = Math.min(Math.floor((nowMs - observedAtMs) / 1000), totalSeconds)

	return (
		<div className="mt-1" data-testid="tool-wait-countdown">
			<span className="text-[10px] tabular-nums leading-3 text-muted-foreground">
				{t("toolWaitCountdown.elapsed", { seconds: elapsedSeconds, total: totalSeconds })}
			</span>
		</div>
	)
}

export default ToolWaitCountdown
