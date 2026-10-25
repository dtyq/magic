/**
 * 生成进度估算。
 *
 * provider 不返回 step 级真实进度。正常路径用后端下发的任务起点和预期完成时间计算：
 * `(now - startedAt) / (expectedFinishedAt - startedAt)`。Canvas 和工具卡共用本函数和同一对时间，
 * 因此刷新或重渲染不会改变口径。本地观察时刻只用于兼容缺少后端起点的数据。
 */

/** 缺少后端起点时无法恢复分辨率档位，沿用历史 90 秒兜底。 */
const FALLBACK_ESTIMATED_SECONDS = 90

/** 仅用于拒绝缺少后端起点时推导出的异常时长。 */
const MAX_PLAUSIBLE_DURATION_SECONDS = 600

export type GenerationProgressStatus =
	"pending" | "processing" | "completed" | "failed" | "terminated"

export interface GenerationProgressInput {
	/** 本端首次观察时刻；仅在后端起点缺失时使用。 */
	startedAtMs: number
	status: GenerationProgressStatus
	/** 后端下发的任务发起时间（ISO 8601，带时区）。 */
	startedAt?: string
	/** 后端下发的预期完成时间（ISO 8601，带时区）。 */
	expectedFinishedAt?: string
	/** 进入 failed / terminated 的时刻；缺省时按 nowMs 冻结。 */
	endedAtMs?: number
	nowMs?: number
}

/** 解析后端 ISO 8601 时间；失败时由调用方走兼容路径。 */
export function parseBackendDateTime(value?: string | null): number | undefined {
	if (!value) {
		return undefined
	}
	const timestamp = Date.parse(value)
	return Number.isNaN(timestamp) ? undefined : timestamp
}

/** 优先用后端起止时间；时间不完整时才回退到本地锚点。 */
function resolveAnchorAndDuration({
	startedAt,
	expectedFinishedAt,
	startedAtMs,
}: Pick<GenerationProgressInput, "startedAt" | "expectedFinishedAt" | "startedAtMs">): {
	anchorMs: number
	estimatedSeconds: number
} {
	const backendStartedAtMs = parseBackendDateTime(startedAt)
	const expectedFinishedAtMs = parseBackendDateTime(expectedFinishedAt)

	if (backendStartedAtMs !== undefined && expectedFinishedAtMs !== undefined) {
		const durationSeconds = (expectedFinishedAtMs - backendStartedAtMs) / 1000
		if (durationSeconds > 0) {
			return { anchorMs: backendStartedAtMs, estimatedSeconds: durationSeconds }
		}
	}

	if (expectedFinishedAtMs !== undefined) {
		const derivedSeconds = (expectedFinishedAtMs - startedAtMs) / 1000
		if (derivedSeconds > 0 && derivedSeconds <= MAX_PLAUSIBLE_DURATION_SECONDS) {
			return { anchorMs: startedAtMs, estimatedSeconds: derivedSeconds }
		}
	}

	return { anchorMs: startedAtMs, estimatedSeconds: FALLBACK_ESTIMATED_SECONDS }
}

/**
 * 按元素 / 工具卡上的原始字段一步算出 1~99 的估算进度。
 *
 * Canvas 和工具卡共用这一个入口，起点与总时长均在内部统一决定。
 *
 * - `completed` 直接 100
 * - `failed` / `terminated` 冻结在进入终态的那一刻，不再增长
 * - 其余状态按「已过时间 / 预计总时长」线性换算，超过预计时长仍停在 99%，不会越过 100
 */
export function resolveGenerationProgress({
	startedAtMs,
	status,
	startedAt,
	expectedFinishedAt,
	endedAtMs,
	nowMs = Date.now(),
}: GenerationProgressInput): number {
	if (status === "completed") {
		return 100
	}

	const { anchorMs, estimatedSeconds } = resolveAnchorAndDuration({
		startedAt,
		expectedFinishedAt,
		startedAtMs,
	})

	const isFrozen = status === "failed" || status === "terminated"
	const effectiveNowMs = isFrozen ? (endedAtMs ?? nowMs) : nowMs
	const elapsedSeconds = Math.max(0, (effectiveNowMs - anchorMs) / 1000)
	const ratio = Math.min(1, elapsedSeconds / estimatedSeconds)
	return Math.min(99, Math.max(1, Math.floor(ratio * 100)))
}
