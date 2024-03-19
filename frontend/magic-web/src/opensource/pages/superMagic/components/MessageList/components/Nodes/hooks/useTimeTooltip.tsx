import { useState, useEffect, useRef, type MouseEvent } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { useMemoizedFn } from "ahooks"
import { createPortal } from "react-dom"
import { IconClockHour4, IconCopy } from "@tabler/icons-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { cn } from "@/opensource/lib/utils"
import dayjs from "@/opensource/lib/dayjs"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// 全局tooltip管理器
class GlobalTooltipManager {
	private static instance: GlobalTooltipManager
	private currentTooltipId: string | null = null
	private tooltipData: {
		id: string
		timestamp: number
		textContent?: string
		enableCopyMessage: boolean
		position: { x: number; y: number }
		onCopy?: () => void
	} | null = null

	static getInstance(): GlobalTooltipManager {
		if (!GlobalTooltipManager.instance) {
			GlobalTooltipManager.instance = new GlobalTooltipManager()
		}
		return GlobalTooltipManager.instance
	}

	showTooltip(
		id: string,
		timestamp: number,
		textContent: string | undefined,
		enableCopyMessage: boolean,
		position: { x: number; y: number },
		onCopy?: () => void,
	): boolean {
		this.currentTooltipId = id
		this.tooltipData = {
			id,
			timestamp,
			textContent,
			enableCopyMessage,
			position,
			onCopy,
		}
		return true
	}

	hideTooltip(id: string): void {
		if (this.currentTooltipId === id) {
			this.currentTooltipId = null
			this.tooltipData = null
		}
	}

	updatePosition(id: string, position: { x: number; y: number }): void {
		if (this.currentTooltipId === id && this.tooltipData) {
			this.tooltipData.position = position
		}
	}

	getCurrentTooltip(): typeof this.tooltipData {
		return this.tooltipData
	}

	isCurrentTooltip(id: string): boolean {
		return this.currentTooltipId === id
	}
}

/**
 * 格式化消息时间戳，根据时间差异显示不同格式
 * @param timestamp 时间戳（秒级别，如 1756132794）
 * @returns 格式化后的时间字符串
 */
export function formatMessageTime(timestamp: number): string {
	if (!timestamp) return ""

	// 将秒级时间戳转换为毫秒
	const messageTime = dayjs(timestamp * 1000)
	const now = dayjs()

	const currentYear = now.year()
	const messageYear = messageTime.year()

	const currentDate = now.format("YYYY-MM-DD")
	const messageDate = messageTime.format("YYYY-MM-DD")

	// 今天的消息：只显示时分 (12:00)
	if (currentDate === messageDate) {
		return messageTime.format("HH:mm")
	}

	// 今年但不是今天的消息：显示月日时分 (06/12 12:00)
	if (currentYear === messageYear) {
		return messageTime.format("MM/DD HH:mm")
	}

	// 不是今年的消息：显示年月日时分 (2024/06/12 12:00)
	return messageTime.format("YYYY/MM/DD HH:mm")
}

// Tooltip popup item — shared base classes
const tooltipItem = cn(
	"flex items-center gap-1 rounded-[6px]",
	"border border-border bg-background",
	"whitespace-nowrap px-[5px] py-0.5 text-xs leading-4 text-foreground",
	"shadow-md",
)

interface UseTimeTooltipOptions {
	timestamp?: number
	shouldShow?: boolean
	textContent?: string
	enableCopyMessage?: boolean
}

interface UseTimeTooltipReturn {
	isHovered: boolean
	handleMouseEnter: (event: MouseEvent) => void
	handleMouseLeave: () => void
	renderTooltip: () => React.ReactPortal | null
	renderCopyButton: () => React.ReactElement | null
}

export function useTimeTooltip({
	timestamp,
	shouldShow = true,
	textContent,
	enableCopyMessage = false,
}: UseTimeTooltipOptions): UseTimeTooltipReturn {
	const { t } = useTranslation("super")

	const [isHovered, setIsHovered] = useState(false)
	const [isInnerHovered, setIsInnerHovered] = useState(false)
	const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, height: 0 })
	const [dom, setDOM] = useState<HTMLElement | null>(null)
	// 延迟显示状态，用于防止快速移动时的闪烁
	const [shouldShowTooltip, setShouldShowTooltip] = useState(false)
	const isMobile = useIsMobile()

	// 全局tooltip管理器和唯一ID
	const tooltipManager = GlobalTooltipManager.getInstance()
	const tooltipIdRef = useRef<string>(`tooltip-${Math.random().toString(36).substr(2, 9)}`)

	// 用于存储消息容器的边界信息和tooltip元素引用
	const messageContainerRef = useRef<DOMRect | null>(null)
	const tooltipElementRef = useRef<HTMLDivElement | null>(null)
	// 全局鼠标位置存储，用于滚动时的位置计算
	const globalMousePositionRef = useRef({ x: 0, y: 0 })
	// 延迟显示tooltip的定时器
	const showDelayTimerRef = useRef<NodeJS.Timeout | null>(null)
	// 延迟隐藏tooltip的定时器
	const hideDelayTimerRef = useRef<NodeJS.Timeout | null>(null)

	// 全局鼠标位置跟踪（始终运行，不依赖tooltip状态）
	useEffect(() => {
		const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
			globalMousePositionRef.current = { x: e.clientX, y: e.clientY }
		}

		document.addEventListener("mousemove", handleGlobalMouseMove, { passive: true })

		return () => {
			document.removeEventListener("mousemove", handleGlobalMouseMove)
		}
	}, [])

	// 计算固定的tooltip位置，基于鼠标进入时的Y位置
	const calculateFixedTooltipPosition = useMemoizedFn(
		(containerRect: DOMRect, mouseY?: number) => {
			const tooltipHeight = tooltipElementRef.current?.offsetHeight || 60

			// 固定显示在消息容器的左侧
			const clampedX = containerRect.left

			// Y位置使用鼠标进入时的位置，如果没有提供则使用当前tooltip位置
			const targetY = mouseY ?? tooltipPosition.y

			// 确保Y位置在消息容器范围内且不超出边界
			const maxY = containerRect.bottom - tooltipHeight
			const minY = containerRect.top + 8
			const clampedY = Math.max(minY, Math.min(targetY, maxY))

			return {
				x: clampedX,
				y: clampedY,
				height: containerRect.height,
			}
		},
	)

	// 检查鼠标是否在扩展的悬停区域内（消息体可见区域 + 左侧栏 + tooltip区域）
	const isInHoverArea = useMemoizedFn((mouseX: number, mouseY: number) => {
		if (!messageContainerRef.current) return false

		const containerRect = messageContainerRef.current
		const leftSidebarWidth = 100 // 左侧栏宽度，可以根据需要调整

		// 尝试找到消息列表的滚动容器
		let scrollContainer: HTMLElement | null = null
		if (dom) {
			// 向上查找带有 message-list-container 类名的元素
			let parent = dom.parentElement
			while (parent) {
				if (parent.classList.contains("message-list-container")) {
					scrollContainer = parent
					break
				}
				parent = parent.parentElement
			}
		}

		// 计算消息体的可见区域边界
		const viewportTop = 100 // 消息头部高度
		let viewportBottom = window.innerHeight

		// 如果找到了滚动容器，使用滚动容器的边界
		if (scrollContainer) {
			const scrollRect = scrollContainer.getBoundingClientRect()
			viewportBottom = Math.min(viewportBottom, scrollRect.bottom)
		}

		// 消息体的可见区域边界
		const visibleTop = Math.max(containerRect.top, viewportTop)
		const visibleBottom = Math.min(containerRect.bottom, viewportBottom)

		// 如果消息体完全不可见，则不在悬停区域内
		if (visibleTop >= visibleBottom) return false

		// 基础扩展区域：消息体可见区域 + 左侧区域
		let expandedLeft = containerRect.left - leftSidebarWidth
		const expandedRight = containerRect.right
		let expandedTop = visibleTop
		let expandedBottom = visibleBottom

		// 如果tooltip存在，扩展悬停区域以包含tooltip的实际显示区域
		if (tooltipElementRef.current) {
			const tooltipRect = tooltipElementRef.current.getBoundingClientRect()

			// 扩展左边界以包含tooltip
			expandedLeft = Math.min(expandedLeft, tooltipRect.left)

			// 扩展上下边界以包含tooltip的完整高度
			// 但仍然要考虑实际的可见边界
			expandedTop = Math.min(expandedTop, Math.max(tooltipRect.top, viewportTop))
			expandedBottom = Math.max(expandedBottom, Math.min(tooltipRect.bottom, viewportBottom))
		}

		const isInArea =
			mouseX >= expandedLeft &&
			mouseX <= expandedRight &&
			mouseY >= expandedTop &&
			mouseY <= expandedBottom

		return isInArea
	})

	const handleMouseEnter = useMemoizedFn((event: MouseEvent) => {
		// 清除隐藏定时器
		if (hideDelayTimerRef.current) {
			clearTimeout(hideDelayTimerRef.current)
			hideDelayTimerRef.current = null
		}

		// 如果当前 tooltip 已在显示中（如从复制按钮移回消息体），跳过重新初始化
		if (shouldShowTooltip && tooltipManager.isCurrentTooltip(tooltipIdRef.current)) {
			return
		}

		// 强制清理当前tooltip（如果存在），确保新的tooltip能够注册
		tooltipManager.hideTooltip(tooltipIdRef.current)

		// 确保获取到最外层的消息容器元素
		let element = (event.currentTarget || event.target) as HTMLElement

		// 向上查找到包含 data-id 属性的消息容器
		// 优先使用 currentTarget，因为它是绑定事件的元素
		if (event.currentTarget && (event.currentTarget as HTMLElement).getAttribute("data-id")) {
			element = event.currentTarget as HTMLElement
		} else {
			// 如果 currentTarget 没有 data-id，则向上查找
			while (element && !element.getAttribute("data-id")) {
				element = element.parentElement as HTMLElement
				if (!element || element === document.body) {
					// 如果找不到，回退到 currentTarget
					element = (event.currentTarget || event.target) as HTMLElement
					break
				}
			}
		}

		setDOM(element)

		// 立即设置hover状态
		setIsHovered(true)

		// 初始化tooltip基础位置和消息容器边界
		const rect = element.getBoundingClientRect()
		messageContainerRef.current = rect

		// 计算并设置固定的tooltip位置，使用鼠标进入时的Y位置
		const fixedPosition = calculateFixedTooltipPosition(rect, event.clientY)
		setTooltipPosition(fixedPosition)

		// 设置300ms延迟显示定时器
		if (showDelayTimerRef.current) {
			clearTimeout(showDelayTimerRef.current)
		}

		showDelayTimerRef.current = setTimeout(() => {
			// 尝试在全局管理器中注册tooltip
			const canShow = tooltipManager.showTooltip(
				tooltipIdRef.current,
				timestamp || 0,
				textContent,
				enableCopyMessage,
				{ x: fixedPosition.x, y: fixedPosition.y },
				handleCopyMessage,
			)

			if (canShow) {
				setShouldShowTooltip(true)
			}
		}, 300)

		// 添加全局鼠标移动监听器，仅用于检测悬停区域（不再更新tooltip位置）
		const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
			// 检查是否还在扩展的悬停区域内
			if (!isInHoverArea(e.clientX, e.clientY)) {
				// 从全局管理器中移除tooltip
				tooltipManager.hideTooltip(tooltipIdRef.current)

				// 清除未触发的显示定时器，防止延迟回调在 hover 已取消后仍然注册 tooltip
				if (showDelayTimerRef.current) {
					clearTimeout(showDelayTimerRef.current)
					showDelayTimerRef.current = null
				}

				setShouldShowTooltip(false)
				setIsHovered(false)
				setIsInnerHovered(false)

				// 清理监听器和资源
				document.removeEventListener("mousemove", handleGlobalMouseMove)
			}
		}

		// 在document上添加全局监听器
		document.addEventListener("mousemove", handleGlobalMouseMove)

		// 存储清理函数
		const cleanup = () => {
			document.removeEventListener("mousemove", handleGlobalMouseMove)
		}

		;(element as HTMLElement & { __tooltipCleanup?: () => void }).__tooltipCleanup = cleanup
	})

	const handleMouseLeave = useMemoizedFn(() => {
		// 清除显示定时器（如果还没到300ms就离开了，取消显示）
		if (showDelayTimerRef.current) {
			clearTimeout(showDelayTimerRef.current)
			showDelayTimerRef.current = null
		}

		// 设置延迟隐藏，给用户时间移动到tooltip区域
		if (hideDelayTimerRef.current) {
			clearTimeout(hideDelayTimerRef.current)
		}

		hideDelayTimerRef.current = setTimeout(() => {
			if (!isInnerHovered) {
				// 从全局管理器中移除tooltip
				tooltipManager.hideTooltip(tooltipIdRef.current)

				setShouldShowTooltip(false)
				setIsHovered(false)
				setIsInnerHovered(false)

				// 清理资源
				const elementWithCleanup = dom as HTMLElement & {
					__tooltipCleanup?: () => void
				}
				if (elementWithCleanup?.__tooltipCleanup) {
					elementWithCleanup.__tooltipCleanup()
					delete elementWithCleanup.__tooltipCleanup
				}
			}
		}, 100)
	})

	const handleInnerMouseEnter = useMemoizedFn(() => {
		setIsInnerHovered(true)
		setShouldShowTooltip(true)

		// 清除隐藏定时器
		if (hideDelayTimerRef.current) {
			clearTimeout(hideDelayTimerRef.current)
			hideDelayTimerRef.current = null
		}
	})

	const handleInnerMouseLeave = useMemoizedFn((event: MouseEvent) => {
		setIsInnerHovered(false)

		// 检查鼠标是否真的离开了整个悬停区域
		const mouseX = (event as MouseEvent & { clientX?: number }).clientX || 0
		const mouseY = (event as MouseEvent & { clientY?: number }).clientY || 0

		// 使用setTimeout确保在下一个事件循环中检查
		setTimeout(() => {
			if (!isInHoverArea(mouseX, mouseY)) {
				setShouldShowTooltip(false)
				setIsHovered(false)

				// 清理资源
				const elementWithCleanup = dom as HTMLElement & { __tooltipCleanup?: () => void }
				if (elementWithCleanup?.__tooltipCleanup) {
					elementWithCleanup.__tooltipCleanup()
					delete elementWithCleanup.__tooltipCleanup
				}
			}
		}, 0)
	})

	const handleCopyMessage = useMemoizedFn(() => {
		if (typeof textContent === "string") {
			clipboard.writeText(textContent.trim())
			magicToast.success(t("common.copySuccess"))
		} else {
			magicToast.error(t("common.copyFailed"))
		}
	})

	// 监听滚动和窗口变化，更新消息容器边界和tooltip位置
	useEffect(() => {
		if (isHovered && dom) {
			const handleScroll = () => {
				const rect = dom.getBoundingClientRect()
				messageContainerRef.current = rect

				// 重新计算固定的tooltip位置，保持原有的Y位置相对关系
				const newPosition = calculateFixedTooltipPosition(rect)
				setTooltipPosition(newPosition)

				// 更新全局管理器中的位置
				tooltipManager.updatePosition(tooltipIdRef.current, {
					x: newPosition.x,
					y: newPosition.y,
				})

				// 检查鼠标是否还在扩展的悬停区域内
				const { x: mouseX, y: mouseY } = globalMousePositionRef.current
				if (!isInHoverArea(mouseX, mouseY)) {
					if (showDelayTimerRef.current) {
						clearTimeout(showDelayTimerRef.current)
						showDelayTimerRef.current = null
					}
					setIsHovered(false)
					setIsInnerHovered(false)

					// 清理资源
					const elementWithCleanup = dom as HTMLElement & {
						__tooltipCleanup?: () => void
					}
					if (elementWithCleanup?.__tooltipCleanup) {
						elementWithCleanup.__tooltipCleanup()
						delete elementWithCleanup.__tooltipCleanup
					}
				}
			}

			const handleResize = () => {
				const rect = dom.getBoundingClientRect()
				messageContainerRef.current = rect

				// 重新计算固定的tooltip位置，保持原有的Y位置相对关系
				const newPosition = calculateFixedTooltipPosition(rect)
				setTooltipPosition(newPosition)

				// 更新全局管理器中的位置
				tooltipManager.updatePosition(tooltipIdRef.current, {
					x: newPosition.x,
					y: newPosition.y,
				})

				// 窗口大小变化时，重新检查鼠标位置
				const { x: mouseX, y: mouseY } = globalMousePositionRef.current
				if (!isInHoverArea(mouseX, mouseY)) {
					if (showDelayTimerRef.current) {
						clearTimeout(showDelayTimerRef.current)
						showDelayTimerRef.current = null
					}
					setIsHovered(false)
					setIsInnerHovered(false)
				}
			}

			window.addEventListener("scroll", handleScroll, true)
			window.addEventListener("resize", handleResize)

			return () => {
				window.removeEventListener("scroll", handleScroll, true)
				window.removeEventListener("resize", handleResize)
			}
		}
	}, [isHovered, dom, calculateFixedTooltipPosition, isInHoverArea, tooltipManager])

	// 组件卸载时清理资源
	useEffect(() => {
		return () => {
			// 只清理与当前dom相关的资源，不清理定时器（定时器由其他逻辑管理）

			const elementWithCleanup = dom as HTMLElement & { __tooltipCleanup?: () => void }
			if (elementWithCleanup?.__tooltipCleanup) {
				elementWithCleanup.__tooltipCleanup()
				delete elementWithCleanup.__tooltipCleanup
			}
		}
	}, [dom])

	// 组件完全卸载时清理所有定时器和全局状态
	useEffect(() => {
		return () => {
			// 从全局管理器中移除tooltip
			tooltipManager.hideTooltip(tooltipIdRef.current)

			if (showDelayTimerRef.current) {
				clearTimeout(showDelayTimerRef.current)
				showDelayTimerRef.current = null
			}
			if (hideDelayTimerRef.current) {
				clearTimeout(hideDelayTimerRef.current)
				hideDelayTimerRef.current = null
			}
		}
	}, [])

	const renderTooltip = useMemoizedFn(() => {
		// 检查是否是当前活跃的tooltip
		if (!tooltipManager.isCurrentTooltip(tooltipIdRef.current)) {
			return null
		}

		if (isMobile || !timestamp || !shouldShow || !shouldShowTooltip) {
			return null
		}

		// 检查消息容器是否在可视区域内
		// 只有当消息完全在页面顶部消息头部区域之上时才隐藏
		if (messageContainerRef.current) {
			const containerRect = messageContainerRef.current
			// 如果消息容器的底部都在消息头部区域之上，则隐藏tooltip
			if (containerRect.bottom < 100) return null
		}

		// 确保tooltip不会显示在屏幕顶部之上
		const safeTop = Math.max(100, tooltipPosition.y)

		return createPortal(
			<div
				ref={tooltipElementRef}
				className="pointer-events-auto z-tooltip flex translate-x-[calc(-100%+32px)] flex-col items-end gap-1 pr-6"
				style={{
					position: "fixed",
					left: `${tooltipPosition.x}px`,
					top: `${safeTop}px`,
					transition: "none",
				}}
				onMouseEnter={handleInnerMouseEnter}
				onMouseLeave={handleInnerMouseLeave}
			>
				<div className={tooltipItem}>
					<IconClockHour4 size={14} stroke={1.5} />
					<span>{formatMessageTime(timestamp)}</span>
				</div>
			</div>,
			document.body,
		)
	})

	const renderCopyButton = useMemoizedFn(() => {
		if (!enableCopyMessage || !isHovered || isMobile) return null

		return (
			<Tooltip>
				<TooltipTrigger className="absolute bottom-1 right-1 z-10">
					<Button
						variant="outline"
						size="icon"
						className="h-5 w-5 cursor-pointer text-muted-foreground transition-colors"
						onClick={handleCopyMessage}
						onMouseEnter={handleInnerMouseEnter}
						onMouseLeave={handleInnerMouseLeave}
						aria-label={t("common.copyMessage")}
						tabIndex={0}
					>
						<IconCopy className="size-3" stroke={1.5} />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top" sideOffset={4}>
					{t("common.copyMessage")}
				</TooltipContent>
			</Tooltip>
		)
	})

	return {
		isHovered,
		handleMouseEnter,
		handleMouseLeave,
		renderTooltip,
		renderCopyButton,
	}
}
