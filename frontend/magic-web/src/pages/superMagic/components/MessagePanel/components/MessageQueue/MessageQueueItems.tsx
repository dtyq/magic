import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	KeyboardSensor,
	closestCenter,
	pointerWithin,
	useDroppable,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type Modifier,
} from "@dnd-kit/core"
import { getEventCoordinates } from "@dnd-kit/utilities"
import {
	SortableContext,
	verticalListSortingStrategy,
	sortableKeyboardCoordinates,
	arrayMove,
} from "@dnd-kit/sortable"
import { GripVertical } from "lucide-react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/utils/cn"
import type { QueuedMessage } from "../../hooks/useMessageQueue"
import type { MessageQueueProps } from "./index"
import MessageQueueRow from "./MessageQueueRow"
import { normalizeQueuePreviewText } from "./utils"

export type QueueActions = Pick<
	MessageQueueProps,
	| "onRemoveMessage"
	| "onSendMessage"
	| "onStartEdit"
	| "onWithdraw"
	| "onMove"
	| "isOperationPending"
	| "variant"
	| "editorRef"
>
const EDITOR_DROP_ID = "queue-editor-drop"

/** 仅移动视觉浮层：贴近手柄指针并限制在窗口内，不改变真实排序和输入落点。 */
const positionPreview: Modifier = ({
	activatorEvent,
	activeNodeRect,
	overlayNodeRect,
	windowRect,
	transform,
}) => {
	if (!activeNodeRect || !windowRect) return transform
	const pointer = activatorEvent ? getEventCoordinates(activatorEvent) : null
	const width = overlayNodeRect?.width ?? activeNodeRect.width
	const height = overlayNodeRect?.height ?? activeNodeRect.height
	const x = transform.x + (pointer ? pointer.x - activeNodeRect.left + 12 : 0)
	const y = transform.y + (pointer ? pointer.y - activeNodeRect.top + 12 : 0)
	return {
		...transform,
		x: Math.max(
			windowRect.left - activeNodeRect.left + 12,
			Math.min(x, windowRect.right - activeNodeRect.left - width - 12),
		),
		y: Math.max(
			windowRect.top - activeNodeRect.top + 12,
			Math.min(y, windowRect.bottom - activeNodeRect.top - height - 12),
		),
	}
}

/** 指针只在真实目标内命中；队列外松手不吸附最近的消息。键盘仍沿用原排序坐标。 */
const detectCollision: CollisionDetection = (args) => {
	const rows = args.droppableContainers.filter((container) => container.id !== EDITOR_DROP_ID)
	if (!args.pointerCoordinates) return closestCenter({ ...args, droppableContainers: rows })
	const hits = pointerWithin(args)
	const editor = hits.find((hit) => hit.id === EDITOR_DROP_ID)
	if (editor) return [editor]
	const rects = rows.flatMap((row) => {
		const rect = args.droppableRects.get(row.id)
		return rect ? [rect] : []
	})
	const { x, y } = args.pointerCoordinates
	if (
		!rects.length ||
		x < Math.min(...rects.map((rect) => rect.left)) ||
		x > Math.max(...rects.map((rect) => rect.right)) ||
		y < Math.min(...rects.map((rect) => rect.top)) ||
		y > Math.max(...rects.map((rect) => rect.bottom))
	)
		return []
	return closestCenter({ ...args, droppableContainers: rows })
}

export default function MessageQueueItems({
	queue,
	...props
}: QueueActions & { queue: QueuedMessage[] }) {
	const { t } = useTranslation("super")
	const reducedMotion = useReducedMotion()
	const [isSaving, setIsSaving] = useState(false)
	const [activeItem, setActiveItem] = useState<QueuedMessage | null>(null)
	const [overEditor, setOverEditor] = useState(false)
	const [savedOrder, setSavedOrder] = useState<string[] | null>(null)
	const dragItemsRef = useRef<QueuedMessage[]>([])
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const sortableItems = queue.filter((item) => item.status === "pending" && !item.syncState)
	const disabled =
		isSaving || props.isOperationPending || queue.some((item) => Boolean(item.syncState))
	const displayedQueue = savedOrder
		? [...queue].sort((a, b) => {
				const aIndex = savedOrder.indexOf(a.id)
				const bIndex = savedOrder.indexOf(b.id)
				return (
					(aIndex < 0 ? savedOrder.length : aIndex) -
					(bIndex < 0 ? savedOrder.length : bIndex)
				)
			})
		: queue

	async function handleDragEnd({ active, over }: DragEndEvent) {
		setActiveItem(null)
		setOverEditor(false)
		if (!over || active.id === over.id || disabled) return
		if (over.id === EDITOR_DROP_ID) {
			await props.onWithdraw(String(active.id))
			return
		}
		const items = dragItemsRef.current
		const from = items.findIndex((item) => item.id === active.id)
		const to = items.findIndex((item) => item.id === over.id)
		if (from < 0 || to < 0) return
		const moved = arrayMove(items, from, to)
		setSavedOrder(moved.map((item) => item.id))
		setIsSaving(true)
		try {
			// 松手后保持预览顺序直到服务端刷新完成，避免先跳回旧位置再移动一次。
			// 仅提交一次移动的邻项，不用拖动开始时的全队列覆盖期间的消费或新增。
			await props.onMove(
				String(active.id),
				moved[to + 1]?.id ?? null,
				moved[to - 1]?.id ?? null,
			)
		} finally {
			setSavedOrder(null)
			setIsSaving(false)
		}
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={detectCollision}
			onDragStart={({ active }) => {
				dragItemsRef.current = sortableItems
				setActiveItem(sortableItems.find((item) => item.id === active.id) ?? null)
			}}
			onDragEnd={handleDragEnd}
			onDragOver={({ over }) => setOverEditor(over?.id === EDITOR_DROP_ID)}
			onDragCancel={() => {
				setActiveItem(null)
				setOverEditor(false)
				dragItemsRef.current = []
			}}
		>
			<SortableContext
				items={displayedQueue
					.filter((item) => item.status === "pending" && !item.syncState)
					.map((item) => item.id)}
				strategy={verticalListSortingStrategy}
			>
				{displayedQueue.map((message) => (
					<MessageQueueRow
						key={message.id}
						{...props}
						message={message}
						dragDisabled={disabled}
						isOperationPending={props.isOperationPending || isSaving}
					/>
				))}
			</SortableContext>
			<EditorDropTarget editorRef={props.editorRef} active={Boolean(activeItem)} />
			{typeof document !== "undefined" &&
				createPortal(
					<DragOverlay
						dropAnimation={null}
						transition={reducedMotion ? "none" : undefined}
						modifiers={[positionPreview]}
						style={{
							width: "max-content",
							height: "auto",
							maxWidth: "calc(100vw - 24px)",
						}}
					>
						{activeItem && (
							<div
								className={cn(
									"pointer-events-none flex w-max max-w-[min(20rem,calc(100vw-24px))] items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-lg",
									overEditor ? "border-info" : "border-border",
								)}
							>
								<GripVertical size={16} className="shrink-0" />
								<div className="min-w-0">
									<div className="truncate">
										{normalizeQueuePreviewText(activeItem.content) ||
											t("messageQueue.mobile.emptyContent")}
									</div>
									<div
										className={cn(
											"text-xs",
											overEditor ? "text-info" : "text-muted-foreground",
										)}
									>
										{overEditor
											? t("messageQueue.dropToEditor")
											: t("messageQueue.sortPreview")}
									</div>
								</div>
							</div>
						)}
					</DragOverlay>,
					document.body,
				)}
		</DndContext>
	)
}

/** 复用当前编辑器真实节点作为落点；高亮通过 portal 展示，不改写 contenteditable 内容。 */
function EditorDropTarget({
	editorRef,
	active,
}: Pick<MessageQueueProps, "editorRef"> & { active: boolean }) {
	const { setNodeRef, isOver } = useDroppable({ id: EDITOR_DROP_ID, disabled: !active })
	const [rect, setRect] = useState<DOMRect | null>(null)
	useLayoutEffect(() => {
		const editor = editorRef?.current?.editor
		const node = active && editor && !editor.isDestroyed ? editor.view.dom : null
		setNodeRef(node)
		if (!node) {
			setRect(null)
			return
		}
		// 落点仍是实际可编辑区；视觉边缘使用它所属的输入框，避免遮盖正文。
		const surface = node.closest<HTMLElement>("[data-queue-editor-surface]") ?? node
		const update = () => setRect(surface.getBoundingClientRect())
		update()
		const observer = new ResizeObserver(update)
		observer.observe(surface)
		window.addEventListener("scroll", update, true)
		window.addEventListener("resize", update)
		return () => {
			observer.disconnect()
			window.removeEventListener("scroll", update, true)
			window.removeEventListener("resize", update)
			setNodeRef(null)
		}
	}, [active, editorRef, setNodeRef])
	if (!active || !isOver || !rect) return null
	return createPortal(
		<div
			aria-hidden="true"
			className="pointer-events-none fixed z-[1000] rounded-xl border border-info ring-[3px] ring-info/15"
			style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
		/>,
		document.body,
	)
}
