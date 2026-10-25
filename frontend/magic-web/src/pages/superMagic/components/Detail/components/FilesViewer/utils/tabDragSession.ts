const SETTLE_DURATION = 160
const EASING = "cubic-bezier(.2,.8,.2,1)"
const EDGE_SCROLL_SPEED = 420

interface TabGeometry {
	id: string
	element: HTMLElement
	left: number
	width: number
	height: number
	top: number
	style: Pick<CSSStyleDeclaration, "transform" | "transition" | "opacity" | "willChange">
}

interface TabDragOptions {
	container: HTMLElement
	source: HTMLElement
	event: DragEvent
	onCommit: (sourceId: string, targetId: string) => void
	onFinish: () => void
}

/**
 * 原生拖拽继续负责文件投递；此会话只负责 Tab 的几何预览。
 * | 同栏释放 | 先落位，再提交一次顺序 |
 * | 离栏投递 / 取消 | 恢复原顺序，由既有投递目标消费 DataTransfer |
 * 不移动真实 DOM 的顺序，避免拖拽中断或预览缓存跟随每帧重排。
 */
export class TabDragSession {
	private readonly tabs: TabGeometry[]
	private readonly source: TabGeometry
	private readonly ghost: HTMLElement
	private readonly blank: HTMLCanvasElement
	private readonly gap: number
	private readonly offset: number
	private readonly duration: number
	private readonly listeners = new AbortController()
	private readonly observer: ResizeObserver
	private preview: TabGeometry[]
	private x: number
	private y: number
	private lastX: number
	private frame = 0
	private lastFrameTime = 0
	private timer: ReturnType<typeof setTimeout> | undefined
	private finished = false
	private disposed = false

	constructor(private readonly options: TabDragOptions) {
		const { container, source, event } = options
		const bounds = container.getBoundingClientRect()
		this.tabs = Array.from(container.querySelectorAll<HTMLElement>("[data-tab-id]")).map(
			(element) => {
				const rect = element.getBoundingClientRect()
				return {
					id: element.dataset.tabId!,
					element,
					left: rect.left - bounds.left + container.scrollLeft,
					top: rect.top - bounds.top,
					width: rect.width,
					height: rect.height,
					style: {
						transform: element.style.transform,
						transition: element.style.transition,
						opacity: element.style.opacity,
						willChange: element.style.willChange,
					},
				}
			},
		)
		this.source = this.tabs.find((tab) => tab.element === source)!
		this.preview = [...this.tabs]
		this.gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0
		this.x = this.lastX = event.clientX
		this.y = event.clientY
		this.offset = event.clientX - source.getBoundingClientRect().left
		this.duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : SETTLE_DURATION
		this.ghost = source.cloneNode(true) as HTMLElement
		for (const element of [this.ghost, ...this.ghost.querySelectorAll<HTMLElement>("*")]) {
			for (const name of ["id", "data-tab-id", "data-testid", "aria-describedby"])
				element.removeAttribute(name)
			element.draggable = false
		}
		this.ghost.setAttribute("aria-hidden", "true")
		this.ghost.inert = true
		this.ghost
			.querySelector<HTMLElement>("[data-tab-close]")
			?.style.setProperty("visibility", "hidden")
		// 脱离滚动裁切，但沿用真实 Tab 的内容、尺寸与主题；不创建另一套文件展示。
		Object.assign(this.ghost.style, {
			position: "fixed",
			left: "0",
			top: "0",
			margin: "0",
			pointerEvents: "none",
			width: `${this.source.width}px`,
			height: `${this.source.height}px`,
			zIndex: "2000",
			transition: "none",
			opacity: "0",
			willChange: "transform",
			background: "rgb(var(--background-rgb))",
			boxShadow: "0 2px 8px rgb(0 0 0 / .12), 0 0 0 1px rgb(var(--border-rgb))",
			font: getComputedStyle(source).font,
		})
		this.blank = document.createElement("canvas")
		this.blank.width = this.blank.height = 1
		this.blank.style.cssText = "position:fixed;pointer-events:none;opacity:0"
		document.body.append(this.blank, this.ghost)
		event.dataTransfer?.setDragImage(this.blank, 0, 0)
		const signal = this.listeners.signal
		document.addEventListener("dragover", this.handleDragOver, { capture: true, signal })
		document.addEventListener("drop", this.handleDrop, { capture: true, signal })
		document.addEventListener("dragend", this.handleDragEnd, { signal })
		document.addEventListener("dragleave", this.handleDragLeave, { signal })
		document.addEventListener("keydown", this.handleKeyDown, { signal })
		window.addEventListener("blur", this.cancel, { signal })
		container.addEventListener("scroll", this.schedule, { passive: true, signal })
		this.observer = new ResizeObserver(() => {
			if (
				Math.abs(container.clientWidth - bounds.width) > 1 ||
				this.tabs.some((tab) => {
					const rect = tab.element.getBoundingClientRect()
					return (
						Math.abs(rect.width - tab.width) > 1 ||
						Math.abs(rect.height - tab.height) > 1
					)
				})
			)
				this.cancel()
		})
		this.observer.observe(container)
		this.tabs.forEach((tab) => this.observer.observe(tab.element))
		// 等浏览器抓取拖影后再隐藏源内容，真实元素仍保留布局和原生拖拽生命周期。
		this.schedule()
	}

	private inside(bounds: DOMRect): boolean {
		return (
			this.x >= bounds.left &&
			this.x <= bounds.right &&
			this.y >= bounds.top &&
			this.y <= bounds.bottom
		)
	}

	private layout(): Map<TabGeometry, number> {
		const positions = new Map<TabGeometry, number>()
		let left = this.tabs[0].left
		for (const tab of this.preview) {
			positions.set(tab, left)
			if (tab !== this.source) {
				tab.element.style.transition = `transform ${this.duration}ms ${EASING}`
				tab.element.style.transform = `translateX(${left - tab.left}px)`
				tab.element.style.willChange = "transform"
			}
			left += tab.width + this.gap
		}
		return positions
	}

	private draw(): void {
		const { container } = this.options
		const bounds = container.getBoundingClientRect()
		const inside = this.inside(bounds)
		let x = this.x - this.offset
		let y = this.y - this.source.height / 2
		if (inside) {
			const sourceIndex = this.tabs.indexOf(this.source)
			const leftFixed = this.tabs
				.slice(0, sourceIndex)
				.reverse()
				.find((tab) => !tab.element.draggable)
			const rightFixed = this.tabs
				.slice(sourceIndex + 1)
				.find((tab) => !tab.element.draggable)
			const min = leftFixed ? leftFixed.left + leftFixed.width + this.gap : this.tabs[0].left
			const last = this.tabs[this.tabs.length - 1]
			const max =
				(rightFixed ? rightFixed.left - this.gap : last.left + last.width) -
				this.source.width
			const left = Math.max(min, Math.min(x - bounds.left + container.scrollLeft, max))
			let positions = this.layout()
			const direction = Math.sign(this.x - this.lastX)
			// 只在当前移动方向跨越相邻标签中线时换位，避免动画中的边界反向触发。
			for (let count = 0; count < this.tabs.length; count++) {
				const index = this.preview.indexOf(this.source)
				const neighbor = this.preview[index + direction]
				if (!direction || !neighbor?.element.draggable) break
				const threshold = positions.get(neighbor)! + neighbor.width / 2
				const crossed =
					direction > 0 ? left + this.source.width > threshold + 3 : left < threshold - 3
				if (!crossed) break
				this.preview.splice(index, 1)
				this.preview.splice(index + direction, 0, this.source)
				positions = this.layout()
			}
			x = Math.max(
				bounds.left,
				Math.min(
					bounds.left + left - container.scrollLeft,
					bounds.right - this.source.width,
				),
			)
			y = bounds.top + this.source.top
		} else {
			this.preview = [...this.tabs]
			this.layout()
		}
		this.lastX = this.x
		this.source.element.style.opacity = "0"
		this.ghost.style.opacity = "1"
		this.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`
	}

	private schedule = (): void => {
		if (!this.frame && !this.finished) this.frame = requestAnimationFrame(this.tick)
	}

	private tick = (time: number): void => {
		this.frame = 0
		if (this.finished) return
		const { container } = this.options
		const bounds = container.getBoundingClientRect()
		const edge = Math.min(36, bounds.width / 8)
		const velocity = this.inside(bounds)
			? Math.max(-1, Math.min(1, (this.x - (bounds.right - edge)) / edge)) *
					Number(this.x > bounds.right - edge) -
				Math.max(0, Math.min(1, (bounds.left + edge - this.x) / edge))
			: 0
		const elapsed = this.lastFrameTime ? Math.min(time - this.lastFrameTime, 32) : 16
		this.lastFrameTime = time
		const oldScrollLeft = container.scrollLeft
		container.scrollLeft += (velocity * EDGE_SCROLL_SPEED * elapsed) / 1000
		// 靠边停住鼠标时，内容仍经过抓取点，方向也必须包含滚动量。
		this.lastX -= container.scrollLeft - oldScrollLeft
		this.draw()
		if (container.scrollLeft !== oldScrollLeft) this.schedule()
	}

	private handleDragOver = (event: DragEvent): void => {
		this.x = event.clientX
		this.y = event.clientY
		if (this.inside(this.options.container.getBoundingClientRect())) {
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
		}
		this.schedule()
	}

	private handleDrop = (event: DragEvent): void => {
		this.x = event.clientX
		this.y = event.clientY
		const inside = this.inside(this.options.container.getBoundingClientRect())
		if (inside) {
			event.preventDefault()
			event.stopPropagation()
		}
		this.draw()
		this.finish(inside)
	}

	private handleDragEnd = (): void => this.finish(false)
	private handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.finish(false)
	}
	private handleDragLeave = (event: DragEvent): void => {
		if (
			event.relatedTarget === null &&
			(event.clientX <= 0 ||
				event.clientY <= 0 ||
				event.clientX >= innerWidth ||
				event.clientY >= innerHeight)
		) {
			cancelAnimationFrame(this.frame)
			this.frame = 0
			this.ghost.style.opacity = "0"
			this.preview = [...this.tabs]
			this.layout()
		}
	}

	finish(commit: boolean): void {
		if (this.finished) return
		this.finished = true
		this.listeners.abort()
		this.observer.disconnect()
		cancelAnimationFrame(this.frame)
		const target = this.tabs[this.preview.indexOf(this.source)]
		if (!commit) this.preview = [...this.tabs]
		const left = this.layout().get(this.source)!
		const bounds = this.options.container.getBoundingClientRect()
		this.ghost.style.transition = `transform ${this.duration}ms ${EASING}, opacity ${this.duration}ms`
		this.ghost.style.transform = `translate3d(${bounds.left + left - this.options.container.scrollLeft}px, ${bounds.top + this.source.top}px, 0)`
		if (!this.inside(bounds)) this.ghost.style.opacity = "0"
		this.timer = setTimeout(() => {
			this.dispose()
			if (commit) this.options.onCommit(this.source.id, target.id)
		}, this.duration)
	}

	cancel = (): void => this.dispose()

	dispose(): void {
		if (this.disposed) return
		this.disposed = this.finished = true
		this.listeners.abort()
		this.observer.disconnect()
		cancelAnimationFrame(this.frame)
		clearTimeout(this.timer)
		for (const tab of this.tabs) Object.assign(tab.element.style, tab.style)
		this.ghost.remove()
		this.blank.remove()
		this.options.onFinish()
	}
}
