import {
	useId,
	useLayoutEffect,
	useEffect,
	useState,
	useRef,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
} from "react"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { FileManagerManagementState } from "./FileManagerManagement"
import { Button } from "@/components/shadcn-ui/button"
import type { AttachmentItem } from "../../hooks/types"
import type { FilePresentation } from "../../utils/file-presentation"
import type { useFileManagerSelection } from "../../hooks/useFileManagerSelection"
import type { useFileManagerColumns } from "../../hooks/useFileManagerColumns"
import { FileManagerListHeader } from "./FileManagerListHeader"
import { FileManagerItem } from "./FileManagerItem"
import type {
	FileManagerActions,
	FileManagerRevealRequest,
	FileManagerLayout,
	FileManagerView,
	FileManagerTreeRow,
	FileManagerSort,
	FileManagerSortDirection,
} from "./types"

interface Props {
	mode: "manage" | "select" | "destination"
	disabledFolderIds?: ReadonlySet<string>
	listColumns: ReturnType<typeof useFileManagerColumns>
	sort: FileManagerSort
	sortDirection: FileManagerSortDirection
	onSort: (column: FileManagerSort, toggle?: boolean) => void
	getColumnText: (file: FilePresentation, column: FileManagerSort) => string
	management?: FileManagerManagementState
	rowDetails: ReadonlyMap<string, FileManagerTreeRow>
	onToggleFolder: (file: AttachmentItem, all?: boolean) => void
	viewport: RefObject<HTMLDivElement>
	directoryId: string | null
	items: FilePresentation[]
	view: FileManagerView
	selection: ReturnType<typeof useFileManagerSelection>
	revealRequest?: FileManagerRevealRequest
	initialScrollTop: number
	initialScrollLeft: number
	restoreReady: boolean
	onScroll: (top: number, left: number) => void
	onOpen: (file: AttachmentItem) => void
	onBack: () => void
	onForward: () => void
	onUp: () => void
	isActive: boolean
	loading: boolean
	error: boolean
	onRefresh: () => void
	query: string
	renderTag?: (file: AttachmentItem) => ReactNode
	getPopupContainer: () => HTMLElement | null
}

export function FileManagerContent(props: Props) {
	const { t } = useTranslation("super")
	const viewport = props.viewport
	const actions = props.management?.commands
	const gestures = props.management?.gestures
	const rename = props.management?.operations.names.rename
	const selecting = !props.management
	const [width, setWidth] = useState(0)
	const [keyboardFocus, setKeyboardFocus] = useState(false)
	const [showActions, setShowActions] = useState(() => window.matchMedia("(hover: none)").matches)
	const previousRename = useRef(rename?.renamingItemId)
	useEffect(() => {
		const media = window.matchMedia("(hover: none)")
		const update = () => setShowActions(media.matches)
		media.addEventListener("change", update)
		return () => media.removeEventListener("change", update)
	}, [])
	useEffect(() => {
		if (
			previousRename.current &&
			!rename?.renamingItemId &&
			props.isActive &&
			(document.activeElement === document.body ||
				viewport.current?.contains(document.activeElement))
		)
			viewport.current?.focus({ preventScroll: true })
		previousRename.current = rename?.renamingItemId
	}, [rename?.renamingItemId, props.isActive, viewport])
	const listId = useId()
	const grid = props.view === "grid"
	const padding = grid ? 13 : 10
	const columns = grid ? Math.max(1, Math.floor((width - padding * 2 + 8) / 110)) : 1
	const layout: FileManagerLayout = {
		columns,
		columnWidth: Math.max(0, (width - padding * 2 + (grid ? 8 : 0)) / columns),
		rowHeight: grid ? 138 : 34,
		itemHeight: grid ? 130 : 33,
		gap: grid ? 8 : 0,
		padding,
	}
	gestures?.setLayout(layout)
	const virtualizer = useVirtualizer({
		count: Math.ceil(props.items.length / columns),
		getScrollElement: () => viewport.current,
		estimateSize: () => layout.rowHeight,
		paddingStart: padding,
		paddingEnd: 75,
		overscan: 3,
	})
	useLayoutEffect(() => {
		const element = viewport.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			// 隐藏标签页可能暂时没有宽度；保留上次列数，避免破坏导航保存的滚动位置。
			if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [viewport])
	useLayoutEffect(() => {
		virtualizer.measure()
	}, [columns, layout.rowHeight, virtualizer])
	const restoredDirectory = useRef<string | null>()
	const restoreScroll = useMemoizedFn(() => {
		const element = viewport.current
		if (
			restoredDirectory.current === props.directoryId ||
			props.loading ||
			props.error ||
			!props.restoreReady ||
			!props.isActive ||
			!width ||
			!element?.clientHeight
		)
			return
		// 虚拟列表先取得实际尺寸，再恢复位置；用户已经操作时不能再次跳回旧位置。
		element.scrollTop = props.initialScrollTop
		if (props.listColumns.containerRef.current)
			props.listColumns.containerRef.current.scrollLeft = props.initialScrollLeft
		restoredDirectory.current = props.directoryId
	})
	useLayoutEffect(restoreScroll, [
		props.directoryId,
		props.loading,
		props.error,
		props.restoreReady,
		props.isActive,
		width,
		props.items.length,
		restoreScroll,
	])
	const revealed = useRef<number>()
	useLayoutEffect(() => {
		const request = props.revealRequest
		if (
			!request ||
			revealed.current === request.requestId ||
			props.loading ||
			props.error ||
			!props.restoreReady ||
			!props.isActive ||
			props.query ||
			!width ||
			!viewport.current?.clientHeight ||
			restoredDirectory.current !== props.directoryId
		)
			return
		const position = props.selection.positions.get(request.fileId)
		if (position === undefined) return
		// 复用虚拟器定位尚未挂载的行；只响应显式请求，普通滚动和重新渲染不重复定位。
		revealed.current = request.requestId
		virtualizer.scrollToIndex(Math.floor(position / columns), { align: "center" })
		props.selection.select(
			request.fileId,
			{ shiftKey: false, metaKey: false, ctrlKey: false },
			true,
		)
		setKeyboardFocus(true)
		viewport.current.focus({ preventScroll: true })
	}, [
		props.revealRequest,
		props.loading,
		props.error,
		props.restoreReady,
		props.isActive,
		props.query,
		props.directoryId,
		props.selection,
		width,
		columns,
		viewport,
		virtualizer,
	])
	const onScroll = () => {
		if (
			restoredDirectory.current !== props.directoryId ||
			props.loading ||
			props.error ||
			!props.isActive
		)
			return
		props.onScroll(
			viewport.current?.scrollTop ?? 0,
			props.listColumns.containerRef.current?.scrollLeft ?? 0,
		)
	}
	const selectIndex = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
		const item = props.items[Math.max(0, Math.min(props.items.length - 1, index))]?.item
		if (!item?.file_id) return
		props.selection.select(
			item.file_id,
			event,
			(event.ctrlKey || event.metaKey) && !event.shiftKey,
		)
		virtualizer.scrollToIndex(
			Math.floor(Math.max(0, Math.min(props.items.length - 1, index)) / columns),
			{ align: "auto" },
		)
	}
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!props.isActive || event.nativeEvent.isComposing || event.defaultPrevented) return
		const target = event.target
		if (
			!(target instanceof HTMLElement) ||
			target.closest(
				"input, textarea, select, button, [contenteditable=true], [role=menu]",
			) ||
			target.closest("[role=dialog]") !== viewport.current?.closest("[role=dialog]")
		)
			return
		setKeyboardFocus(true)
		const mod = event.metaKey || event.ctrlKey
		const mac = /Mac|iPhone|iPad/.test(navigator.platform)
		const key = event.key.toLowerCase()
		const execute = (command: Parameters<FileManagerActions["execute"]>[0]) => {
			event.preventDefault()
			if (actions?.canExecute(command)) actions?.execute(command)
		}
		if (mod && key === "a") {
			event.preventDefault()
			props.selection.all()
			return
		}
		if (event.altKey && key === "arrowleft") {
			event.preventDefault()
			props.onBack()
			return
		}
		if (event.altKey && key === "arrowright") {
			event.preventDefault()
			props.onForward()
			return
		}
		if (key === "arrowup" && (mac ? event.metaKey : event.altKey)) {
			event.preventDefault()
			props.onUp()
			return
		}
		if (!selecting && (key === "f2" || (mac && key === "enter"))) {
			if (!mod && !event.altKey && !event.shiftKey && !event.repeat) execute("rename")
			return
		}
		if (!selecting && (key === "delete" || (mac && event.metaKey && key === "backspace")))
			return execute("trash")
		if (props.mode === "select" && (key === " " || key === "enter")) {
			event.preventDefault()
			const id = props.selection.focusedId
			if (!id) return
			if (key === " ") props.selection.toggle(id)
			else {
				const position = props.selection.positions.get(id)
				if (position !== undefined) props.onOpen(props.items[position].item)
			}
			return
		}
		if (props.mode === "destination" && key === "enter") {
			event.preventDefault()
			const position = props.selection.focusedId
				? props.selection.positions.get(props.selection.focusedId)
				: undefined
			if (position !== undefined) props.onOpen(props.items[position].item)
			return
		}
		if (
			key === " " ||
			(!mac && key === "enter") ||
			(mac && event.metaKey && (key === "o" || key === "arrowdown"))
		) {
			event.preventDefault()
			if (props.selection.selectedIds.size === 1) {
				const id = props.selection.selectedIds.values().next().value
				const index = id ? props.selection.positions.get(id) : undefined
				if (index !== undefined) props.onOpen(props.items[index].item)
			}
			return
		}
		if (key === "escape") {
			event.preventDefault()
			if (!gestures?.cancel() && !actions?.cancelClipboard()) props.selection.clear()
			return
		}
		if (!selecting && event.shiftKey && key === "f10") {
			event.preventDefault()
			const focused = props.selection.focusedId
				? document.getElementById(`${listId}-${props.selection.focusedId}`)
				: viewport.current
			const bounds = focused?.getBoundingClientRect()
			if (focused && bounds)
				focused.dispatchEvent(
					new MouseEvent("contextmenu", {
						bubbles: true,
						clientX: bounds.left + 16,
						clientY: bounds.top + 16,
					}),
				)
			return
		}
		const current = props.selection.focusedId
			? (props.selection.positions.get(props.selection.focusedId) ?? 0)
			: -1
		if (
			!grid &&
			!props.query &&
			!mod &&
			(key === "arrowleft" || key === "arrowright") &&
			current >= 0
		) {
			event.preventDefault()
			const file = props.items[current].item
			const detail = props.rowDetails.get(file.file_id ?? "")
			if (
				detail?.expandable &&
				((key === "arrowright" && !detail.expanded) ||
					(key === "arrowleft" && detail.expanded))
			)
				props.onToggleFolder(file, event.altKey)
			else if (key === "arrowright" && detail?.expanded) selectIndex(current + 1, event)
			else if (key === "arrowleft" && detail) {
				for (let position = current - 1; position >= 0; position -= 1) {
					const parent = props.rowDetails.get(props.items[position].item.file_id ?? "")
					if (parent && parent.level < detail.level) {
						selectIndex(position, event)
						break
					}
				}
			}
			return
		}
		const offsets: Record<string, number> = {
			arrowleft: -1,
			arrowright: 1,
			arrowup: -columns,
			arrowdown: columns,
		}
		if (key in offsets || key === "home" || key === "end") {
			event.preventDefault()
			selectIndex(
				key === "home"
					? 0
					: key === "end"
						? props.items.length - 1
						: current < 0
							? 0
							: current + offsets[key],
				event,
			)
		}
	}
	// 仅限制纵向滚动越界；横向手势需要传递给外层字段视口，不能被内层列表截断。
	const content = (
		<ScrollArea
			viewportRef={viewport}
			className="min-h-0 flex-1"
			viewportClassName="relative overscroll-y-contain outline-none [&>div]:!block"
			scrollShadows
			viewportProps={{
				role: "listbox",
				"aria-label": t("fileManager.files"),
				"aria-multiselectable": true,
				"aria-busy": props.loading,
				"aria-activedescendant": props.selection.focusedId
					? `${listId}-${props.selection.focusedId}`
					: undefined,
				tabIndex: props.isActive ? 0 : -1,
				"data-manager-target": props.directoryId ?? undefined,
				onKeyDown,
				onScroll,
				onPointerDown: (event) => {
					setKeyboardFocus(false)
					gestures?.onPointerDown(event)
				},
				onPointerMove: gestures?.onPointerMove,
				onPointerUp: gestures?.onPointerUp,
				onPointerCancel: gestures?.onPointerCancel,
				onLostPointerCapture: gestures?.onLostPointerCapture,
				onContextMenuCapture: (event) => {
					if (
						selecting ||
						!(event.target instanceof Element) ||
						!event.currentTarget.contains(event.target)
					)
						return
					const id =
						event.target.closest<HTMLElement>("[data-manager-item]")?.dataset
							.managerItem
					if (!id) props.selection.clear()
					else if (!props.selection.selectedIds.has(id))
						props.selection.replace(new Set([id]))
				},
			}}
		>
			{props.error ? (
				<div role="alert" className="p-6 text-center text-sm">
					{t("userSpace.loadFailed")}
					<Button variant="ghost" size="sm" onClick={props.onRefresh}>
						{t("userSpace.retry")}
					</Button>
				</div>
			) : !props.items.length ? (
				<p role="status" className="p-10 text-center text-sm text-muted-foreground">
					{props.loading
						? t("userSpace.loading")
						: props.query
							? t("fileManager.noMatches")
							: t("fileManager.empty")}
				</p>
			) : null}
			<div className="relative min-h-full" style={{ height: virtualizer.getTotalSize() }}>
				{virtualizer.getVirtualItems().map((row) => (
					<div
						key={row.key}
						role="presentation"
						className="absolute left-0 top-0 grid w-full"
						style={{
							transform: `translateY(${row.start}px)`,
							height: layout.itemHeight,
							paddingInline: padding,
							gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
							columnGap: layout.gap,
						}}
					>
						{props.items
							.slice(row.index * columns, (row.index + 1) * columns)
							.map((resource) => (
								<FileManagerItem
									readOnly={selecting}
									disabled={props.disabledFolderIds?.has(
										resource.item.file_id ?? "",
									)}
									columns={props.listColumns.visibleIds}
									getColumnText={props.getColumnText}
									showActions={!selecting && showActions}
									onCheck={
										props.mode === "select"
											? () => {
													if (resource.item.file_id)
														props.selection.toggle(
															resource.item.file_id,
														)
												}
											: undefined
									}
									rename={
										rename?.renamingItemId === resource.item.file_id
											? rename
											: undefined
									}
									row={props.rowDetails.get(resource.item.file_id ?? "")}
									striped={row.index % 2 === 1}
									onToggleFolder={(all) =>
										props.onToggleFolder(resource.item, all)
									}
									key={resource.item.file_id}
									id={`${listId}-${resource.item.file_id}`}
									presentation={resource}
									view={props.view}
									selected={props.selection.selectedIds.has(
										resource.item.file_id ?? "",
									)}
									focused={
										keyboardFocus &&
										props.selection.focusedId === resource.item.file_id
									}
									cut={actions?.cutIds.has(resource.item.file_id ?? "")}
									menuItems={actions?.getMenuItems(resource.item)}
									onSelect={(event) => {
										viewport.current?.focus({ preventScroll: true })
										if (props.mode === "destination") {
											props.onOpen(resource.item)
											return
										}
										if (resource.item.file_id)
											props.selection.select(resource.item.file_id, event)
									}}
									onOpen={() => props.onOpen(resource.item)}
									tag={props.renderTag?.(resource.item)}
									getPopupContainer={props.getPopupContainer}
								/>
							))}
					</div>
				))}
			</div>
			{gestures?.rectangle && (
				<div
					aria-hidden
					className="pointer-events-none absolute z-10 rounded-sm border border-blue-500/50 bg-blue-500/10"
					style={gestures?.rectangle}
				/>
			)}
		</ScrollArea>
	)
	return (
		<ScrollArea
			viewportRef={props.listColumns.containerRef}
			scrollbarOrientation="horizontal"
			className="min-h-0 min-w-0 flex-1"
			viewportClassName="[&>div]:!flex [&>div]:h-full"
			viewportProps={{
				onScroll,
				onWheelCapture: () => {
					restoredDirectory.current = props.directoryId
				},
				onKeyDownCapture: () => {
					restoredDirectory.current = props.directoryId
				},
			}}
		>
			<div
				className="flex min-h-0 min-w-full flex-1 flex-col"
				style={!grid ? { minWidth: "var(--manager-list-width)" } : undefined}
			>
				{!grid && (
					<FileManagerListHeader
						columns={props.listColumns}
						sort={props.sort}
						direction={props.sortDirection}
						onSort={props.onSort}
						items={props.items}
						rowDetails={props.rowDetails}
						getText={props.getColumnText}
						getPopupContainer={props.getPopupContainer}
						isActive={props.isActive}
					/>
				)}
				{actions ? (
					<MagicDropdown
						overlayClassName="[&_[role=menuitem]]:cursor-pointer [&_[data-disabled]]:cursor-not-allowed"
						trigger={["contextMenu"]}
						rootClassName="min-h-0 flex-1"
						menu={{ items: actions?.getMenuItems() }}
						getPopupContainer={() => props.getPopupContainer() ?? document.body}
					>
						{content}
					</MagicDropdown>
				) : (
					content
				)}
			</div>
		</ScrollArea>
	)
}
