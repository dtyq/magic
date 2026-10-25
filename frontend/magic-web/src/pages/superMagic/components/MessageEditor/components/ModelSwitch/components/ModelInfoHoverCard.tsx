import {
	cloneElement,
	createContext,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type HTMLAttributes,
	type PointerEvent,
	type ReactElement,
	type ReactNode,
	type RefObject,
} from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import type { ModelItem } from "../types"
import { getSelectableReasoningLevels } from "../utils"
import { hasModelInfo, ModelInfoContent } from "./ModelInfoContent"
import { ReasoningEffortSelect } from "./ReasoningEffortSelect"

export { formatContextWindow } from "./ModelInfoContent"

/** 卡片贴在面板右侧外缘，留出面板内边距与阴影的距离。 */
const MODEL_INFO_HOVER_SIDE_OFFSET = 14
/**
 * 信息卡里有可操作的强度选择器，属于带操作的悬浮面板而不是普通文字提示，
 * 因此不用 Tooltip 规范的 700ms，而是在鼠标停稳后尽快出现；关闭保留一小段过渡，方便从行移到卡片上。
 */
export const MODEL_INFO_HOVER_OPEN_DELAY_MS = 150
export const MODEL_INFO_HOVER_CLOSE_DELAY_MS = 200
/**
 * 卡片已打开时换到另一行的等待时间。比首次打开短，卡片跟手；
 * 又留出一点余量，鼠标斜着穿过其它行去够卡片时不会被中途经过的行抢走。
 */
export const MODEL_INFO_HOVER_SWITCH_DELAY_MS = 80
/** 列表最后一次滚动后，再等这么久才恢复悬停打开，避免滚动中鼠标下掠过的行逐个弹卡。 */
export const MODEL_INFO_HOVER_SCROLL_IDLE_MS = 150

interface HoverEntry {
	id: string
	anchor: HTMLElement
	model: ModelItem
	description?: string
	onReasoningEffortChange?: (model: ModelItem) => void
}

interface ModelInfoHoverController {
	enter: (entry: HoverEntry) => void
	leave: (id: string) => void
	/** 行重新渲染（例如强度已变）时，把最新数据同步给正在展示它的卡片。 */
	sync: (entry: Omit<HoverEntry, "anchor">) => void
	/** 行卸载（切 Tab、列表过滤）时，收起或取消指向它的卡片，避免卡片挂在已不存在的锚点上。 */
	release: (id: string) => void
}

const ModelInfoHoverContext = createContext<ModelInfoHoverController | null>(null)

interface ModelInfoHoverProviderProps {
	/** 模型列表的滚动容器：滚动期间收起卡片并暂停悬停打开。 */
	scrollContainerRef: RefObject<HTMLElement>
	children: ReactNode
}

/**
 * 整个桌面模型列表共用一张信息卡。
 *
 * 每行各挂一个 HoverCard 时，快速移动或滚动会让多张卡片同时处于打开/关闭过渡中，
 * 已滚出视口的行仍带着自己的卡片跟随定位，卡片就会漂到面板外。这里改为单例：
 * 行只上报悬停，卡片始终只有一张，锚点随当前行切换；滚动时立即收起，停稳后再按悬停重新打开。
 */
export function ModelInfoHoverProvider({
	scrollContainerRef,
	children,
}: ModelInfoHoverProviderProps) {
	const [entry, setEntry] = useState<HoverEntry | null>(null)
	const [open, setOpen] = useState(false)
	// 滚动或行卸载导致的收起不播淡出动画，否则旧卡片会在原位置残留一瞬。
	const [closeInstantly, setCloseInstantly] = useState(false)
	// Popover 的虚拟锚点：直接指向当前行的 DOM，Radix 会监听它的滚动祖先并在锚点变化时重新定位。
	const anchorRef = useRef<HTMLElement | null>(null)

	// 计时与状态判断都走 ref，控制器对象只创建一次，行上的事件处理器不会拿到过期闭包。
	const state = useRef({
		open: false,
		activeId: null as string | null,
		pendingId: null as string | null,
		effortMenuOpen: false,
		// 鼠标是否在卡片上：强度菜单收起时据此决定卡片是留下还是随之收起。
		pointerInCard: false,
		scrolling: false,
		openTimer: undefined as ReturnType<typeof setTimeout> | undefined,
		closeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
		scrollIdleTimer: undefined as ReturnType<typeof setTimeout> | undefined,
	}).current

	const actions = useMemo(() => {
		const cancelOpen = () => {
			clearTimeout(state.openTimer)
			state.pendingId = null
		}
		const cancelClose = () => clearTimeout(state.closeTimer)

		const show = (next: HoverEntry) => {
			cancelOpen()
			cancelClose()
			state.open = true
			state.activeId = next.id
			anchorRef.current = next.anchor
			setEntry(next)
			setCloseInstantly(false)
			setOpen(true)
		}

		const hide = (instant: boolean) => {
			cancelOpen()
			cancelClose()
			state.open = false
			state.activeId = null
			state.effortMenuOpen = false
			state.pointerInCard = false
			setCloseInstantly(instant)
			setOpen(false)
		}

		const scheduleClose = () => {
			// 强度菜单挂在 Portal 里，鼠标移进菜单会被当成离开卡片；菜单打开期间保持卡片。
			if (!state.open || state.effortMenuOpen) return
			cancelClose()
			state.closeTimer = setTimeout(() => hide(false), MODEL_INFO_HOVER_CLOSE_DELAY_MS)
		}

		const controller: ModelInfoHoverController = {
			enter(next) {
				if (state.scrolling || state.effortMenuOpen) return
				cancelClose()
				if (state.open && state.activeId === next.id) {
					cancelOpen()
					return
				}
				// pointermove 会连续触发，同一行已在等待时不重置计时。
				if (state.pendingId === next.id) return
				clearTimeout(state.openTimer)
				state.pendingId = next.id
				state.openTimer = setTimeout(
					() => show(next),
					state.open ? MODEL_INFO_HOVER_SWITCH_DELAY_MS : MODEL_INFO_HOVER_OPEN_DELAY_MS,
				)
			},
			leave(id) {
				if (state.pendingId === id) cancelOpen()
				scheduleClose()
			},
			sync(next) {
				if (state.activeId !== next.id) return
				setEntry((prev) => (prev && prev.id === next.id ? { ...prev, ...next } : prev))
			},
			release(id) {
				if (state.pendingId === id) cancelOpen()
				if (state.activeId === id) hide(true)
			},
		}

		return {
			controller,
			hide,
			scheduleClose,
			enterCard() {
				state.pointerInCard = true
				cancelOpen()
				cancelClose()
			},
			leaveCard() {
				state.pointerInCard = false
				scheduleClose()
			},
			setEffortMenuOpen(menuOpen: boolean) {
				state.effortMenuOpen = menuOpen
				// 打开菜单前可能已有排队的关闭（例如行失焦），菜单打开即以菜单为准，撤销它。
				if (menuOpen) {
					cancelClose()
					return
				}
				// 菜单收起时只收菜单：点在卡片空白处时鼠标仍在卡片上，卡片保留；
				// 在菜单里选完或点到卡片外时鼠标已离开卡片，按正常的离开延迟收起。
				if (!state.pointerInCard) scheduleClose()
			},
			onScroll() {
				state.scrolling = true
				clearTimeout(state.scrollIdleTimer)
				state.scrollIdleTimer = setTimeout(() => {
					state.scrolling = false
				}, MODEL_INFO_HOVER_SCROLL_IDLE_MS)
				cancelOpen()
				if (state.open) hide(true)
			},
		}
	}, [state])

	useEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return
		container.addEventListener("scroll", actions.onScroll, { passive: true })
		return () => container.removeEventListener("scroll", actions.onScroll)
	}, [actions, scrollContainerRef])

	useEffect(
		() => () => {
			clearTimeout(state.openTimer)
			clearTimeout(state.closeTimer)
			clearTimeout(state.scrollIdleTimer)
		},
		[state],
	)

	return (
		<ModelInfoHoverContext.Provider value={actions.controller}>
			<Popover
				open={open}
				onOpenChange={(next) => {
					// 只会收到关闭请求：Esc、点到卡片外、焦点移出卡片。
					if (!next) actions.hide(false)
				}}
			>
				<PopoverAnchor virtualRef={anchorRef} />
				{children}
				{entry ? (
					<PopoverContent
						// 父级 DropdownMenu 据此属性把卡片上的点击视为面板内部交互，不关闭模型列表。
						data-model-switch-details-overlay
						data-testid="model-info-hover-card"
						side="right"
						align="start"
						sideOffset={MODEL_INFO_HOVER_SIDE_OFFSET}
						collisionPadding={12}
						// 兜底：锚点行被滚动容器完全裁掉时隐藏卡片，不让它跟着看不见的行漂出面板。
						hideWhenDetached
						// 悬停卡片不抢焦点，键盘焦点留在模型行上；关闭时也不把焦点挪走。
						onOpenAutoFocus={(event) => event.preventDefault()}
						onCloseAutoFocus={(event) => event.preventDefault()}
						// 焦点在行之间移动由行的 focus/blur 处理；交给 Popover 关闭会把下一行刚排上的打开一并取消。
						onFocusOutside={(event) => event.preventDefault()}
						// Radix 给内容加了 tabindex=-1，点卡片空白处会让卡片抢到焦点并闪出焦点框；
						// 卡片本身不需要接收焦点（里面的按钮各自可聚焦），去掉它。
						tabIndex={undefined}
						onPointerEnter={actions.enterCard}
						onPointerLeave={actions.leaveCard}
						// 层级不低于 DropdownMenu 本身，碰撞翻转到面板上方时不会被面板挡住。
						className={cn(
							"z-dropdown w-60 max-w-[calc(100vw-24px)] rounded-xl border-border/80 bg-card p-0 shadow-[0_12px_32px_rgba(15,23,42,0.14)] duration-100",
							closeInstantly && "data-[state=closed]:animate-none",
						)}
					>
						{/* 按行重建内容，切换到另一行时强度菜单等内部状态不会串过去。 */}
						<div key={entry.id}>
							<ModelInfoContent
								model={entry.model}
								description={entry.description}
								size="card"
							/>
							{entry.onReasoningEffortChange ? (
								<div className="border-t border-border/70 px-2 py-1.5">
									<ReasoningEffortSelect
										model={entry.model}
										onReasoningEffortChange={entry.onReasoningEffortChange}
										side="bottom"
										align="end"
										onOpenChange={actions.setEffortMenuOpen}
									/>
								</div>
							) : null}
						</div>
					</PopoverContent>
				) : null}
			</Popover>
		</ModelInfoHoverContext.Provider>
	)
}

interface ModelInfoHoverCardProps {
	model: ModelItem
	description?: string
	/**
	 * 在卡片里选择档位时回调带 reasoning_effort 的模型快照。调用方把它当作选中该模型，
	 * 所以在未选中模型的卡片里改强度等于「换成这个模型并用这个强度」。不传则卡片只读。
	 */
	onReasoningEffortChange?: (model: ModelItem) => void
	/** 模型行本身，作为悬停触发器；点击、键盘选中仍由行自己处理。 */
	children: ReactElement<HTMLAttributes<HTMLElement>>
}

/**
 * 桌面模型行的悬停信息卡触发器：把行的悬停与焦点上报给 ModelInfoHoverProvider 里的共享卡片。
 * 不在 Provider 内时只渲染行本身。
 */
export function ModelInfoHoverCard({
	model,
	description = model.model_description,
	onReasoningEffortChange,
	children,
}: ModelInfoHoverCardProps) {
	const hover = useContext(ModelInfoHoverContext)
	const id = useId()
	const effortHandler =
		getSelectableReasoningLevels(model).length > 0 ? onReasoningEffortChange : undefined
	// 没有任何可补充的信息时不挂卡片，避免悬停弹出一张只有名称的空卡。
	const enabled = !!hover && (hasModelInfo(model, description) || !!effortHandler)

	useEffect(() => {
		if (enabled) hover?.sync({ id, model, description, onReasoningEffortChange: effortHandler })
	}, [enabled, hover, id, model, description, effortHandler])

	useEffect(() => () => hover?.release(id), [hover, id])

	if (!enabled || !hover) return children

	const enter = (anchor: HTMLElement) =>
		hover.enter({ id, anchor, model, description, onReasoningEffortChange: effortHandler })
	// 与 Radix HoverCard 一致：触屏没有悬停，不因触摸弹卡。
	const onPointer = (event: PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "touch") enter(event.currentTarget)
	}

	return cloneElement(children, {
		onPointerEnter: (event: PointerEvent<HTMLElement>) => {
			children.props.onPointerEnter?.(event)
			onPointer(event)
		},
		// 滚动停下后鼠标未离开当前行时，靠后续的 pointermove 重新打开卡片。
		onPointerMove: (event: PointerEvent<HTMLElement>) => {
			children.props.onPointerMove?.(event)
			onPointer(event)
		},
		onPointerLeave: (event: PointerEvent<HTMLElement>) => {
			children.props.onPointerLeave?.(event)
			if (event.pointerType !== "touch") hover.leave(id)
		},
		onFocus: (event) => {
			children.props.onFocus?.(event)
			enter(event.currentTarget)
		},
		onBlur: (event) => {
			children.props.onBlur?.(event)
			// 焦点移进卡片（点卡片里的强度按钮时，之前点选过的行会先失焦）不算离开。
			const next = event.relatedTarget
			if (next instanceof Element && next.closest("[data-model-switch-details-overlay]")) {
				return
			}
			hover.leave(id)
		},
	})
}
