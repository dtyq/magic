import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * 每个操作按钮的视觉宽度对应 Tailwind w-16（4rem）。
 * 此处保留 px 数值仅用于 JS 层的 translateX 运算，必须与 CSS 的 w-16 保持一致。
 * 64 = 4rem × 16px/rem（默认基准字体大小）。
 */
const ACTION_BTN_W = 64

/**
 * 触发完全展开/关闭的滑动阈值：超过 1.5 个按钮宽度算作有意识的左滑
 */
const SNAP_THRESHOLD = ACTION_BTN_W * 1.5

/**
 * 纵向滚动意图判断阈值（px）：手指纵向移动超过此值视为列表滚动，不接管横向
 */
const VERTICAL_INTENT_THRESHOLD = 12

/**
 * 有效横向拖动的最小位移（px）：小于此值视为点按而非拖动
 */
const DRAG_THRESHOLD = 4

export interface SwipeAction {
	id: string
	/** 按钮标签（需经过 i18n 处理后传入） */
	label: string
	/** 图标元素 */
	icon: ReactNode
	/** 按钮背景色 Tailwind 类，如 bg-destructive、bg-primary、bg-secondary */
	className?: string
	/** 标签文字颜色 Tailwind 类 */
	labelClassName?: string
	/** 点击后的回调，组件内部已阻止冒泡 */
	onClick: () => void
	/** 操作按钮的 data-testid */
	"data-testid"?: string
}

interface SwipeActionRowProps {
	/** 操作按钮列表（从左到右排列），最多 3 个 */
	actions: SwipeAction[]
	/** 该行是否处于展开状态，由父层控制以实现同时只展开一行 */
	isOpen: boolean
	/** 滑动超过阈值后调用，父层应将本行标记为 openId */
	onOpen: () => void
	/** 行回弹（关闭）时调用，父层应清除 openId */
	onClose: () => void
	/**
	 * 非拖动且非纵向滚动时触发的行点击。
	 * 使用者应在此处执行导航/打开操作。
	 * 若不传则点击行无额外效果。
	 */
	onRowClick?: () => void
	children: ReactNode
	className?: string
	/** 行容器的 data-testid */
	"data-testid"?: string
}

/**
 * 通用左滑操作行组件，复刻自原型 ChatsScreen.tsx 的 SwipeChatItem。
 *
 * 布局说明：
 * - 外层 overflow-hidden，高度由内容决定（默认 h-16）
 * - 内容层用 translateX 左移
 * - 动作层绝对定位在右侧，translateX(calc(100% + x)) 随内容滑出进入可见区（100% 避免关闭态露出竖线）
 *
 * 注意：
 * - touchMove 检测纵向意图（|dy| > 12px），避免列表纵向滚动时误触
 * - touchEnd 后的合成 click 通过 openedFromTouchEnd ref 防止重复触发
 */
export function SwipeActionRow({
	actions,
	isOpen,
	onOpen,
	onClose,
	onRowClick,
	children,
	className,
	"data-testid": dataTestId,
}: SwipeActionRowProps) {
	/** 所有操作按钮的总宽度，决定内容层最大左移距离 */
	const totalActionW = actions.length * ACTION_BTN_W

	const touchStartX = useRef(0)
	const touchStartY = useRef(0)
	/** 当前手势是否由行内侧滑接管（接管后才阻止冒泡，避免影响全局右滑开菜单） */
	const hasGestureOwnership = useRef(false)
	/** 触摸开始时内容层的当前 translateX 基线（已展开时为 -totalActionW，否则为 0） */
	const dragBaseX = useRef(0)
	/** 是否发生过有效横向拖动（|dx| > 4px） */
	const hasDragged = useRef(false)
	/**
	 * 纵向滚动意图标记：如果手指在纵向移动超过 12px，
	 * 则视为用户在滚动列表，不应在松手时触发行点击或横向展开
	 */
	const verticalScrollIntent = useRef(false)
	/**
	 * 避免 touchend 已触发 onRowClick 后，移动端再合成一次 click 事件导致重复触发
	 */
	const openedFromTouchEnd = useRef(false)

	const [translateX, setTranslateX] = useState(0)
	const [isDragging, setIsDragging] = useState(false)

	/**
	 * 父层通过 isOpen 互斥控制展开行时，同步内部位移，避免视觉状态与 openId 不一致。
	 */
	useEffect(() => {
		setTranslateX(isOpen ? -totalActionW : 0)
	}, [isOpen, totalActionW])

	function handleTouchStart(e: React.TouchEvent) {
		touchStartX.current = e.touches[0].clientX
		touchStartY.current = e.touches[0].clientY
		hasGestureOwnership.current = false
		// 已展开时，基线为 -totalActionW；否则为 0
		dragBaseX.current = isOpen ? -totalActionW : 0
		hasDragged.current = false
		verticalScrollIntent.current = false
		openedFromTouchEnd.current = false
	}

	function handleTouchMove(e: React.TouchEvent) {
		const dx = e.touches[0].clientX - touchStartX.current
		const dy = e.touches[0].clientY - touchStartY.current

		// 纵向位移明显时标记为滚动意图，后续 touchEnd 不触发点击或展开
		if (Math.abs(dy) > VERTICAL_INTENT_THRESHOLD) {
			verticalScrollIntent.current = true
		}

		// 横向移动未超过纵向时，不拦截纵向滚动
		if (!isDragging && Math.abs(dy) > Math.abs(dx)) return

		if (Math.abs(dx) > DRAG_THRESHOLD) hasDragged.current = true

		/**
		 * 关闭态下仅左滑接管；打开态下左右滑都由行内接管（用于收起）。
		 * 这样未触发行内侧滑时，右滑仍可冒泡给外层菜单手势。
		 */
		const shouldCaptureGesture = isOpen ? Math.abs(dx) > DRAG_THRESHOLD : dx < -DRAG_THRESHOLD
		if (!shouldCaptureGesture) return
		hasGestureOwnership.current = true
		e.stopPropagation()
		setIsDragging(true)

		// clamp：内容层不超过 [-totalActionW, 0] 范围
		const newX = Math.max(-totalActionW, Math.min(0, dragBaseX.current + dx))
		setTranslateX(newX)
	}

	function handleTouchEnd(e: React.TouchEvent) {
		if (hasGestureOwnership.current) {
			e.stopPropagation()
		}
		setIsDragging(false)

		if (isOpen) {
			// 已展开：向右回弹超过阈值则关闭
			if (translateX > -totalActionW + SNAP_THRESHOLD) {
				setTranslateX(0)
				onClose()
			} else {
				setTranslateX(-totalActionW)
			}
		} else {
			// 已关闭：向左超过阈值则展开；否则视为点击行
			if (translateX < -SNAP_THRESHOLD) {
				setTranslateX(-totalActionW)
				onOpen()
			} else {
				setTranslateX(0)
				if (!hasDragged.current && !verticalScrollIntent.current) {
					openedFromTouchEnd.current = true
					onRowClick?.()
				}
			}
		}
	}

	function closeRow() {
		setTranslateX(0)
		onClose()
	}

	return (
		<div
			className={cn(
				"relative flex h-16 w-full shrink-0 items-center overflow-hidden",
				className,
			)}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onClick={() => {
				// 防止 touchend 已触发点击后合成 click 再触发一次
				if (openedFromTouchEnd.current) {
					openedFromTouchEnd.current = false
					return
				}
				// 拖动过或已展开时不触发行点击
				if (isOpen || hasDragged.current || verticalScrollIntent.current) return
				onRowClick?.()
			}}
			data-testid={dataTestId}
		>
			<div
				className="relative z-10 w-full shrink-0"
				style={{
					transform: `translateX(${translateX}px)`,
					transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
				}}
			>
				{children}
			</div>

			{/* 动作按钮层：calc(100% + x) 以自身宽度完全藏到右侧，避免硬编码 px 与 w-16 舍入误差 */}
			<div
				className="absolute right-0 top-0 flex h-full"
				style={{
					transform: `translateX(calc(100% + ${translateX}px))`,
					transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
				}}
			>
				{actions.map((action) => (
					<button
						key={action.id}
						type="button"
						data-testid={action["data-testid"]}
						className={cn(
							"flex h-full w-16 flex-col items-center justify-center gap-1",
							action.className,
						)}
						onClick={(e) => {
							e.stopPropagation()
							closeRow()
							action.onClick()
						}}
					>
						{action.icon}
						<span className={cn("text-[12px] leading-none", action.labelClassName)}>
							{action.label}
						</span>
					</button>
				))}
			</div>
		</div>
	)
}
