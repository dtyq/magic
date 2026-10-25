import { sidebarStore } from "@/stores/layout/SidebarStore"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type FocusEvent,
	type RefObject,
} from "react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

/** 宽栏、窄栏和最近列表共用虚拟行生命周期；编辑、菜单和原生拖动源必须保持挂载。 */
export function useVirtualProjectList({
	projects,
	rowHeight,
	enabled = true,
	loadEnabled = true,
	scrollKey,
	externalScrollRef,
	listRef,
	hasMore = false,
	loading = false,
	error = false,
	onLoadMore,
}: {
	projects: ProjectListItem[]
	rowHeight: number
	enabled?: boolean
	loadEnabled?: boolean
	scrollKey: string
	externalScrollRef?: RefObject<HTMLDivElement>
	/** 自有视口中的创建行等内容占据起点，但不参与虚拟项目索引。 */
	listRef?: RefObject<HTMLElement>
	hasMore?: boolean
	loading?: boolean
	error?: boolean
	onLoadMore?: () => void
}) {
	const scrollRef = useRef<HTMLDivElement>(null)
	// scrollRef 始终指向本列表；宽栏另用共享视口，窄栏与最近列表继续自有滚动。
	const [scrollMargin, setScrollMargin] = useState(0)
	useLayoutEffect(() => {
		const viewport = externalScrollRef?.current ?? (listRef ? scrollRef.current : null)
		// 显式列表尚未挂载时不能用视口替代，否则列表起点会被误算为 scrollTop。
		const list = listRef ? listRef.current : scrollRef.current
		if (!viewport || !list) return
		const measure = () => {
			setScrollMargin(
				list.getBoundingClientRect().top -
					viewport.getBoundingClientRect().top +
					viewport.scrollTop,
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(viewport)
		// 前面的工作区展开、续页或创建输入都会改变本列表起点；标题自身保持挂载和 sticky。
		let ancestor: Element | null = list
		while (ancestor && ancestor !== viewport) {
			observer.observe(ancestor)
			let sibling = ancestor.previousElementSibling
			while (sibling) {
				observer.observe(sibling)
				sibling = sibling.previousElementSibling
			}
			ancestor = ancestor.parentElement
		}
		viewport.addEventListener("scroll", measure, { passive: true })
		return () => {
			observer.disconnect()
			viewport.removeEventListener("scroll", measure)
		}
	}, [externalScrollRef, listRef, projects.length, loadEnabled])
	const [interactingIds, setInteractingIds] = useState<Set<string>>(new Set())
	const [draggedId, setDraggedId] = useState<string | null>(null)
	const [focusedId, setFocusedId] = useState<string | null>(null)
	const onInteractionChange = useCallback((id: string, active: boolean) => {
		setInteractingIds((previous) => {
			if (previous.has(id) === active) return previous
			const next = new Set(previous)
			if (active) next.add(id)
			else next.delete(id)
			return next
		})
	}, [])
	const virtualizer = useVirtualizer({
		count: projects.length,
		getScrollElement: () => externalScrollRef?.current ?? scrollRef.current,
		scrollMargin,
		estimateSize: () => rowHeight,
		getItemKey: (index) => projects[index].id,
		overscan: 4,
		initialOffset: () =>
			externalScrollRef?.current?.scrollTop ??
			sidebarStore.navigationScrollPositions.get(scrollKey) ??
			0,
		onChange: (instance) => {
			if (!externalScrollRef && instance.scrollElement)
				sidebarStore.navigationScrollPositions.set(scrollKey, instance.scrollOffset ?? 0)
		},
		enabled,
		rangeExtractor: (range) => {
			const indexes = new Set(defaultRangeExtractor(range))
			projects.forEach((project, index) => {
				if (
					interactingIds.has(project.id) ||
					project.id === draggedId ||
					project.id === focusedId
				)
					indexes.add(index)
			})
			return [...indexes].sort((a, b) => a - b)
		},
	})
	const rows = virtualizer.getVirtualItems()
	// 保留的编辑／拖动行不代表视口已经到页尾。
	const lastIndex = virtualizer.range?.endIndex ?? -1
	const viewportStart = virtualizer.scrollOffset ?? 0
	const viewportHeight = virtualizer.scrollRect?.height ?? 0
	const listIntersectsViewport =
		viewportHeight > 0 &&
		scrollMargin <= viewportStart + viewportHeight &&
		scrollMargin + virtualizer.getTotalSize() >= viewportStart
	useEffect(() => {
		if (
			enabled &&
			listIntersectsViewport &&
			loadEnabled &&
			hasMore &&
			!loading &&
			!error &&
			lastIndex >= projects.length - 5
		)
			onLoadMore?.()
	}, [
		enabled,
		listIntersectsViewport,
		loadEnabled,
		hasMore,
		loading,
		error,
		lastIndex,
		projects.length,
		onLoadMore,
	])
	useEffect(() => {
		const onDragStart = (event: DragEvent) => {
			const target = event.target instanceof Element ? event.target : null
			if (!target || !scrollRef.current?.contains(target)) return
			setDraggedId(
				target.closest<HTMLElement>("[data-virtual-project-id]")?.dataset
					.virtualProjectId ?? null,
			)
		}
		const clearDrag = () => setDraggedId(null)
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") clearDrag()
		}
		document.addEventListener("dragstart", onDragStart, true)
		document.addEventListener("dragend", clearDrag)
		document.addEventListener("drop", clearDrag)
		document.addEventListener("keydown", onKeyDown)
		document.addEventListener("visibilitychange", clearDrag)
		window.addEventListener("blur", clearDrag)
		return () => {
			document.removeEventListener("dragstart", onDragStart, true)
			document.removeEventListener("dragend", clearDrag)
			document.removeEventListener("drop", clearDrag)
			document.removeEventListener("keydown", onKeyDown)
			document.removeEventListener("visibilitychange", clearDrag)
			window.removeEventListener("blur", clearDrag)
		}
	}, [])
	const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
		setFocusedId(
			event.target.closest<HTMLElement>("[data-virtual-project-id]")?.dataset
				.virtualProjectId ?? null,
		)
	}
	const onBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
		if (
			!(event.relatedTarget instanceof Node) ||
			!event.currentTarget.contains(event.relatedTarget)
		)
			setFocusedId(null)
	}
	return {
		scrollRef,
		virtualizer,
		rows,
		scrollMargin,
		onInteractionChange,
		onFocusCapture,
		onBlurCapture,
		hasActiveInteraction: interactingIds.size > 0,
	}
}
