import { useCallback, useRef, useState, type RefObject } from "react"
import { Range as SlateRange, type BaseEditor, type BaseRange } from "slate"
import { ReactEditor } from "slate-react"

export interface VirtualSelectionRect {
	left: number
	top: number
	width: number
	height: number
}

interface UseVirtualTextSelectionOptions {
	editor: BaseEditor
	editableRef: RefObject<HTMLElement | null>
}

export function useVirtualTextSelection({ editor, editableRef }: UseVirtualTextSelectionOptions) {
	const latestSelectionRef = useRef<BaseRange | null>(null)
	const hasVirtualSelectionRef = useRef(false)
	const [virtualSelectionRects, setVirtualSelectionRects] = useState<VirtualSelectionRect[]>([])

	const updateVirtualSelectionRects = useCallback((rects: VirtualSelectionRect[]) => {
		hasVirtualSelectionRef.current = rects.length > 0
		setVirtualSelectionRects((previousRects) =>
			areVirtualSelectionRectsEqual(previousRects, rects) ? previousRects : rects,
		)
	}, [])

	const clearVirtualSelection = useCallback(() => {
		updateVirtualSelectionRects([])
	}, [updateVirtualSelectionRects])

	const captureSelection = useCallback((selection: BaseRange | null) => {
		latestSelectionRef.current = selection
	}, [])

	const refreshVirtualSelection = useCallback(() => {
		const editableElement = editableRef.current
		const selection = latestSelectionRef.current
		if (!editableElement || !selection) {
			clearVirtualSelection()
			return
		}

		const rects = getVirtualSelectionRects({
			editor,
			editableElement,
			selection,
		})
		updateVirtualSelectionRects(rects)
	}, [clearVirtualSelection, editableRef, editor, updateVirtualSelectionRects])

	const refreshVirtualSelectionIfVisible = useCallback(() => {
		if (hasVirtualSelectionRef.current) {
			refreshVirtualSelection()
		}
	}, [refreshVirtualSelection])

	return {
		virtualSelectionRects,
		captureSelection,
		clearVirtualSelection,
		refreshVirtualSelection,
		refreshVirtualSelectionIfVisible,
	}
}

function getVirtualSelectionRects({
	editor,
	editableElement,
	selection,
}: {
	editor: BaseEditor
	editableElement: HTMLElement
	selection: BaseRange
}): VirtualSelectionRect[] {
	if (SlateRange.isCollapsed(selection)) {
		return []
	}

	try {
		const domRange = ReactEditor.toDOMRange(editor as ReactEditor, selection)
		const editableRect = editableElement.getBoundingClientRect()
		// Store stable canvas-unit rects; rendering applies --canvas-scale in CSS.
		return Array.from(domRange.getClientRects())
			.filter((rect) => rect.width > 0 && rect.height > 0)
			.map((rect) => toLineHeightSelectionRect(rect, editableElement, editableRect))
			.map((rect) => toCanvasUnitRect(rect, getCurrentCanvasScale(editableElement)))
	} catch {
		return []
	}
}

function normalizeViewportScale(scale: number): number {
	return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function getCurrentCanvasScale(element: HTMLElement): number {
	const scale = Number.parseFloat(
		window.getComputedStyle(element).getPropertyValue("--canvas-scale"),
	)
	return normalizeViewportScale(scale)
}

function toCanvasUnitRect(rect: VirtualSelectionRect, viewportScale: number): VirtualSelectionRect {
	const scale = normalizeViewportScale(viewportScale)
	return {
		left: rect.left / scale,
		top: rect.top / scale,
		width: rect.width / scale,
		height: rect.height / scale,
	}
}

function toLineHeightSelectionRect(
	rect: DOMRect,
	editableElement: HTMLElement,
	editableRect: DOMRect,
): VirtualSelectionRect {
	// DOM Range rects track glyph bounds, while editor selection visually fills the line box.
	const lineHeight = getLineHeightAtRect(rect, editableElement)
	const height = Math.max(rect.height, lineHeight)
	const top = rect.top - (height - rect.height) / 2

	return {
		left: rect.left - editableRect.left,
		top: top - editableRect.top,
		width: rect.width,
		height,
	}
}

function getLineHeightAtRect(rect: DOMRect, editableElement: HTMLElement): number {
	const targetElement = getEditableElementFromPoint(
		rect.left + rect.width / 2,
		rect.top + rect.height / 2,
		editableElement,
	)
	return getResolvedLineHeight(targetElement ?? editableElement, editableElement) ?? rect.height
}

function getEditableElementFromPoint(
	x: number,
	y: number,
	editableElement: HTMLElement,
): HTMLElement | null {
	for (const element of document.elementsFromPoint(x, y)) {
		if (element instanceof HTMLElement && editableElement.contains(element)) {
			return element
		}
	}
	return null
}

function getResolvedLineHeight(element: HTMLElement, editableElement: HTMLElement): number | null {
	let currentElement: HTMLElement | null = element
	let normalLineHeight: number | null = null

	while (currentElement && editableElement.contains(currentElement)) {
		const style = window.getComputedStyle(currentElement)
		const fontSize = Number.parseFloat(style.fontSize)
		const lineHeight = Number.parseFloat(style.lineHeight)
		if (Number.isFinite(lineHeight) && lineHeight > 0) {
			return style.lineHeight.endsWith("px") || !Number.isFinite(fontSize)
				? lineHeight
				: lineHeight * fontSize
		}
		if (normalLineHeight === null && Number.isFinite(fontSize) && fontSize > 0) {
			normalLineHeight = fontSize * 1.2
		}
		currentElement = currentElement.parentElement
	}

	return normalLineHeight
}

function areVirtualSelectionRectsEqual(
	leftRects: VirtualSelectionRect[],
	rightRects: VirtualSelectionRect[],
): boolean {
	if (leftRects.length !== rightRects.length) {
		return false
	}

	return leftRects.every((leftRect, index) => {
		const rightRect = rightRects[index]
		return (
			Math.abs(leftRect.left - rightRect.left) < 0.5 &&
			Math.abs(leftRect.top - rightRect.top) < 0.5 &&
			Math.abs(leftRect.width - rightRect.width) < 0.5 &&
			Math.abs(leftRect.height - rightRect.height) < 0.5
		)
	})
}
