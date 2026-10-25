export interface ResizeCollapseIntent {
	progress: number
	armed: boolean
}

// 到最窄后先容忍轻微越界；继续拉动才反馈意图，达到阈值且松手才收起。
const SIDEBAR_COLLAPSE_BUFFER = { quietDistance: 32, threshold: 128, disarmRatio: 0.75 } as const

export function getResizeCollapseIntent(
	rawWidth: number,
	minWidth: number,
	wasArmed: boolean,
): ResizeCollapseIntent {
	const { threshold, quietDistance, disarmRatio } = SIDEBAR_COLLAPSE_BUFFER
	const overshoot = Math.max(0, minWidth - rawWidth)
	return {
		progress: Math.max(
			0,
			Math.min(1, (overshoot - quietDistance) / (threshold - quietDistance)),
		),
		// 例：拉到 128px 后回到 110px 仍可松手收起；回到 96px 以内才解除，避免边界抖动。
		armed: overshoot >= threshold || (wasArmed && overshoot >= threshold * disarmRatio),
	}
}
