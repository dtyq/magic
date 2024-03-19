import type { MouseEvent, ReactNode } from "react"

/** 单个操作按钮的配置 */
export interface SwipeActionButtonConfig {
	label: string
	icon: ReactNode
	/** Tailwind 背景色类名，例如 "bg-destructive" */
	bgClassName: string
	/** Tailwind 文字色类名，例如 "text-destructive-foreground" */
	labelClassName: string
	onClick: (e: MouseEvent) => void
	/** 禁用态：降低透明度、禁止点击、光标变为不可用 */
	disabled?: boolean
}

interface SwipeActionButtonsProps {
	offsetX: number
	isDragging: boolean
	/** 每个按钮的基础宽度（px），默认 64 */
	buttonWidth?: number
	/**
	 * 三个操作按钮配置，DOM 顺序固定为 [more, pin, delete]（从左到右）：
	 * - delete 位于最右侧，Z 轴最高，叠牌过程中始终可见
	 * - 可通过将按钮的 disabled 设为 true 将其置为禁用态
	 */
	buttons: [SwipeActionButtonConfig, SwipeActionButtonConfig, SwipeActionButtonConfig?]
}

const SNAP_EASING = "0.32s cubic-bezier(0.34, 1.2, 0.64, 1)"

/**
 * 三操作按钮层，实现"扇形叠牌"交互：
 * - 左滑过程中：三牌 Z 轴叠压，左边缘等距（D = |offsetX|/3），delete 在最上方可见
 * - 完全展开后继续左滑：各按钮宽度等比拉伸，松手后弹性恢复
 * - DOM 顺序 More → ... → Delete 确保正确的 Z-index 层叠（最右 = 最高层）
 */
export function SwipeActionButtons({
	offsetX,
	isDragging,
	buttonWidth = 64,
	buttons,
}: SwipeActionButtonsProps) {
	const validButtons = buttons.filter(Boolean) as SwipeActionButtonConfig[]
	const N = validButtons.length
	const actionButtonWidth = N * buttonWidth

	// Phase 1 (offsetX ∈ [-actionButtonWidth, 0])：等距叠牌，宽度固定
	// Phase 2 (offsetX < -actionButtonWidth)：完全展开后拉伸
	const clampedOffset = Math.max(-actionButtonWidth, offsetX)
	const stretchPerBtn = Math.max(0, -(offsetX + actionButtonWidth)) / N
	const bw = buttonWidth + stretchPerBtn

	// 各按钮 translateX 通用公式（rightPos = N-1-i，即从右往左第几个）：
	//   translateX = bw + (rightPos+1)*clampedOffset/N - rightPos*stretchPerBtn
	const snapTransition = isDragging ? "none" : `transform ${SNAP_EASING}, width ${SNAP_EASING}`

	return (
		<>
			{validButtons.map((btn, i) => {
				const rightPos = N - 1 - i
				const translateX =
					bw + ((rightPos + 1) * clampedOffset) / N - rightPos * stretchPerBtn
				return (
					<div
						key={btn.label}
						data-swipe-actions="true"
						className={`absolute right-0 top-0 flex h-full flex-col items-center justify-center gap-1 ${btn.bgClassName} ${btn.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer active:brightness-90"}`}
						style={{
							width: bw,
							transform: `translateX(${translateX}px)`,
							transition: snapTransition,
							willChange: "transform, width",
						}}
						onClick={btn.disabled ? undefined : btn.onClick}
					>
						{btn.icon}
						<div className={`text-xs font-normal leading-none ${btn.labelClassName}`}>
							{btn.label}
						</div>
					</div>
				)
			})}
		</>
	)
}
