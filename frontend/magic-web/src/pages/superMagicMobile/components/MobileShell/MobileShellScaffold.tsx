import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface MobileShellScaffoldProps {
	isSidebarOpen: boolean
	sidebar: React.ReactNode
	panel: React.ReactNode
	onOpenSidebar: () => void
	onCloseSidebar: () => void
	/** `data-testid` 前缀，各路由应使用唯一前缀避免 E2E 冲突 */
	testIdPrefix?: string
	/** 蒙层关闭按钮的无障碍文案（建议走 i18n） */
	closeSidebarAriaLabel?: string
	rootClassName?: string
	panelClassName?: string
}

/**
 * 移动端全屏抽屉 + 主面板位移动画壳层。
 * 各路由传入自己的 `sidebar` / `panel` 即可；侧栏滚动需保证侧栏根节点使用 `min-h-0` + 中间区 `flex-1 overflow-y-auto`。
 * 侧栏宽度由组件内部以 Tailwind 视口比例变量统一定义，避免业务页再传固定像素值；
 * 根背景使用 Tailwind 语义色 + `dark:` + `data-[sidebar-open=true]` 组合，避免页面层手写颜色三元表达式。
 * 主面板与侧栏轨道圆角使用 Tailwind 语义档位（`rounded-*-3xl`、`shadow-2xl`）。
 * 抽屉打开时主面板使用 `rounded-l-3xl` 裁切靠侧栏一侧的整条左缘（上、下），与侧栏 `rounded-tr-3xl` / `rounded-br-3xl` 接缝配套。
 * 侧栏轨道与主面板同步 transform（关闭时侧栏 `-translate-x-full` 滑出屏外，打开时与面板右推对齐原型双层滑动）。
 * 动画时长/easing 使用 inline style（与原型 Sidebar / HomeScreen 一致），避免 Tailwind 任意 `duration-[350ms]` 未进产物导致退回 150ms。
 */
const SHELL_DRAWER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"
const SHELL_DRAWER_DURATION = "0.35s"
const SWIPE_SLOP = 8
const SWIPE_THRESHOLD_RATIO = 0.35
const SWIPE_FLING_VELOCITY = 0.3
const SWIPE_MIN_FLING_DISTANCE = 48
type GestureLock = "none" | "horizontal" | "vertical"
interface SwipeResultInput {
	startOpen: boolean
	currentPanelX: number
	sidebarWidth: number
	deltaX: number
	elapsed: number
}

/** Prototype Sidebar: transform-only transition. */
const shellSidebarTransition = `transform ${SHELL_DRAWER_DURATION} ${SHELL_DRAWER_EASING}`

/** Prototype App Panel: transform + border-radius + box-shadow share the same timing. */
const shellPanelTransition = [
	`transform ${SHELL_DRAWER_DURATION} ${SHELL_DRAWER_EASING}`,
	`border-radius ${SHELL_DRAWER_DURATION} ${SHELL_DRAWER_EASING}`,
	`box-shadow ${SHELL_DRAWER_DURATION} ${SHELL_DRAWER_EASING}`,
].join(", ")

function resolveSidebarWidth(rootEl: HTMLDivElement | null): number {
	const rootWidth = rootEl?.getBoundingClientRect().width ?? 0
	const viewportWidth = window.innerWidth || 0
	return Math.max(rootWidth * 0.8, viewportWidth * 0.8, 1)
}

function clampPanelX(panelX: number, sidebarWidth: number): number {
	return Math.max(0, Math.min(sidebarWidth, panelX))
}

/**
 * 当存在嵌套壳层时，只允许离触点最近的壳层处理手势，避免内外两层同时跟手移动。
 */
function shouldHandleTouchByClosestShell(
	target: EventTarget | null,
	currentShellRoot: HTMLElement | null,
): boolean {
	if (!currentShellRoot || !(target instanceof Element)) return true
	if (target.closest('[data-mobile-shell-swipe-guard="true"]')) return false
	return target.closest("[data-mobile-shell-scaffold]") === currentShellRoot
}

function resolveSwipeResult({
	startOpen,
	currentPanelX,
	sidebarWidth,
	deltaX,
	elapsed,
}: SwipeResultInput): { shouldOpen: boolean; shouldClose: boolean } {
	const velocity = deltaX / elapsed
	const openProgress = currentPanelX / sidebarWidth
	const closeProgress = 1 - openProgress
	const shouldOpen =
		!startOpen &&
		(openProgress >= SWIPE_THRESHOLD_RATIO ||
			(velocity > SWIPE_FLING_VELOCITY && deltaX >= SWIPE_MIN_FLING_DISTANCE))
	const shouldClose =
		startOpen &&
		(closeProgress >= SWIPE_THRESHOLD_RATIO ||
			(velocity < -SWIPE_FLING_VELOCITY && -deltaX >= SWIPE_MIN_FLING_DISTANCE))
	return { shouldOpen, shouldClose }
}

export default function MobileShellScaffold({
	isSidebarOpen,
	sidebar,
	panel,
	onOpenSidebar,
	onCloseSidebar,
	testIdPrefix = "mobile-shell",
	closeSidebarAriaLabel = "Close sidebar",
	rootClassName,
	panelClassName,
}: MobileShellScaffoldProps) {
	const rootRef = useRef<HTMLDivElement | null>(null)
	const gestureStartXRef = useRef(0)
	const gestureStartYRef = useRef(0)
	const gestureStartTimeRef = useRef(0)
	const gestureLastXRef = useRef(0)
	const gestureStartPanelXRef = useRef(0)
	const gestureSidebarWidthRef = useRef(0)
	const gestureStartOpenRef = useRef(false)
	const gestureLockRef = useRef<GestureLock>("none")
	const isGestureEnabledRef = useRef(false)
	const [dragPanelX, setDragPanelX] = useState<number | null>(null)
	const [isDragging, setIsDragging] = useState(false)

	const resetGestureRuntime = () => {
		gestureLockRef.current = "none"
		isGestureEnabledRef.current = false
		gestureSidebarWidthRef.current = 0
	}

	const resetGestureVisualState = () => {
		setIsDragging(false)
		setDragPanelX(null)
	}

	const sidebarWidth = gestureSidebarWidthRef.current || resolveSidebarWidth(rootRef.current)
	/**
	 * 使用统一 panelX（0=关闭，w=打开）驱动两层 transform，避免侧栏与主面板在拖动中出现相对错位。
	 */
	const panelX = dragPanelX ?? (isSidebarOpen ? sidebarWidth : 0)
	const sidebarX = panelX - sidebarWidth
	const interactiveTransition = isDragging ? "none" : shellSidebarTransition
	const panelTransition = isDragging ? "none" : shellPanelTransition

	useEffect(() => {
		// 外部状态变化时清理手势态，避免拖动期间路由/按钮触发状态切换导致残留位移。
		resetGestureVisualState()
		resetGestureRuntime()
	}, [isSidebarOpen])

	function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
		if (e.touches.length !== 1) return
		if (!shouldHandleTouchByClosestShell(e.target, rootRef.current)) return

		const touch = e.touches[0]
		const currentSidebarWidth = resolveSidebarWidth(rootRef.current)
		gestureSidebarWidthRef.current = currentSidebarWidth
		isGestureEnabledRef.current = true

		gestureStartXRef.current = touch.clientX
		gestureStartYRef.current = touch.clientY
		gestureStartTimeRef.current = Date.now()
		gestureLastXRef.current = touch.clientX
		gestureStartOpenRef.current = isSidebarOpen
		gestureStartPanelXRef.current = isSidebarOpen ? currentSidebarWidth : 0
		gestureLockRef.current = "none"
		resetGestureVisualState()
	}

	function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
		if (!isGestureEnabledRef.current) return
		if (e.touches.length !== 1) return
		const touch = e.touches[0]
		const dx = touch.clientX - gestureStartXRef.current
		const dy = touch.clientY - gestureStartYRef.current
		gestureLastXRef.current = touch.clientX

		if (gestureLockRef.current === "none") {
			if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return
			if (Math.abs(dy) > Math.abs(dx)) {
				gestureLockRef.current = "vertical"
				resetGestureVisualState()
				return
			}
			gestureLockRef.current = "horizontal"
		}

		if (gestureLockRef.current !== "horizontal") return

		let nextPanelX = gestureStartPanelXRef.current + dx
		const currentSidebarWidth = gestureSidebarWidthRef.current

		/**
		 * 关闭态仅响应右滑；打开态仅响应左滑。
		 * 这里用“起始态 + 方向裁剪”避免反方向误触导致的抽屉跳动。
		 */
		if (!gestureStartOpenRef.current && dx < 0) nextPanelX = 0
		if (gestureStartOpenRef.current && dx > 0) nextPanelX = currentSidebarWidth

		setIsDragging(true)
		setDragPanelX(clampPanelX(nextPanelX, currentSidebarWidth))
	}

	function handleTouchEnd() {
		if (!isGestureEnabledRef.current) return
		if (gestureLockRef.current !== "horizontal") {
			resetGestureVisualState()
			resetGestureRuntime()
			return
		}

		const currentSidebarWidth = gestureSidebarWidthRef.current
		const currentPanelX = clampPanelX(
			dragPanelX ?? gestureStartPanelXRef.current,
			currentSidebarWidth,
		)
		const elapsed = Math.max(Date.now() - gestureStartTimeRef.current, 1)
		const deltaX = gestureLastXRef.current - gestureStartXRef.current
		const { shouldOpen, shouldClose } = resolveSwipeResult({
			startOpen: gestureStartOpenRef.current,
			currentPanelX,
			sidebarWidth: currentSidebarWidth,
			deltaX,
			elapsed,
		})
		resetGestureVisualState()
		resetGestureRuntime()

		if (shouldOpen) {
			onOpenSidebar()
			return
		}

		if (shouldClose) {
			onCloseSidebar()
		}
	}

	function handleTouchCancel() {
		resetGestureVisualState()
		resetGestureRuntime()
	}

	return (
		<div
			ref={rootRef}
			data-mobile-shell-scaffold="true"
			data-sidebar-open={isSidebarOpen}
			className={cn(
				"relative h-full w-full overflow-hidden [--mobile-shell-sidebar-width:80vw]",
				// Prototype HomeScreen root when sidebar is open uses --muted; dedicated token avoids coupling to global bg-muted.
				"bg-mobile-shell-track",
				rootClassName,
			)}
			data-testid={`${testIdPrefix}-root`}
		>
			<div
				className="relative h-full w-full overflow-hidden"
				data-testid={`${testIdPrefix}-device`}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchCancel}
			>
				<div
					className={cn(
						"absolute inset-y-0 left-0 z-10 w-[var(--mobile-shell-sidebar-width)] overflow-hidden rounded-br-3xl rounded-tr-3xl",
						isSidebarOpen ? "translate-x-0" : "-translate-x-full",
					)}
					style={{
						transition: interactiveTransition,
						transform: `translateX(${sidebarX}px)`,
					}}
					data-testid={`${testIdPrefix}-sidebar`}
				>
					{sidebar}
				</div>

				{isSidebarOpen && (
					<button
						type="button"
						aria-label={closeSidebarAriaLabel}
						onClick={onCloseSidebar}
						className="absolute inset-y-0 left-[var(--mobile-shell-sidebar-width)] right-0 z-40 bg-transparent"
						data-testid={`${testIdPrefix}-overlay`}
					/>
				)}

				<div
					className={cn(
						// 共享 panel 容器默认铺一层不透明背景，避免业务页忘记设置背景时透出后侧栏内容。
						"absolute inset-0 z-30 overflow-hidden bg-mobile-background",
						isSidebarOpen && "rounded-l-3xl shadow-2xl",
						isSidebarOpen
							? "translate-x-[var(--mobile-shell-sidebar-width)]"
							: "translate-x-0",
						panelClassName,
					)}
					style={{
						transition: panelTransition,
						transform: `translateX(${panelX}px)`,
					}}
					data-testid={`${testIdPrefix}-panel`}
				>
					{panel}
				</div>
			</div>
		</div>
	)
}
