import { useEffect, useRef, useState } from "react"

interface UseStalledGenerationLoadingOptions {
	/** stalled 信号必须持续这么久才允许显示,吸收 chunk 之间的正常间隙。 */
	showDelayMs?: number
	/** 显示后的最短保持时长,避免下一个 chunk 立刻到达导致 Loading 闪一下就消失。 */
	minVisibleMs?: number
	/** 话题切换等场景下立即复位,防止上一个话题的 stalled 状态泄漏到新话题。 */
	resetKey?: string
}

const DEFAULT_SHOW_DELAY_MS = 800
const DEFAULT_MIN_VISIBLE_MS = 500

/**
 * 把"生成停止推进"的瞬时信号转成可见性:延迟出现 + 最短保持。
 * 纯时间语义,不关心 stalled 的判定来源(见 bottom-loading-visibility)。
 */
export function useStalledGenerationLoading(
	isStalled: boolean,
	{
		showDelayMs = DEFAULT_SHOW_DELAY_MS,
		minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
		resetKey,
	}: UseStalledGenerationLoadingOptions = {},
): boolean {
	const [visible, setVisible] = useState(false)
	const shownAtRef = useRef(0)

	useEffect(() => {
		shownAtRef.current = 0
		setVisible(false)
	}, [resetKey])

	useEffect(() => {
		if (isStalled) {
			// 已经显示则保持,stalled 恢复期间不重复计时。
			if (visible) return undefined
			const timer = setTimeout(() => {
				shownAtRef.current = Date.now()
				setVisible(true)
			}, showDelayMs)
			return () => clearTimeout(timer)
		}

		if (!visible) return undefined
		const shownFor = Date.now() - shownAtRef.current
		if (shownFor >= minVisibleMs) {
			setVisible(false)
			return undefined
		}
		const timer = setTimeout(() => setVisible(false), minVisibleMs - shownFor)
		return () => clearTimeout(timer)
	}, [isStalled, visible, showDelayMs, minVisibleMs])

	return visible
}
