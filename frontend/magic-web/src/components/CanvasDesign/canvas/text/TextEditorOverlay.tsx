import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createEditor, type BaseEditor, type BaseRange, type Descendant } from "slate"
import {
	Editable,
	ReactEditor,
	Slate,
	useSlateStatic,
	withReact,
	type RenderElementProps,
	type RenderLeafProps,
} from "slate-react"
import { HistoryEditor, withHistory } from "slate-history"
import type { RichTextParagraph, TextStyle } from "../types"
import {
	DEFAULT_TEXT_LETTER_SPACING,
	DEFAULT_TEXT_LINE_HEIGHT,
	getRichTextListMarker,
	getResolvedTextDefaultStyle,
	mergeTextStyle,
	richTextParagraphsToSlateValue,
	toFontStyle,
	toFontWeight,
} from "./richText"
import type { CanvasSlateParagraph, CanvasSlateText } from "./richText"
import { getTextDecorationRects, type TextDecorationRect } from "./textDecorationGeometry"
import { cloneSlateRange } from "./TextEditorSelectionSession"
import { useVirtualTextSelection } from "./useVirtualTextSelection"
import styles from "./TextEditorOverlay.module.css"
import { isPreserveTextEditorFocusTarget } from "../../utils/preserveTextEditorFocus"

const TEXT_DECORATION_SOURCE_ATTRIBUTE = "data-text-decoration-source"

export interface TextEditorOverlayProps {
	content?: RichTextParagraph[]
	defaultStyle?: TextStyle
	initialSelectAll?: boolean
	initialCaretClientPoint?: { x: number; y: number }
	viewportScale?: number
	onChange?: (value: Descendant[]) => void
	onSelectionChange?: (selection: BaseRange | null) => void
	onLayoutChange?: (size: { width: number; height: number }) => void
	onEditorReady?: (editor: BaseEditor) => void
	onBlur?: (value: Descendant[]) => void
}

function Leaf({
	attributes,
	children,
	leaf,
	defaultStyle,
}: RenderLeafProps & { defaultStyle?: TextStyle }) {
	const richLeaf = leaf as CanvasSlateText
	const mergedStyle = mergeTextStyle(defaultStyle, richLeaf.style)
	const hasDecoration = Boolean(mergedStyle.underline || mergedStyle.strikethrough)

	return (
		<span
			{...attributes}
			data-text-decoration-source={hasDecoration ? "true" : undefined}
			data-underline={mergedStyle.underline ? "true" : undefined}
			data-strikethrough={mergedStyle.strikethrough ? "true" : undefined}
			style={{
				fontSize: `calc(${mergedStyle.fontSize ?? 16}px * var(--canvas-scale, 1))`,
				fontFamily: mergedStyle.fontFamily || "sans-serif",
				color: mergedStyle.color || "#0a0a0a",
				fontWeight: toFontWeight(mergedStyle) ?? 400,
				fontStyle: toFontStyle(mergedStyle) || "normal",
				textDecoration: "none",
				letterSpacing: `calc(${
					mergedStyle.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING
				}px * var(--canvas-scale, 1))`,
				backgroundColor: mergedStyle.backgroundColor,
			}}
		>
			{children}
		</span>
	)
}

function Element({
	attributes,
	children,
	element,
	defaultStyle,
}: RenderElementProps & { defaultStyle?: TextStyle }) {
	const editor = useSlateStatic()
	const paragraph = element as CanvasSlateParagraph
	const firstLeafStyle = paragraph.children[0]?.style
	const markerStyle = mergeTextStyle(defaultStyle, firstLeafStyle)
	const paragraphIndex = ReactEditor.findPath(editor as ReactEditor, paragraph)[0] ?? 0
	const orderedListIndex =
		paragraph.listType === "ordered"
			? editor.children
					.slice(0, paragraphIndex + 1)
					.filter((node) => (node as CanvasSlateParagraph).listType === "ordered")
					.length - 1
			: paragraphIndex
	const listMarker = getRichTextListMarker(paragraph.listType, orderedListIndex)
	return (
		<div
			{...attributes}
			className={styles.paragraph}
			style={{
				textAlign: paragraph.align || "left",
				lineHeight: `${paragraph.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT}`,
				marginBottom: paragraph.paragraphSpacing
					? `calc(${paragraph.paragraphSpacing}px * var(--canvas-scale, 1))`
					: undefined,
			}}
		>
			{listMarker ? (
				<span
					contentEditable={false}
					className={styles.listMarker}
					style={{
						fontSize: `calc(${markerStyle.fontSize ?? 16}px * var(--canvas-scale, 1))`,
						fontFamily: markerStyle.fontFamily || "sans-serif",
						color: markerStyle.color || "#0a0a0a",
						fontWeight: toFontWeight(markerStyle) ?? 400,
						fontStyle: toFontStyle(markerStyle) || "normal",
						letterSpacing: `calc(${
							markerStyle.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING
						}px * var(--canvas-scale, 1))`,
						textDecoration: "none",
					}}
				>
					{listMarker}
				</span>
			) : null}
			{children}
		</div>
	)
}

export function TextEditorOverlay({
	content,
	defaultStyle,
	initialSelectAll = false,
	initialCaretClientPoint,
	viewportScale = 1,
	onChange,
	onSelectionChange,
	onLayoutChange,
	onEditorReady,
	onBlur,
}: TextEditorOverlayProps) {
	const editor = useMemo(() => withHistory(withReact(createEditor())), [])
	const editableRef = useRef<HTMLDivElement | null>(null)
	const focusFrameRef = useRef<number | null>(null)
	const decorationFrameRef = useRef<number | null>(null)
	const lastEmittedCanvasLayoutRef = useRef<{ width: number; height: number } | null>(null)
	const [textDecorationRects, setTextDecorationRects] = useState<TextDecorationRect[]>([])
	const resolvedDefaultStyle = useMemo(
		() => getResolvedTextDefaultStyle(defaultStyle),
		[defaultStyle],
	)
	// 不要在 Slate 的 blur / keydown 回调里同步卸载 Editable，否则它后续的 selection -> DOM 映射会命中已移除节点并抛错。
	const pendingActionFrameRef = useRef<number | null>(null)
	const isMountedRef = useRef(true)
	const preserveNextBlurRef = useRef(false)
	const latestValueRef = useRef<Descendant[]>(
		richTextParagraphsToSlateValue(content, resolvedDefaultStyle),
	)
	const initialValue = useMemo(
		() => richTextParagraphsToSlateValue(content, resolvedDefaultStyle),
		[content, resolvedDefaultStyle],
	)
	const {
		virtualSelectionRects,
		captureSelection,
		clearVirtualSelection,
		refreshVirtualSelection,
		refreshVirtualSelectionIfVisible,
	} = useVirtualTextSelection({
		editor,
		editableRef,
	})

	useEffect(() => {
		latestValueRef.current = initialValue
	}, [initialValue])

	useEffect(() => {
		focusFrameRef.current = requestAnimationFrame(() => {
			editableRef.current?.focus()
			if (!editableRef.current) {
				return
			}

			const selection = window.getSelection()
			if (!selection) {
				return
			}

			if (initialSelectAll) {
				const range = document.createRange()
				range.selectNodeContents(editableRef.current)
				selection.removeAllRanges()
				selection.addRange(range)
				return
			}

			const range =
				getCaretRangeFromPoint(initialCaretClientPoint?.x, initialCaretClientPoint?.y) ??
				document.createRange()
			if (!range.startContainer.isConnected) {
				range.selectNodeContents(editableRef.current)
				range.collapse(false)
			}
			if (!editableRef.current.contains(range.startContainer)) {
				range.selectNodeContents(editableRef.current)
				range.collapse(false)
			}
			selection.removeAllRanges()
			selection.addRange(range)
		})

		return () => {
			if (focusFrameRef.current !== null) {
				cancelAnimationFrame(focusFrameRef.current)
				focusFrameRef.current = null
			}
		}
	}, [initialCaretClientPoint, initialSelectAll])

	useEffect(() => {
		const handlePointerDownCapture = (event: PointerEvent) => {
			preserveNextBlurRef.current = isPreserveTextEditorFocusTarget(event.target)
		}

		document.addEventListener("pointerdown", handlePointerDownCapture, true)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDownCapture, true)
		}
	}, [])

	useEffect(() => {
		return () => {
			isMountedRef.current = false
			if (focusFrameRef.current !== null) {
				cancelAnimationFrame(focusFrameRef.current)
			}
			// 卸载时清理挂起的提交动作，避免下一帧再触发外层关闭逻辑。
			if (pendingActionFrameRef.current !== null) {
				cancelAnimationFrame(pendingActionFrameRef.current)
			}
			if (decorationFrameRef.current !== null) {
				cancelAnimationFrame(decorationFrameRef.current)
			}
		}
	}, [])

	const scheduleCommit = () => {
		if (pendingActionFrameRef.current !== null) {
			cancelAnimationFrame(pendingActionFrameRef.current)
		}
		pendingActionFrameRef.current = requestAnimationFrame(() => {
			pendingActionFrameRef.current = null
			if (!isMountedRef.current) {
				return
			}
			onBlur?.(latestValueRef.current)
		})
	}

	const refreshTextDecorations = useCallback(() => {
		const editableElement = editableRef.current
		if (!editableElement) {
			setTextDecorationRects([])
			return
		}

		const currentViewportScale = getCurrentCanvasScale(editableElement, 1)
		const editableRect = editableElement.getBoundingClientRect()
		const sourceElements = Array.from(
			editableElement.querySelectorAll<HTMLElement>(
				`[${TEXT_DECORATION_SOURCE_ATTRIBUTE}="true"]`,
			),
		)
		const nextRects = sourceElements.flatMap((element) =>
			getElementTextDecorationRects(element, editableRect, currentViewportScale),
		)

		setTextDecorationRects((previousRects) =>
			areTextDecorationRectsEqual(previousRects, nextRects) ? previousRects : nextRects,
		)
	}, [])

	const scheduleTextDecorationRefresh = useCallback(() => {
		if (decorationFrameRef.current !== null) {
			cancelAnimationFrame(decorationFrameRef.current)
		}
		decorationFrameRef.current = requestAnimationFrame(() => {
			decorationFrameRef.current = null
			refreshTextDecorations()
		})
	}, [refreshTextDecorations])

	useEffect(() => {
		const nextSelection = cloneSlateRange(editor.selection)
		captureSelection(nextSelection)
		onEditorReady?.(editor)
		onSelectionChange?.(nextSelection)
	}, [captureSelection, editor, onEditorReady, onSelectionChange])

	useEffect(() => {
		const editableElement = editableRef.current
		if (!editableElement) {
			return
		}

		let frameId = 0
		const emitLayout = () => {
			if (frameId) {
				cancelAnimationFrame(frameId)
			}
			frameId = requestAnimationFrame(() => {
				frameId = 0
				const currentViewportScale = getCurrentCanvasScale(editableElement, viewportScale)
				const canvasLayout = {
					width: Math.round(editableElement.scrollWidth / currentViewportScale),
					height: Math.round(editableElement.scrollHeight / currentViewportScale),
				}
				const lastCanvasLayout = lastEmittedCanvasLayoutRef.current
				// Ignore scale-only ResizeObserver churn; the canvas element size is unchanged.
				if (
					lastCanvasLayout &&
					Math.abs(canvasLayout.width - lastCanvasLayout.width) <= 1 &&
					Math.abs(canvasLayout.height - lastCanvasLayout.height) <= 1
				) {
					return
				}
				lastEmittedCanvasLayoutRef.current = canvasLayout
				onLayoutChange?.({
					width: Math.max(editableElement.scrollWidth, 1),
					height: Math.max(editableElement.scrollHeight, 1),
				})
				scheduleTextDecorationRefresh()
			})
		}

		emitLayout()

		const resizeObserver = new ResizeObserver(() => {
			emitLayout()
			scheduleTextDecorationRefresh()
		})
		resizeObserver.observe(editableElement)

		const handleCompositionEvent = () => {
			emitLayout()
			scheduleTextDecorationRefresh()
		}
		editableElement.addEventListener("compositionstart", handleCompositionEvent)
		editableElement.addEventListener("compositionupdate", handleCompositionEvent)
		editableElement.addEventListener("compositionend", handleCompositionEvent)
		window.addEventListener("resize", handleCompositionEvent)

		return () => {
			if (frameId) {
				cancelAnimationFrame(frameId)
			}
			resizeObserver.disconnect()
			editableElement.removeEventListener("compositionstart", handleCompositionEvent)
			editableElement.removeEventListener("compositionupdate", handleCompositionEvent)
			editableElement.removeEventListener("compositionend", handleCompositionEvent)
			window.removeEventListener("resize", handleCompositionEvent)
		}
	}, [onLayoutChange, initialValue, scheduleTextDecorationRefresh, viewportScale])

	return (
		<div className={styles.root}>
			<Slate
				editor={editor}
				initialValue={initialValue}
				onChange={(value) => {
					latestValueRef.current = value
					scheduleTextDecorationRefresh()
					const nextSelection = cloneSlateRange(editor.selection)
					captureSelection(nextSelection)
					if (ReactEditor.isFocused(editor as ReactEditor)) {
						clearVirtualSelection()
					} else {
						refreshVirtualSelectionIfVisible()
					}
					onSelectionChange?.(nextSelection)
					onChange?.(value)
				}}
			>
				{virtualSelectionRects.length > 0 ? (
					<div className={styles.virtualSelectionOverlay} aria-hidden>
						{virtualSelectionRects.map((rect, index) => (
							<div
								key={`${index}-${rect.left}-${rect.top}-${rect.width}-${rect.height}`}
								className={styles.virtualSelectionRect}
								style={{
									// Keep selection and text on the same CSS scaling path during viewport zoom.
									left: `calc(${rect.left}px * var(--canvas-scale, 1))`,
									top: `calc(${rect.top}px * var(--canvas-scale, 1))`,
									width: `calc(${rect.width}px * var(--canvas-scale, 1))`,
									height: `calc(${rect.height}px * var(--canvas-scale, 1))`,
								}}
							/>
						))}
					</div>
				) : null}
				{textDecorationRects.length > 0 ? (
					<div className={styles.textDecorationOverlay} aria-hidden>
						{textDecorationRects.map((rect, index) => (
							<div
								key={`${index}-${rect.kind}-${rect.x}-${rect.y}-${rect.width}-${rect.height}`}
								className={styles.textDecorationRect}
								style={{
									left: `calc(${rect.x}px * var(--canvas-scale, 1))`,
									top: `calc(${rect.y}px * var(--canvas-scale, 1))`,
									width: `calc(${rect.width}px * var(--canvas-scale, 1))`,
									height: `calc(${rect.height}px * var(--canvas-scale, 1))`,
									backgroundColor: rect.color,
								}}
							/>
						))}
					</div>
				) : null}
				<Editable
					ref={editableRef}
					className={styles.editable}
					renderElement={(props) => (
						<Element {...props} defaultStyle={resolvedDefaultStyle} />
					)}
					renderLeaf={(props) => <Leaf {...props} defaultStyle={resolvedDefaultStyle} />}
					onFocus={clearVirtualSelection}
					onBlur={(event) => {
						const shouldPreserveEditing =
							preserveNextBlurRef.current ||
							isPreserveTextEditorFocusTarget(event.relatedTarget)
						preserveNextBlurRef.current = false
						if (shouldPreserveEditing) {
							refreshVirtualSelection()
							return
						}
						clearVirtualSelection()
						scheduleCommit()
					}}
					onKeyDown={(event) => {
						event.stopPropagation()
						if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
							event.preventDefault()
							if (event.shiftKey) {
								HistoryEditor.redo(editor)
								return
							}
							HistoryEditor.undo(editor)
							return
						}
						if (event.key === "Escape") {
							event.preventDefault()
							scheduleCommit()
						}
					}}
					style={{
						// Match the measurement paragraph strut so defaultStyle does not inflate small-font lines.
						fontSize: `calc(16px * var(--canvas-scale, 1))`,
						fontFamily: resolvedDefaultStyle.fontFamily || "sans-serif",
						color: resolvedDefaultStyle.color || "#0a0a0a",
						lineHeight: `${DEFAULT_TEXT_LINE_HEIGHT}`,
					}}
				/>
			</Slate>
		</div>
	)
}

function getCaretRangeFromPoint(x?: number, y?: number): Range | null {
	if (x === undefined || y === undefined) {
		return null
	}

	const documentWithCaret = document as Document & {
		caretPositionFromPoint?: (
			x: number,
			y: number,
		) => { offsetNode: Node; offset: number } | null
		caretRangeFromPoint?: (x: number, y: number) => Range | null
	}

	if (typeof documentWithCaret.caretPositionFromPoint === "function") {
		const caretPosition = documentWithCaret.caretPositionFromPoint(x, y)
		if (!caretPosition) {
			return null
		}
		const range = document.createRange()
		range.setStart(caretPosition.offsetNode, caretPosition.offset)
		range.collapse(true)
		return range
	}

	if (typeof documentWithCaret.caretRangeFromPoint === "function") {
		const range = documentWithCaret.caretRangeFromPoint(x, y)
		if (!range) {
			return null
		}
		range.collapse(true)
		return range
	}

	return null
}

function normalizeViewportScale(scale: number): number {
	return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function getCurrentCanvasScale(element: HTMLElement, fallbackScale: number): number {
	const scale = Number.parseFloat(
		window.getComputedStyle(element).getPropertyValue("--canvas-scale"),
	)
	return normalizeViewportScale(scale || fallbackScale)
}

function getElementTextDecorationRects(
	element: HTMLElement,
	editableRect: DOMRect,
	viewportScale: number,
): TextDecorationRect[] {
	const scale = normalizeViewportScale(viewportScale)
	const style = window.getComputedStyle(element)
	const fontSize = Number.parseFloat(style.fontSize)
	const canvasFontSize = Number.isFinite(fontSize) ? fontSize / scale : 16
	const underline = element.dataset.underline === "true"
	const strikethrough = element.dataset.strikethrough === "true"

	return Array.from(element.getClientRects()).flatMap((rect) =>
		getTextDecorationRects({
			x: (rect.left - editableRect.left) / scale,
			y: (rect.top - editableRect.top) / scale,
			width: rect.width / scale,
			height: rect.height / scale,
			fontSize: canvasFontSize,
			color: style.color || "#0a0a0a",
			underline,
			strikethrough,
		}),
	)
}

function areTextDecorationRectsEqual(
	leftRects: TextDecorationRect[],
	rightRects: TextDecorationRect[],
): boolean {
	if (leftRects.length !== rightRects.length) {
		return false
	}

	return leftRects.every((leftRect, index) => {
		const rightRect = rightRects[index]
		return (
			leftRect.kind === rightRect.kind &&
			leftRect.color === rightRect.color &&
			Math.abs(leftRect.x - rightRect.x) < 0.5 &&
			Math.abs(leftRect.y - rightRect.y) < 0.5 &&
			Math.abs(leftRect.width - rightRect.width) < 0.5 &&
			Math.abs(leftRect.height - rightRect.height) < 0.5
		)
	})
}
