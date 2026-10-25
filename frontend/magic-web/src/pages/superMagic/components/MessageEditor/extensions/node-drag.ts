import { Plugin, PluginKey, TextSelection } from "@/infrastructure/editors/tiptap/pm-state"
import type { Node as ProseMirrorNode } from "prosemirror-model"
import type { EditorView } from "prosemirror-view"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { sanitizeCopiedInspectorDetailAttrs } from "./inspector-detail/copyAttrs"
import { INSPECTOR_DETAIL_TYPE } from "./inspector-detail/const"

export const MAGIC_NODE_DRAG_MIME = "application/x-magic-editor-node+json"
export const MAGIC_NODE_POINTER_PENDING_CLASS = "magic-node-pointer-pending"
export const MAGIC_NODE_DRAGGING_CLASS = "magic-node-dragging"
const MAGIC_NODE_DRAG_VERSION = 1
const nodeDragPluginKey = new PluginKey("magicNodeDrag")
const DROP_CURSOR_CLASS = "magic-node-dropcursor"
const POINTER_DRAG_THRESHOLD = 4

export interface MagicNodeDragOptions {
	/** The receiving editor owns reference validation; editor moves keep their original attrs. */
	prepareCopiedMention?: (
		attrs: Record<string, unknown>,
	) => TiptapMentionAttributes | null | Promise<TiptapMentionAttributes | null>
}

interface MagicNodeDragPayload {
	version: number
	node: {
		type: string
		attrs: Record<string, unknown>
	}
	sourceEditorId?: string
	sourcePosition?: number
	sourceDragId?: string
	text: string
}

interface MagicNodeDragSource {
	view: EditorView
	element: HTMLElement
}

interface MagicNodePointerDragSession {
	payload: MagicNodeDragPayload
	sourceView?: EditorView
	sourceElement: HTMLElement
	pointerId: number
	startX: number
	startY: number
	active: boolean
}

interface MagicNodeDropTarget {
	view: EditorView
	position: number
}

export function setMagicNodeDragData(
	event: DragEvent,
	type: string,
	attrs: Record<string, unknown>,
	source?: { editorId: string; position: number; dragId?: string },
	previewElement?: HTMLElement | null,
) {
	if (!event.dataTransfer) return false

	const payload = createDragPayload(
		type,
		attrs,
		source?.editorId,
		source?.position,
		source?.dragId,
	)

	event.dataTransfer.effectAllowed = source ? "move" : "copy"
	event.dataTransfer.setData(MAGIC_NODE_DRAG_MIME, JSON.stringify(payload))
	if (typeof document !== "undefined") {
		const transparentImage = document.createElement("div")
		transparentImage.setAttribute("aria-hidden", "true")
		transparentImage.style.width = "2px"
		transparentImage.style.height = "2px"
		transparentImage.style.position = "fixed"
		transparentImage.style.left = "0"
		transparentImage.style.top = "0"
		transparentImage.style.background = "transparent"
		transparentImage.style.border = "0"
		transparentImage.style.opacity = "0"
		transparentImage.style.overflow = "hidden"
		transparentImage.style.pointerEvents = "none"
		document.body.appendChild(transparentImage)
		activeNativeDragImage = transparentImage
		if (typeof event.dataTransfer.setDragImage === "function") {
			event.dataTransfer.setDragImage(transparentImage, 0, 0)
		}
		createDragPreview(payload.text, previewElement)
		hideNativeDragCursor()
		updateDragPreviewPosition(event)
	}
	return true
}

/** History copies drop live screenshot bindings; editor moves keep them. */
export function resolveDroppedNodeAttrs(
	type: string,
	attrs: Record<string, unknown>,
	isCopy: boolean,
): Record<string, unknown> {
	if (type !== INSPECTOR_DETAIL_TYPE || !isCopy) return attrs
	return sanitizeCopiedInspectorDetailAttrs(attrs)
}

const editorViews = new Map<string, EditorView>()
const editorDragOptions = new WeakMap<EditorView, MagicNodeDragOptions>()
const activeDragSources = new Map<string, MagicNodeDragSource>()
let activeDragPreview: HTMLElement | null = null
let activeNativeDragImage: HTMLElement | null = null
let dragPreviewListenersInstalled = false
let nativeDragCursorStyle: HTMLStyleElement | null = null
let pointerDragListenersInstalled = false
let removePointerDragListeners: (() => void) | null = null
let pointerDragSession: MagicNodePointerDragSession | null = null
let suppressClickTarget: HTMLElement | null = null
let promoteWaitTimer: ReturnType<typeof setTimeout> | null = null

function cancelPromoteWait() {
	if (promoteWaitTimer === null) return
	clearTimeout(promoteWaitTimer)
	promoteWaitTimer = null
}

export function isMagicNodeDragInProgress() {
	if (pointerDragSession) return true
	if (typeof document === "undefined") return false
	const root = document.documentElement
	return (
		root.classList.contains(MAGIC_NODE_POINTER_PENDING_CLASS) ||
		root.classList.contains(MAGIC_NODE_DRAGGING_CLASS)
	)
}

export function shouldSuppressNativeDrag(event: DragEvent) {
	// Promote an active pointer drag instead of cancelling the stolen
	// native dragstart, even when it originates on the node itself.
	if (pointerDragSession?.active) return false
	const target = (event.target as Element | null)?.closest?.("[data-magic-editor-node]")
	return Boolean(target) || isMagicNodeDragInProgress()
}

function createEditorId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID()
	}
	return `magic-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getDragText(type: string, attrs: Record<string, unknown>) {
	if (type === "mention") {
		const data = (attrs.data ?? {}) as Record<string, unknown>
		const name = data.name ?? data.file_name ?? data.title ?? data.label ?? ""
		return `@${String(name)}`
	}

	if (type === "inspector-detail") {
		return attrs.selector ? `selector: ${String(attrs.selector)}` : "[Element Inspector Detail]"
	}

	return ""
}

function clearDragPreview() {
	activeDragPreview?.remove()
	activeDragPreview = null
	activeNativeDragImage?.remove()
	activeNativeDragImage = null
	if (typeof document !== "undefined") {
		document.documentElement.classList.remove(MAGIC_NODE_DRAGGING_CLASS)
	}
}

function clearDragSources() {
	activeDragSources.clear()
}

function clearPointerDragSession() {
	cancelPromoteWait()
	if (pointerDragSession?.payload.sourceDragId) {
		activeDragSources.delete(pointerDragSession.payload.sourceDragId)
	}
	clearAllDropCursors()
	clearDragPreview()
	if (typeof document !== "undefined") {
		document.documentElement.classList.remove(MAGIC_NODE_POINTER_PENDING_CLASS)
	}
	pointerDragSession = null
}

function clearAllDropCursors() {
	for (const view of editorViews.values()) {
		// Pointer drag does not emit the native dragend event, so explicitly tell
		// every editor to remove its落位 marker before clearing the preview.
		view.dom.dispatchEvent(
			new CustomEvent("magic-node-pointer-dragover", {
				detail: null,
			}),
		)
	}
}

function hideNativeDragCursor() {
	if (typeof document === "undefined") return
	ensurePointerDragStyle()
	document.documentElement.classList.add(MAGIC_NODE_DRAGGING_CLASS)
}

function ensurePointerDragStyle() {
	if (typeof document === "undefined" || nativeDragCursorStyle) return
	nativeDragCursorStyle = document.createElement("style")
	nativeDragCursorStyle.textContent =
		`html.${MAGIC_NODE_DRAGGING_CLASS}, html.${MAGIC_NODE_DRAGGING_CLASS} * { cursor: none !important; }` +
		`html.${MAGIC_NODE_POINTER_PENDING_CLASS}, html.${MAGIC_NODE_POINTER_PENDING_CLASS} * { user-select: none !important; }`
	document.head.appendChild(nativeDragCursorStyle)
}

function updateDragPreviewPosition(event: Pick<MouseEvent, "clientX" | "clientY">) {
	if (!activeDragPreview) return
	if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return

	const gap = 12
	const rect = activeDragPreview.getBoundingClientRect()
	const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0
	const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0
	const preferredLeft = event.clientX + gap
	const preferredTop = event.clientY + gap
	const left =
		viewportWidth > 0 && rect.width > 0 && preferredLeft + rect.width > viewportWidth - 8
			? event.clientX - rect.width - gap
			: preferredLeft
	const top =
		viewportHeight > 0 && rect.height > 0 && preferredTop + rect.height > viewportHeight - 8
			? event.clientY - rect.height - gap
			: preferredTop

	activeDragPreview.style.setProperty("left", `${Math.max(8, left)}px`, "important")
	activeDragPreview.style.setProperty("top", `${Math.max(8, top)}px`, "important")
}

function getPointerDragTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return null
	const element = target.closest<HTMLElement>("[data-magic-editor-node]")
	if (!element) return null

	for (const view of editorViews.values()) {
		if (view.dom.contains(element)) {
			const dragged = findDraggedNode(view, element)
			if (dragged) {
				return {
					payload: createDragPayload(
						dragged.node.type.name,
						dragged.node.attrs,
						undefined,
						dragged.position,
					),
					sourceView: view,
					sourceElement: dragged.element,
				}
			}
		}
	}

	const type = element.dataset.magicNodeType
	const rawAttrs = element.dataset.magicNodeAttrs
	if (!type || !rawAttrs) return null
	try {
		return {
			payload: createDragPayload(type, JSON.parse(rawAttrs)),
			sourceElement: element,
		}
	} catch {
		return null
	}
}

function createDragPayload(
	type: string,
	attrs: Record<string, unknown>,
	sourceEditorId?: string,
	sourcePosition?: number,
	sourceDragId?: string,
): MagicNodeDragPayload {
	return {
		version: MAGIC_NODE_DRAG_VERSION,
		node: { type, attrs },
		sourceEditorId,
		sourcePosition,
		sourceDragId,
		text: getDragText(type, attrs),
	}
}

function getEmptyDocumentStart(doc: ProseMirrorNode): number | null {
	const firstChild = doc.firstChild
	// Atom nodes and explicit line breaks are content, even without textContent.
	if (doc.childCount !== 1 || !firstChild?.isTextblock || firstChild.content.size !== 0) {
		return null
	}
	return TextSelection.atStart(doc).from
}

function getDropPosition(view: EditorView, clientX: number, clientY: number): number | null {
	if (view.isDestroyed || !view.editable) return null
	const rect = view.dom.getBoundingClientRect()
	if (
		clientX < rect.left ||
		clientX > rect.right ||
		clientY < rect.top ||
		clientY > rect.bottom
	) {
		return null
	}
	// Wrapped placeholder lines do not introduce additional insertion positions.
	return (
		getEmptyDocumentStart(view.state.doc) ??
		view.posAtCoords({ left: clientX, top: clientY })?.pos ??
		null
	)
}

function findDropTarget(clientX: number, clientY: number): MagicNodeDropTarget | null {
	for (const view of editorViews.values()) {
		const position = getDropPosition(view, clientX, clientY)
		if (position !== null) return { view, position }
	}
	return null
}

function nodeMatchesDragSnapshot(node: ProseMirrorNode, payload: MagicNodeDragPayload) {
	if (node.type.name !== payload.node.type) return false
	try {
		// The live DOM identity narrows where to look, but the complete attrs
		// snapshot still has to match before a node can be deleted as the source.
		return JSON.stringify(node.attrs) === JSON.stringify(payload.node.attrs)
	} catch {
		return false
	}
}

function resolveSourceNode(
	view: EditorView,
	payload: MagicNodeDragPayload,
	registeredSource?: MagicNodeDragSource,
) {
	const candidates: number[] = []
	if (registeredSource?.view === view) {
		try {
			candidates.push(view.posAtDOM(registeredSource.element, 0))
		} catch {
			// The source NodeView may have been recreated during the drag.
		}
	}
	// A position is only a compatibility fallback for old payloads. New drags
	// carry a sourceDragId and must resolve through the live DOM identity or a
	// unique snapshot match instead of trusting the stale captured position.
	if (!payload.sourceDragId && payload.sourcePosition !== undefined) {
		candidates.push(payload.sourcePosition)
	}

	for (const position of candidates) {
		const node = view.state.doc.nodeAt(position)
		if (node && nodeMatchesDragSnapshot(node, payload)) return { view, node, position }
	}

	const matches: Array<{ node: ProseMirrorNode; position: number }> = []
	view.state.doc.descendants((node, position) => {
		if (nodeMatchesDragSnapshot(node, payload)) matches.push({ node, position })
		return matches.length < 2
	})
	return matches.length === 1 ? { view, ...matches[0] } : null
}

function updateDropCursorAtPosition(dropCursor: HTMLElement, view: EditorView, position: number) {
	dropCursor.hidden = true
	if (view.isDestroyed || !view.editable) return
	const $position = view.state.doc.resolve(position)
	const block = $position.parent.isTextblock ? view.nodeDOM($position.before()) : view.dom
	if (!(block instanceof HTMLElement) || !block.offsetWidth || !block.offsetHeight) return

	const rect = block.getBoundingClientRect()
	if (rect.width <= 0 || rect.height <= 0) return
	const style = window.getComputedStyle(block)
	// The marker uses viewport coordinates, including any scale on the editor.
	const scaleX = rect.width / block.offsetWidth
	const scaleY = rect.height / block.offsetHeight
	const fontSize = Number.parseFloat(style.fontSize)
	const lineHeight = (Number.parseFloat(style.lineHeight) || fontSize) * scaleY
	let left: number
	let top: number
	let height: number

	if (getEmptyDocumentStart(view.state.doc) !== null) {
		// A wrapped placeholder can displace the empty paragraph's BR rectangle.
		// Anchor to the first content line, not that BR or the placeholder's height.
		height = Math.min(fontSize * scaleY, lineHeight)
		left =
			style.direction === "rtl"
				? rect.right -
					(Number.parseFloat(style.borderRightWidth) +
						Number.parseFloat(style.paddingRight)) *
						scaleX
				: rect.left +
					(Number.parseFloat(style.borderLeftWidth) +
						Number.parseFloat(style.paddingLeft)) *
						scaleX
		top =
			rect.top +
			(Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop)) *
				scaleY +
			(lineHeight - height) / 2
	} else {
		const caret = view.coordsAtPos(position)
		const caretHeight = caret.bottom - caret.top
		height = Math.min(caretHeight, lineHeight)
		left = Math.min(caret.left, caret.right)
		top = caret.top + (caretHeight - height) / 2
	}
	if (height <= 0 || ![left, top, height].every(Number.isFinite)) return

	// The marker is mounted on body, so use concrete colors instead of editor theme variables.
	dropCursor.style.background = style.caretColor === "auto" ? style.color : style.caretColor
	dropCursor.style.left = `${left}px`
	dropCursor.style.top = `${top}px`
	dropCursor.style.height = `${height}px`
	dropCursor.hidden = false
}

function applyNodeDrop(
	target: MagicNodeDropTarget,
	payload: MagicNodeDragPayload,
	preparedMention?: TiptapMentionAttributes,
) {
	const { view, position } = target
	if (view.isDestroyed || !view.editable) return false
	const nodeType = view.state.schema.nodes[payload.node.type]
	if (!nodeType) return false

	const sourceView = payload.sourceEditorId ? editorViews.get(payload.sourceEditorId) : undefined
	const sourceSource = payload.sourceDragId
		? activeDragSources.get(payload.sourceDragId)
		: undefined
	const resolvedSource = sourceView ? resolveSourceNode(sourceView, payload, sourceSource) : null
	if (payload.sourceEditorId && (!sourceView || !resolvedSource)) return false
	const isSameEditor = resolvedSource?.view === view
	const sourceNode = resolvedSource?.node
	const sourcePosition = resolvedSource?.position
	const prepareMention = editorDragOptions.get(view)?.prepareCopiedMention
	if (
		!preparedMention &&
		payload.node.type === "mention" &&
		!payload.sourceEditorId &&
		prepareMention
	) {
		const result = (() => {
			try {
				return prepareMention(
					resolveDroppedNodeAttrs(payload.node.type, payload.node.attrs, true),
				)
			} catch {
				return null
			}
		})()
		if (result instanceof Promise) {
			const originalDoc = view.state.doc
			void result
				.then((attrs) => {
					if (!attrs || view.isDestroyed || !originalDoc.eq(view.state.doc)) return
					applyNodeDrop(target, payload, attrs)
				})
				.catch((error: unknown) => {
					console.warn("File reference drop could not be resolved", error)
				})
			return true
		}
		if (!result) return false
		preparedMention = result
	}

	const node = (() => {
		try {
			if (preparedMention) return nodeType.create(preparedMention)
			const attrs = resolveDroppedNodeAttrs(
				payload.node.type,
				payload.node.attrs,
				!payload.sourceEditorId,
			)
			return nodeType.create(attrs)
		} catch {
			return null
		}
	})()
	if (!node) return false
	if (
		isSameEditor &&
		sourceNode?.type.name === node.type.name &&
		sourcePosition !== undefined &&
		sourcePosition <= position &&
		position <= sourcePosition + sourceNode.nodeSize
	) {
		return true
	}

	let tr = view.state.tr
	let insertPosition = position
	if (isSameEditor && sourceNode && sourcePosition !== undefined) {
		tr = tr.delete(sourcePosition, sourcePosition + sourceNode.nodeSize)
		insertPosition = tr.mapping.map(insertPosition)
	}

	try {
		tr = tr.replaceRangeWith(insertPosition, insertPosition, node)
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPosition + node.nodeSize)))
		view.dispatch(tr)
	} catch {
		return false
	}

	if (!isSameEditor && sourceView) {
		// The destination dispatch may synchronously trigger source-editor updates.
		// Resolve the source again against its current document before deleting it.
		// If identity is no longer provable, keep the source and degrade to a copy.
		const currentSource = resolveSourceNode(sourceView, payload, sourceSource)
		if (currentSource) {
			try {
				sourceView.dispatch(
					sourceView.state.tr.delete(
						currentSource.position,
						currentSource.position + currentSource.node.nodeSize,
					),
				)
			} catch {
				// The target insert already succeeded; preserving the source avoids data loss.
			}
		}
	}

	// A cross-editor move can leave focus on the source editor. Focus the
	// destination after best-effort source cleanup so the caret remains usable.
	view.focus()
	return true
}

function installPointerDragListeners() {
	if (pointerDragListenersInstalled || typeof document === "undefined") return

	const handlePointerDown = (event: Event) => {
		const pointerEvent = event as PointerEvent
		// A new gesture must not inherit click suppression from a cancelled drag.
		suppressClickTarget = null
		// Touch keeps its existing scrolling and long-press selection behavior.
		if (pointerEvent.pointerType === "touch") return
		if (pointerEvent.button !== 0 || pointerDragSession) return
		const target = getPointerDragTarget(pointerEvent.target)
		if (!target) return
		const sourceEditorId = [...editorViews.entries()].find(
			([, view]) => view === target.sourceView,
		)?.[0]
		if (sourceEditorId && target.sourceView && target.payload.sourcePosition !== undefined) {
			target.payload.sourceEditorId = sourceEditorId
			target.payload.sourceDragId = createEditorId()
			activeDragSources.set(target.payload.sourceDragId, {
				view: target.sourceView,
				element: target.sourceElement,
			})
		}
		pointerDragSession = {
			...target,
			pointerId: pointerEvent.pointerId,
			startX: pointerEvent.clientX,
			startY: pointerEvent.clientY,
			active: false,
		}
		// Do not capture yet. Capturing on pointerdown retargets click away from
		// inner expand buttons and tooltip triggers.
		ensurePointerDragStyle()
		document.documentElement.classList.add(MAGIC_NODE_POINTER_PENDING_CLASS)
	}

	const releaseSessionPointerCapture = (
		session: MagicNodePointerDragSession,
		pointerId: number,
	) => {
		if (
			session.sourceElement.hasPointerCapture?.(pointerId) &&
			session.sourceElement.releasePointerCapture
		) {
			session.sourceElement.releasePointerCapture(pointerId)
		}
	}

	const promotePointerSessionToNativeDrag = (event: DragEvent) => {
		const session = pointerDragSession
		if (!session?.active) return false
		const { payload, sourceElement } = session
		const written = setMagicNodeDragData(
			event,
			payload.node.type,
			payload.node.attrs,
			payload.sourceEditorId && payload.sourcePosition !== undefined
				? {
						editorId: payload.sourceEditorId,
						position: payload.sourcePosition,
						dragId: payload.sourceDragId,
					}
				: undefined,
			sourceElement,
		)
		if (!written) return false
		// Keep the promoted native drag; only detach the pointer session.
		cancelPromoteWait()
		pointerDragSession = null
		if (typeof document !== "undefined") {
			document.documentElement.classList.remove(MAGIC_NODE_POINTER_PENDING_CLASS)
		}
		return true
	}

	const handlePointerMove = (event: Event) => {
		const pointerEvent = event as PointerEvent
		const session = pointerDragSession
		if (!session || session.pointerId !== pointerEvent.pointerId) return
		const movedX = pointerEvent.clientX - session.startX
		const movedY = pointerEvent.clientY - session.startY
		if (!session.active && Math.hypot(movedX, movedY) < POINTER_DRAG_THRESHOLD) return

		if (!session.active) {
			session.active = true
			if (typeof session.sourceElement.setPointerCapture === "function") {
				try {
					session.sourceElement.setPointerCapture(pointerEvent.pointerId)
				} catch {
					// The pointer may already have been released.
				}
			}
			createDragPreview(session.payload.text, session.sourceElement)
			hideNativeDragCursor()
			window.getSelection()?.removeAllRanges()
		}
		// Only suppress browser text-selection after this is a real drag.
		pointerEvent.preventDefault()
		updateDragPreviewPosition(pointerEvent)
		const target = findDropTarget(pointerEvent.clientX, pointerEvent.clientY)
		for (const view of editorViews.values()) {
			view.dom.dispatchEvent(
				new CustomEvent("magic-node-pointer-dragover", {
					detail: target?.view === view ? target.position : null,
				}),
			)
		}
	}

	const finishPointerDrag = (event: Event) => {
		const pointerEvent = event as PointerEvent
		const session = pointerDragSession
		if (!session || session.pointerId !== pointerEvent.pointerId) return
		if (session.active) {
			pointerEvent.preventDefault()
			const target = findDropTarget(pointerEvent.clientX, pointerEvent.clientY)
			if (target) applyNodeDrop(target, session.payload)
			// Pointer capture can still produce a click on the source node after a
			// successful drag. Suppress only that source click, not the next global
			// click, so unrelated controls remain interactive.
			suppressClickTarget = session.sourceElement
		}
		releaseSessionPointerCapture(session, pointerEvent.pointerId)
		clearPointerDragSession()
	}

	const handlePointerCancel = (event: Event) => {
		const pointerEvent = event as PointerEvent
		const session = pointerDragSession
		if (!session || session.pointerId !== pointerEvent.pointerId) return
		releaseSessionPointerCapture(session, pointerEvent.pointerId)
		if (!session.active) {
			clearPointerDragSession()
			return
		}
		// dragstart is the next event; a microtask would clear too early.
		cancelPromoteWait()
		promoteWaitTimer = setTimeout(() => {
			promoteWaitTimer = null
			if (pointerDragSession === session) clearPointerDragSession()
		}, 0)
	}

	const handleWindowBlur = () => {
		if (!pointerDragSession) return
		clearPointerDragSession()
	}
	const handleVisibilityChange = () => {
		if (document.visibilityState === "hidden") handleWindowBlur()
	}

	const handleDragStart = (event: Event) => {
		const dragEvent = event as DragEvent
		if (shouldSuppressNativeDrag(dragEvent)) {
			dragEvent.preventDefault()
			return
		}
		if (pointerDragSession?.active) promotePointerSessionToNativeDrag(dragEvent)
	}
	const handleClick = (event: Event) => {
		if (!suppressClickTarget) return
		const target = event.target
		if (!(target instanceof Node) || !suppressClickTarget.contains(target)) return
		suppressClickTarget = null
		event.preventDefault()
		event.stopPropagation()
	}

	document.addEventListener("pointerdown", handlePointerDown, true)
	document.addEventListener("pointermove", handlePointerMove, true)
	document.addEventListener("pointerup", finishPointerDrag, true)
	document.addEventListener("pointercancel", handlePointerCancel, true)
	window.addEventListener("blur", handleWindowBlur)
	document.addEventListener("visibilitychange", handleVisibilityChange)
	document.addEventListener("dragstart", handleDragStart, true)
	document.addEventListener("click", handleClick, true)
	pointerDragListenersInstalled = true
	removePointerDragListeners = () => {
		document.removeEventListener("pointerdown", handlePointerDown, true)
		document.removeEventListener("pointermove", handlePointerMove, true)
		document.removeEventListener("pointerup", finishPointerDrag, true)
		document.removeEventListener("pointercancel", handlePointerCancel, true)
		window.removeEventListener("blur", handleWindowBlur)
		document.removeEventListener("visibilitychange", handleVisibilityChange)
		document.removeEventListener("dragstart", handleDragStart, true)
		document.removeEventListener("click", handleClick, true)
		pointerDragListenersInstalled = false
		removePointerDragListeners = null
		clearPointerDragSession()
	}
}

function ensureDragPreviewListeners() {
	if (dragPreviewListenersInstalled || typeof document === "undefined") return
	const handleDragOver = (event: Event) => {
		const dragEvent = event as DragEvent
		if (!dragEvent.dataTransfer?.types.includes(MAGIC_NODE_DRAG_MIME)) return
		updateDragPreviewPosition(dragEvent)
	}
	document.addEventListener("dragover", handleDragOver, true)
	window.addEventListener("dragover", handleDragOver, true)
	document.addEventListener("drag", handleDragOver, true)
	document.addEventListener(
		"drop",
		() => {
			clearAllDropCursors()
			clearDragPreview()
			// The editor's drop handler runs later in this event dispatch. Keep the
			// source identity available until it has finished resolving the live node.
			queueMicrotask(clearDragSources)
		},
		true,
	)
	document.addEventListener(
		"dragend",
		() => {
			clearAllDropCursors()
			clearDragPreview()
			clearDragSources()
		},
		true,
	)
	dragPreviewListenersInstalled = true
}

const DRAG_PREVIEW_MAX_WIDTH = 360
const DRAG_PREVIEW_MAX_HEIGHT = 260

function copyComputedStyles(source: Element, target: Element) {
	if (typeof window === "undefined") return

	const computedStyle = window.getComputedStyle(source)
	for (let index = 0; index < computedStyle.length; index += 1) {
		const property = computedStyle.item(index)
		if (target instanceof HTMLElement || target instanceof SVGElement) {
			target.style.setProperty(
				property,
				computedStyle.getPropertyValue(property),
				computedStyle.getPropertyPriority(property),
			)
		}
	}

	const sourceChildren = Array.from(source.children)
	const targetChildren = Array.from(target.children)
	sourceChildren.forEach((child, index) => {
		const targetChild = targetChildren[index]
		if (targetChild) copyComputedStyles(child, targetChild)
	})
}

function prepareDragPreview(source: HTMLElement) {
	const preview = source.cloneNode(true) as HTMLElement
	copyComputedStyles(source, preview)
	preview
		.querySelectorAll<Element>(
			"[draggable], [contenteditable], [data-magic-editor-node], [data-testid], [data-drag-preview-hidden], [data-drag-preview-icon]",
		)
		.forEach((element) => {
			if (element.hasAttribute("data-drag-preview-hidden")) {
				element.remove()
				return
			}
			element.removeAttribute("draggable")
			element.removeAttribute("contenteditable")
			element.removeAttribute("data-magic-editor-node")
			element.removeAttribute("data-testid")
			// Keep the semantic icon in the preview, but remove the marker used
			// only to distinguish it from elements that should be omitted.
			element.removeAttribute("data-drag-preview-icon")
			element.removeAttribute("data-drag-preview-hidden")
		})
	preview.removeAttribute("draggable")
	preview.removeAttribute("contenteditable")
	preview.removeAttribute("data-magic-editor-node")
	preview.removeAttribute("data-testid")

	const sourceRect = source.getBoundingClientRect()
	const width = Math.min(sourceRect.width, DRAG_PREVIEW_MAX_WIDTH)
	if (width > 0) preview.style.width = `${width}px`

	preview.style.setProperty("position", "fixed", "important")
	preview.style.setProperty("left", "12px", "important")
	preview.style.setProperty("top", "12px", "important")
	// The source node can be transparent. The detached preview needs its own
	// opaque surface so editor text never shows through while dragging.
	preview.style.setProperty("background-color", "#fff", "important")
	preview.style.maxWidth = `min(${DRAG_PREVIEW_MAX_WIDTH}px, calc(100vw - 24px))`
	preview.style.maxHeight = `min(${DRAG_PREVIEW_MAX_HEIGHT}px, calc(100vh - 24px))`
	preview.style.margin = "0"
	preview.style.overflow = "hidden"
	preview.style.pointerEvents = "none"
	preview.style.opacity = "0.96"
	preview.style.boxShadow = "0 2px 8px rgb(0 0 0 / 0.18)"
	preview.style.zIndex = "2147483647"
	preview.setAttribute("aria-hidden", "true")

	return preview
}

function createDragPreview(text: string, source?: HTMLElement | null) {
	if (typeof document === "undefined") return
	clearDragPreview()
	const preview = source ? prepareDragPreview(source) : document.createElement("span")
	if (!source) {
		preview.textContent = text || "节点"
		preview.style.setProperty("position", "fixed", "important")
		preview.style.setProperty("left", "12px", "important")
		preview.style.setProperty("top", "12px", "important")
		preview.style.maxWidth = "220px"
		preview.style.padding = "3px 7px"
		preview.style.border = "1px solid #000"
		preview.style.borderRadius = "6px"
		preview.style.background = "rgb(255 255 255 / 0.94)"
		preview.style.color = "#000"
		preview.style.fontSize = "12px"
		preview.style.lineHeight = "18px"
		preview.style.whiteSpace = "nowrap"
		preview.style.overflow = "hidden"
		preview.style.textOverflow = "ellipsis"
		preview.style.pointerEvents = "none"
		preview.style.zIndex = "2147483647"
	}
	document.body.appendChild(preview)
	activeDragPreview = preview
	ensureDragPreviewListeners()
}

function readPayload(event: DragEvent): MagicNodeDragPayload | null {
	const raw = event.dataTransfer?.getData(MAGIC_NODE_DRAG_MIME)
	if (!raw) return null

	try {
		const payload = JSON.parse(raw) as MagicNodeDragPayload
		if (
			payload.version !== MAGIC_NODE_DRAG_VERSION ||
			!payload.node?.type ||
			!payload.node.attrs ||
			(payload.sourceEditorId && !Number.isInteger(payload.sourcePosition)) ||
			(!payload.sourceEditorId && payload.sourcePosition !== undefined)
		) {
			return null
		}
		return payload
	} catch {
		return null
	}
}

function writeDragData(view: EditorView, editorId: string, event: DragEvent) {
	if (!event.dataTransfer) return false
	const dragged = findDraggedNode(view, event.target)
	if (!dragged) return false

	const dragId = createEditorId()
	const written = setMagicNodeDragData(
		event,
		dragged.node.type.name,
		dragged.node.attrs,
		{
			editorId,
			position: dragged.position,
			dragId,
		},
		dragged.element,
	)
	if (written) activeDragSources.set(dragId, { view, element: dragged.element })
	return written
}

function findDraggedNode(view: EditorView, target: EventTarget | null) {
	if (view.isDestroyed || !view.editable) return null
	if (!(target instanceof Element)) return null
	const element = target.closest<HTMLElement>("[data-magic-editor-node]")
	if (!element) return null

	try {
		const position = view.posAtDOM(element, 0)
		const node = view.state.doc.nodeAt(position)
		if (!node || (node.type.name !== "mention" && node.type.name !== "inspector-detail")) {
			return null
		}
		return { node, position, element }
	} catch {
		return null
	}
}

export function createMagicNodeDragPlugin(options: MagicNodeDragOptions = {}) {
	return new Plugin({
		key: nodeDragPluginKey,
		view(view) {
			installPointerDragListeners()
			const editorId = createEditorId()
			const dropCursor = document.createElement("span")
			dropCursor.className = DROP_CURSOR_CLASS
			dropCursor.setAttribute("aria-hidden", "true")
			dropCursor.hidden = true
			dropCursor.style.position = "fixed"
			dropCursor.style.width = "1px"
			dropCursor.style.borderRadius = "999px"
			dropCursor.style.pointerEvents = "none"
			dropCursor.style.zIndex = "2147483647"
			document.body.appendChild(dropCursor)

			const hideDropCursor = () => {
				dropCursor.hidden = true
			}
			const updateDropCursor = (event: DragEvent) => {
				if (view.isDestroyed || !view.editable) return false
				if (!event.dataTransfer?.types.includes(MAGIC_NODE_DRAG_MIME)) return false
				const position = getDropPosition(view, event.clientX, event.clientY)
				if (position === null) {
					hideDropCursor()
					return false
				}

				updateDropCursorAtPosition(dropCursor, view, position)
				return true
			}
			const handleDragOver = (event: Event) => {
				if (!updateDropCursor(event as DragEvent)) return
				event.preventDefault()
			}
			const handleDragLeave = (event: Event) => {
				const dragEvent = event as DragEvent
				if (
					dragEvent.relatedTarget instanceof Node &&
					view.dom.contains(dragEvent.relatedTarget)
				) {
					return
				}
				hideDropCursor()
			}
			const handlePointerDragOver = (event: Event) => {
				const position = (event as CustomEvent<number | null>).detail
				if (position === null) {
					hideDropCursor()
					return
				}
				updateDropCursorAtPosition(dropCursor, view, position)
			}
			const handleDrop = () => hideDropCursor()
			const handleDragEnd = () => hideDropCursor()
			view.dom.addEventListener("dragover", handleDragOver, true)
			view.dom.addEventListener("dragleave", handleDragLeave, true)
			view.dom.addEventListener("drop", handleDrop, true)
			view.dom.addEventListener("dragend", handleDragEnd, true)
			view.dom.addEventListener("magic-node-pointer-dragover", handlePointerDragOver)
			const handleDragStart = (event: Event) => {
				// Capture before React's parent upload handlers so node drags are
				// identified before the upload overlay sees dragenter/dragover.
				writeDragData(view, editorId, event as DragEvent)
			}
			view.dom.addEventListener("dragstart", handleDragStart, true)
			editorViews.set(editorId, view)
			editorDragOptions.set(view, options)

			return {
				destroy() {
					hideDropCursor()
					dropCursor.remove()
					view.dom.removeEventListener("dragover", handleDragOver, true)
					view.dom.removeEventListener("dragleave", handleDragLeave, true)
					view.dom.removeEventListener("drop", handleDrop, true)
					view.dom.removeEventListener("dragend", handleDragEnd, true)
					view.dom.removeEventListener(
						"magic-node-pointer-dragover",
						handlePointerDragOver,
					)
					view.dom.removeEventListener("dragstart", handleDragStart, true)
					editorViews.delete(editorId)
					editorDragOptions.delete(view)
					for (const [dragId, source] of activeDragSources) {
						if (source.view === view) activeDragSources.delete(dragId)
					}
					if (editorViews.size === 0) removePointerDragListeners?.()
				},
			}
		},
		props: {
			handleDOMEvents: {
				dragstart(view, event) {
					writeDragData(
						view,
						[...editorViews.entries()].find(([, item]) => item === view)?.[0] ?? "",
						event,
					)
					return false
				},
				dragover(view, event) {
					if (view.isDestroyed || !view.editable) return false
					if (!event.dataTransfer?.types.includes(MAGIC_NODE_DRAG_MIME)) return false
					event.preventDefault()
					// History sources only allow copying, so requesting a move rejects the drop.
					event.dataTransfer.dropEffect =
						event.dataTransfer.effectAllowed === "copy" ? "copy" : "move"
					return true
				},
				drop(view, event) {
					if (!event.dataTransfer?.types.includes(MAGIC_NODE_DRAG_MIME)) return false
					// Rejected node copies must not fall through to native HTML/text insertion.
					event.preventDefault()
					if (view.isDestroyed || !view.editable) return true
					const payload = readPayload(event)
					if (!payload) return true

					const position = getDropPosition(view, event.clientX, event.clientY)
					if (position !== null) applyNodeDrop({ view, position }, payload)
					return true
				},
			},
		},
	})
}
