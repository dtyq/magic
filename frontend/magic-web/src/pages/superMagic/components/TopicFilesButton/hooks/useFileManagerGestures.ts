import {
	useEffect,
	useRef,
	useState,
	type DragEvent,
	type PointerEvent,
	type RefObject,
} from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentIndex } from "../utils/attachmentIndex"
import type { AttachmentItem } from "./types"
import type { FileManagerLayout } from "../components/FileManager/types"
import {
	FILE_MANAGER_DRAG_MIME,
	fileManagerTransfer,
	getFileManagerTransferIds,
} from "../utils/file-manager-transfer"
import {
	handleAttachmentDragEnd,
	handleMultipleFilesDragStart,
} from "../../MessageEditor/utils/drag"
import { useAutoExpandFolder } from "./useAutoExpandFolder"

interface Rectangle {
	left: number
	top: number
	width: number
	height: number
}
interface SelectionGesture {
	pointerId: number
	start: { x: number; y: number }
	client: { x: number; y: number }
	base: Set<string>
	additive: boolean
	active: boolean
}
interface Options {
	scopeKey: string
	rootId: string | null
	directoryId: string | null
	isActive: boolean
	container: RefObject<HTMLDivElement>
	viewport: RefObject<HTMLDivElement>
	index: AttachmentIndex
	ids: string[]
	selectedIds: Set<string>
	select: (ids: Set<string>) => void
	canTransfer: (ids: string[], targetId: string, mode: "move" | "copy") => boolean
	onTransfer: (ids: string[], targetId: string, mode: "move" | "copy") => void
	onExternalDrop: (data: DataTransfer, target?: AttachmentItem) => void
	allowUpload: boolean
	onNavigate: (id: string) => void
	prepareDragImage: (ids: string[]) => HTMLElement | null
	clearDragImage: () => void
}

/** 空白 Pointer 框选与原生附件拖动互斥；命中使用虚拟布局，不依赖已挂载行。 */
export function useFileManagerGestures(options: Options) {
	const layout = useRef<FileManagerLayout | null>(null)
	const gesture = useRef<SelectionGesture | null>(null)
	const pointer = useRef<{ x: number; y: number } | null>(null)
	const ownsDrag = useRef(false)
	const frame = useRef<number | null>(null)
	const highlightedTarget = useRef<HTMLElement | null>(null)
	const [rectangle, setRectangle] = useState<Rectangle | null>(null)
	const [dropTarget, setDropTarget] = useState<string | null>(null)
	const [dragMode, setDragMode] = useState<"move" | "copy">("move")
	const highlightTarget = (element: HTMLElement | null) => {
		if (highlightedTarget.current === element) return
		highlightedTarget.current?.removeAttribute("data-manager-drop-target")
		highlightedTarget.current = element
		element?.setAttribute("data-manager-drop-target", "true")
	}
	const autoExpand = useAutoExpandFolder({ delay: 1000, enabled: options.isActive })
	const position = (client: { x: number; y: number }) => {
		const element = options.viewport.current
		if (!element) return client
		const bounds = element.getBoundingClientRect()
		return {
			x: client.x - bounds.left + element.scrollLeft,
			y: client.y - bounds.top + element.scrollTop,
		}
	}
	const updateRectangle = useMemoizedFn(() => {
		const current = gesture.current
		const metrics = layout.current
		if (!current?.active || !metrics) return
		const point = position(current.client)
		const left = Math.min(point.x, current.start.x),
			top = Math.min(point.y, current.start.y)
		const right = Math.max(point.x, current.start.x),
			bottom = Math.max(point.y, current.start.y)
		setRectangle({ left, top, width: right - left, height: bottom - top })
		const selected = new Set(current.additive ? current.base : [])
		const firstRow = Math.max(0, Math.floor((top - metrics.padding) / metrics.rowHeight))
		const lastRow = Math.min(
			Math.ceil(options.ids.length / metrics.columns) - 1,
			Math.floor((bottom - metrics.padding) / metrics.rowHeight),
		)
		for (let row = firstRow; row <= lastRow; row++) {
			const y = metrics.padding + row * metrics.rowHeight
			if (y >= bottom || y + metrics.itemHeight <= top) continue
			for (let column = 0; column < metrics.columns; column++) {
				const x = metrics.padding + column * metrics.columnWidth
				const id = options.ids[row * metrics.columns + column]
				if (id && x < right && x + metrics.columnWidth - metrics.gap > left)
					selected.add(id)
			}
		}
		options.select(selected)
	})
	const stopScroll = useMemoizedFn(() => {
		if (frame.current !== null) cancelAnimationFrame(frame.current)
		frame.current = null
	})
	const startScroll = useMemoizedFn(() => {
		if (frame.current !== null) return
		const tick = () => {
			const element = options.viewport.current
			const client = gesture.current?.client ?? pointer.current
			if (!element || !client) {
				frame.current = null
				return
			}
			const bounds = element.getBoundingClientRect()
			const margin = Math.min(32, bounds.height / 4)
			const delta =
				client.y < bounds.top + margin
					? -Math.min(16, (bounds.top + margin - client.y) / 3)
					: client.y > bounds.bottom - margin
						? Math.min(16, (client.y - bounds.bottom + margin) / 3)
						: 0
			if (delta && client.x >= bounds.left && client.x <= bounds.right) {
				element.scrollTop += delta
				updateRectangle()
			}
			frame.current = requestAnimationFrame(tick)
		}
		frame.current = requestAnimationFrame(tick)
	})
	const clearSelectionGesture = useMemoizedFn((restore = false) => {
		const current = gesture.current
		gesture.current = null
		if (current && options.viewport.current?.hasPointerCapture(current.pointerId))
			options.viewport.current.releasePointerCapture(current.pointerId)
		if (restore && current) options.select(current.base)
		setRectangle(null)
		stopScroll()
	})
	const cleanup = useMemoizedFn(() => {
		options.clearDragImage()
		highlightTarget(null)
		clearSelectionGesture()
		pointer.current = null
		if (ownsDrag.current) fileManagerTransfer.setDragging(null)
		ownsDrag.current = false
		setDropTarget(null)
		autoExpand.cleanup()
	})
	useEffect(() => {
		if (!options.isActive) cleanup()
	}, [options.isActive, cleanup])
	useEffect(() => {
		window.addEventListener("blur", cleanup)
		return () => {
			window.removeEventListener("blur", cleanup)
			cleanup()
		}
	}, [cleanup])
	const targetFrom = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return undefined
		const fileElement = target.closest<HTMLElement>("[data-manager-item]")
		if (fileElement && fileElement.dataset.managerTarget === undefined) return undefined
		const element = target.closest<HTMLElement>("[data-manager-target]")
		return element && options.container.current?.contains(element)
			? element.dataset.managerTarget
			: undefined
	}
	const getMode = (event: DragEvent): "copy" | "move" =>
		(/Mac|iPhone|iPad/.test(navigator.platform) ? event.altKey : event.ctrlKey)
			? "copy"
			: "move"
	const onDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!options.isActive) return
		const targetId = targetFrom(event.target)
		const transfer = fileManagerTransfer.getDragging()
		const external = !transfer && event.dataTransfer.types.includes("Files")
		const mode = getMode(event)
		const valid =
			targetId !== undefined &&
			(external
				? options.allowUpload
				: transfer?.scopeKey === options.scopeKey &&
					options.canTransfer(transfer.fileIds, targetId, mode))
		if (!external && !event.dataTransfer.types.includes(FILE_MANAGER_DRAG_MIME)) return
		event.preventDefault()
		event.dataTransfer.dropEffect = valid ? (external ? "copy" : mode) : "none"
		setDropTarget(valid ? targetId : null)
		// 同一目录可同时出现在侧栏和路径栏；只标记鼠标实际命中的那个入口。
		highlightTarget(
			valid && event.target instanceof Element
				? event.target.closest<HTMLElement>("[data-manager-target]")
				: null,
		)
		setDragMode(mode)
		pointer.current = { x: event.clientX, y: event.clientY }
		startScroll()
		if (valid && targetId !== options.directoryId)
			autoExpand.handleDragEnter(targetId, () => options.onNavigate(targetId))
		else autoExpand.cleanup()
	}
	return {
		rectangle,
		dropTarget,
		dragMode,
		setLayout: (value: FileManagerLayout) => {
			layout.current = value
		},
		cancel: () => {
			const active = Boolean(gesture.current || pointer.current)
			clearSelectionGesture(true)
			cleanup()
			return active
		},
		onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
			const target = event.target
			// Portal 的事件仍沿 React 父树冒泡；菜单点击不能被当作文件空白框选。
			if (
				!options.isActive ||
				event.defaultPrevented ||
				event.button !== 0 ||
				event.pointerType === "touch" ||
				!(target instanceof Element) ||
				!options.viewport.current?.contains(target) ||
				target.closest(
					"[data-manager-item],button,input,textarea,select,a,[role=menu],[role=dialog],[contenteditable=true]",
				)
			)
				return
			const client = { x: event.clientX, y: event.clientY }
			const additive = event.metaKey || event.ctrlKey || event.shiftKey
			gesture.current = {
				pointerId: event.pointerId,
				start: position(client),
				client,
				base: new Set(options.selectedIds),
				additive,
				active: false,
			}
			options.viewport.current?.focus({ preventScroll: true })
			options.viewport.current?.setPointerCapture(event.pointerId)
			if (!additive) options.select(new Set())
			event.preventDefault()
		},
		onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
			const current = gesture.current
			if (!current) return
			current.client = { x: event.clientX, y: event.clientY }
			const point = position(current.client)
			if (Math.hypot(point.x - current.start.x, point.y - current.start.y) > 5)
				current.active = true
			if (current.active) {
				startScroll()
				updateRectangle()
			}
		},
		onPointerUp: () => clearSelectionGesture(),
		onPointerCancel: () => clearSelectionGesture(true),
		onLostPointerCapture: () => clearSelectionGesture(),
		onDragStart: (event: DragEvent<HTMLDivElement>) => {
			if (!options.isActive) {
				event.preventDefault()
				return
			}
			const id =
				event.target instanceof Element
					? event.target.closest<HTMLElement>("[data-manager-item]")?.dataset.managerItem
					: undefined
			if (!id) return
			clearSelectionGesture()
			const ids = getFileManagerTransferIds(
				options.selectedIds.has(id) ? options.selectedIds : [id],
				options.index,
			)
			options.select(new Set(ids))
			const transfer = { scopeKey: options.scopeKey, fileIds: ids, mode: getMode(event) }
			fileManagerTransfer.setDragging(transfer)
			ownsDrag.current = true
			// 聊天拖放复用现有协议，只传引用字段，目录的 children 不进入 DataTransfer。
			const files = ids.flatMap((fileId) => {
				const file = options.index.getItemById(fileId)
				return file
					? [
							{
								file_id: file.file_id,
								file_name: file.file_name,
								is_directory: file.is_directory,
								file_extension: file.file_extension,
								parent_id: file.parent_id,
								relative_file_path: file.relative_file_path,
								space_type: file.space_type,
								file_reference: file.file_reference,
							},
						]
					: []
			})
			handleMultipleFilesDragStart(event, files)
			event.dataTransfer.setData(FILE_MANAGER_DRAG_MIME, JSON.stringify(transfer))
			event.dataTransfer.effectAllowed = "copyMove"
			const preview = options.prepareDragImage(ids)
			if (preview) event.dataTransfer.setDragImage(preview, 20, 20)
		},
		onDragOver,
		onDragLeave: (event: DragEvent<HTMLDivElement>) => {
			if (
				event.relatedTarget instanceof Node &&
				event.currentTarget.contains(event.relatedTarget)
			)
				return
			pointer.current = null
			highlightTarget(null)
			setDropTarget(null)
			autoExpand.cleanup()
			stopScroll()
		},
		onDrop: (event: DragEvent<HTMLDivElement>) => {
			const targetId = targetFrom(event.target)
			const transfer = fileManagerTransfer.getDragging()
			const external = !transfer && event.dataTransfer.types.includes("Files")
			if (!external && !event.dataTransfer.types.includes(FILE_MANAGER_DRAG_MIME)) return
			event.preventDefault()
			if (options.isActive && targetId !== undefined) {
				if (external && options.allowUpload)
					options.onExternalDrop(event.dataTransfer, options.index.getItemById(targetId))
				else if (
					transfer?.scopeKey === options.scopeKey &&
					options.canTransfer(transfer.fileIds, targetId, getMode(event))
				)
					options.onTransfer(transfer.fileIds, targetId, getMode(event))
			}
			cleanup()
		},
		onDragEnd: (event: DragEvent<HTMLDivElement>) => {
			cleanup()
			handleAttachmentDragEnd(event)
		},
	}
}
