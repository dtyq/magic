/**
 * ElementInspectorOverlay
 *
 * Renders a transparent overlay on top of the iframe that displays:
 * 1. A highlight box showing the hovered element's bounding rect
 * 2. A floating info card showing element details (tag, id, class, size)
 *
 * Coordinate translation: the iframe reports element rects relative to its
 * own viewport. This overlay converts them to container-relative positions
 * using the iframe's own bounding rect + optional scale ratio.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import type { JSONContent } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Crosshair, X, Copy, MousePointer, Send } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { SUPER_PLACEHOLDER_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/super-placeholder/const"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { InspectedElementInfo, InspectedElementRect } from "./types"

// ─── Props ───────────────────────────────────────────────────────────────────

interface ElementInspectorOverlayProps {
	/** Whether inspector mode is active (show transparent event-capture overlay) */
	active: boolean
	/** Ref to the iframe being inspected */
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	/** The element currently under the cursor (from useElementInspector) */
	hoveredElement: InspectedElementInfo | null
	/** The element that was selected (clicked) */
	selectedElement: InspectedElementInfo | null
	/** Clear the selected element */
	onClearSelection: () => void
	/** Optional: called when user wants to copy element selector */
	onCopySelector?: (selector: string) => void
	/** Optional: called when user wants to insert element info into console */
	onInsertToConsole?: (code: string) => void
	/** Optional: called when user wants to send element info to the agent input */
	onSendToAgent?: (content: JSONContent) => void
	/** When true, suppresses the floating ElementInfoCard after selection (for toolbar-triggered mode) */
	hideInfoCard?: boolean
	/** Scale ratio of the iframe (for coordinate conversion) */
	scaleRatio?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getShortSelector(info: InspectedElementInfo): string {
	let s = info.tagName
	if (info.id) s += `#${info.id}`
	if (info.classList.length > 0) s += `.${info.classList.slice(0, 2).join(".")}`
	return s
}

function formatSize(w: number, h: number): string {
	return `${Math.round(w)} × ${Math.round(h)}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ElementInspectorOverlay({
	active,
	iframeRef,
	hoveredElement,
	selectedElement,
	onClearSelection,
	onCopySelector,
	onInsertToConsole,
	onSendToAgent,
	hideInfoCard = false,
	scaleRatio = 1,
}: ElementInspectorOverlayProps) {
	const { t } = useTranslation("super")
	const overlayRef = useRef<HTMLDivElement>(null)
	const [iframeRect, setIframeRect] = useState<DOMRect | null>(null)

	// Track iframe position for coordinate conversion
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return

		const updateRect = () => {
			const parent = overlayRef.current?.parentElement
			if (!parent || !iframe) return
			const parentRect = parent.getBoundingClientRect()
			const ifRect = iframe.getBoundingClientRect()
			// Make iframe rect relative to the overlay container
			setIframeRect(
				new DOMRect(
					ifRect.left - parentRect.left,
					ifRect.top - parentRect.top,
					ifRect.width,
					ifRect.height,
				),
			)
		}

		updateRect()

		const ro = new ResizeObserver(updateRect)
		ro.observe(iframe)
		window.addEventListener("scroll", updateRect, true)

		return () => {
			ro.disconnect()
			window.removeEventListener("scroll", updateRect, true)
		}
	}, [iframeRef, active])

	/** Convert an iframe-viewport-relative rect to overlay-relative coordinates */
	const toOverlayRect = useCallback(
		(rect: InspectedElementRect) => {
			if (!iframeRect) return null
			return {
				left: iframeRect.left + rect.left * scaleRatio,
				top: iframeRect.top + rect.top * scaleRatio,
				width: rect.width * scaleRatio,
				height: rect.height * scaleRatio,
			}
		},
		[iframeRect, scaleRatio],
	)

	const hoverBox = useMemo(
		() => (hoveredElement ? toOverlayRect(hoveredElement.rect) : null),
		[hoveredElement, toOverlayRect],
	)

	const selectBox = useMemo(
		() => (selectedElement ? toOverlayRect(selectedElement.rect) : null),
		[selectedElement, toOverlayRect],
	)

	// Don't render anything if not active and no selection
	if (!active && !selectedElement) return null

	return (
		<div
			ref={overlayRef}
			className="pointer-events-none absolute inset-0 z-40"
			style={{ overflow: "hidden" }}
		>
			{/* Transparent event-capture layer when active — allows pointer events through to iframe */}
			{active && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{ cursor: "crosshair" }}
				/>
			)}

			{/* Hover highlight box */}
			{active && hoverBox && hoveredElement && (
				<>
					{/* Content area highlight */}
					<div
						className="pointer-events-none absolute border-2 border-blue-500"
						style={{
							left: hoverBox.left,
							top: hoverBox.top,
							width: hoverBox.width,
							height: hoverBox.height,
							backgroundColor: "rgba(59, 130, 246, 0.1)",
							transition: "all 50ms ease-out",
						}}
					/>

					{/* Padding highlight */}
					{hoveredElement.padding && (
						<div
							className="pointer-events-none absolute"
							style={{
								left: hoverBox.left - hoveredElement.padding.left * scaleRatio,
								top: hoverBox.top - hoveredElement.padding.top * scaleRatio,
								width:
									hoverBox.width +
									(hoveredElement.padding.left + hoveredElement.padding.right) *
										scaleRatio,
								height:
									hoverBox.height +
									(hoveredElement.padding.top + hoveredElement.padding.bottom) *
										scaleRatio,
								backgroundColor: "rgba(147, 196, 125, 0.3)",
								transition: "all 50ms ease-out",
								zIndex: -1,
							}}
						/>
					)}

					{/* Element label tooltip */}
					<HoverLabel
						info={hoveredElement}
						box={hoverBox}
						containerWidth={overlayRef.current?.clientWidth ?? 0}
					/>
				</>
			)}

			{/* Selected element highlight */}
			{selectBox && selectedElement && (
				<>
					<div
						className="pointer-events-none absolute border-2 border-orange-500"
						style={{
							left: selectBox.left,
							top: selectBox.top,
							width: selectBox.width,
							height: selectBox.height,
							backgroundColor: "rgba(249, 115, 22, 0.08)",
						}}
					/>

					{/* Info card */}
					{!hideInfoCard && (
						<ElementInfoCard
							info={selectedElement}
							box={selectBox}
							containerWidth={overlayRef.current?.clientWidth ?? 0}
							containerHeight={overlayRef.current?.clientHeight ?? 0}
							onClose={onClearSelection}
							onCopySelector={onCopySelector}
							onInsertToConsole={onInsertToConsole}
							onSendToAgent={onSendToAgent}
							t={t}
						/>
					)}
				</>
			)}
		</div>
	)
}

// ─── Hover Label ─────────────────────────────────────────────────────────────

function HoverLabel({
	info,
	box,
	containerWidth,
}: {
	info: InspectedElementInfo
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
}) {
	const label = getShortSelector(info)
	const size = formatSize(info.rect.width, info.rect.height)
	const labelWidth = 240

	// Position label above the element if there's space, else below
	const above = box.top > 28
	let left = box.left
	if (left + labelWidth > containerWidth) {
		left = containerWidth - labelWidth - 4
	}
	if (left < 4) left = 4

	return (
		<div
			className="pointer-events-none absolute flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight text-white"
			style={{
				left,
				top: above ? box.top - 24 : box.top + box.height + 4,
				backgroundColor: "rgba(37, 99, 235, 0.9)",
				maxWidth: labelWidth,
			}}
		>
			<span className="truncate font-semibold">{label}</span>
			<span className="opacity-70">{size}</span>
		</div>
	)
}

// ─── Element Info Card ───────────────────────────────────────────────────────

/**
 * Build a TipTap JSONContent for the chat input.
 * Scenario: user wants to modify an element's style.
 * Includes selector, size, key computed styles, and optional text content
 * as context, followed by a super-placeholder for the user's description.
 */
export function buildAgentPromptContent(
	info: InspectedElementInfo,
	t: (key: string) => string,
	fileInfo?: { fileId: string; fileName: string; filePath: string },
): JSONContent {
	const text = (s: string): JSONContent => ({ type: "text", text: s })
	const para = (...content: JSONContent[]): JSONContent => ({
		type: "paragraph",
		content,
	})
	const emptyPara = (): JSONContent => ({ type: "paragraph" })
	const placeholder = (placeholderText: string): JSONContent => ({
		type: SUPER_PLACEHOLDER_TYPE,
		attrs: {
			type: "input",
			props: { placeholder: placeholderText },
		},
	})

	const paragraphs: JSONContent[] = []

	// If we have a file, add an @mention of it at the top
	if (fileInfo) {
		const ext = fileInfo.fileName.includes(".")
			? (fileInfo.fileName.split(".").pop() ?? "")
			: ""
		paragraphs.push({
			type: "paragraph",
			content: [
				{
					type: "mention",
					attrs: {
						type: MentionItemType.PROJECT_FILE,
						data: {
							file_id: fileInfo.fileId,
							file_name: fileInfo.fileName,
							file_path: fileInfo.filePath,
							file_extension: ext,
						},
					},
				},
			],
		})
	}

	// Intro — insert an inspector-detail node that the editor will render as a collapsible panel
	const KEY_STYLE_PROPS = [
		"display",
		"position",
		"width",
		"height",
		"color",
		"backgroundColor",
		"fontSize",
		"fontFamily",
		"margin",
		"padding",
		"border",
		"borderRadius",
		"flexDirection",
		"alignItems",
		"justifyContent",
		"gap",
		"overflow",
		"zIndex",
	] as const
	const styleLines = KEY_STYLE_PROPS.flatMap((prop) => {
		const value = info.computedStyles[prop as keyof typeof info.computedStyles]
		if (
			value &&
			value !== "none" &&
			value !== "normal" &&
			value !== "auto" &&
			value !== "0px"
		) {
			return [`${prop}: ${value}`]
		}
		return []
	})

	const sizeStr = `${Math.round(info.rect.width)} × ${Math.round(info.rect.height)} px`
	const computedStylesObj: Record<string, string> = {}
	for (const line of styleLines) {
		const idx = line.indexOf(": ")
		if (idx > 0) {
			computedStylesObj[line.slice(0, idx)] = line.slice(idx + 2)
		}
	}
	const textPreview = info.textContent
		? info.textContent.length > 60
			? `${info.textContent.slice(0, 60)}…`
			: info.textContent
		: ""

	// Inspector detail node (title is stored in attrs for serialization/rendering)
	paragraphs.push({
		type: INSPECTOR_DETAIL_TYPE,
		attrs: {
			title: t("stylePanel.inspector.agentPromptTitle"),
			selector: info.selector,
			tagName: info.tagName,
			size: sizeStr,
			computedStyles: JSON.stringify(computedStylesObj),
			styleCount: styleLines.length,
			textContent: textPreview,
		},
	})

	// User-fillable placeholder
	paragraphs.push(emptyPara())
	paragraphs.push(
		para(
			text(`${t("stylePanel.inspector.agentPromptSuffix")}`),
			placeholder(t("stylePanel.inspector.agentPromptPlaceholder")),
		),
	)

	return { type: "doc", content: paragraphs }
}

function ElementInfoCard({
	info,
	box,
	containerWidth,
	containerHeight,
	onClose,
	onCopySelector,
	onInsertToConsole,
	onSendToAgent,
	t,
}: {
	info: InspectedElementInfo
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
	containerHeight: number
	onClose: () => void
	onCopySelector?: (selector: string) => void
	onInsertToConsole?: (code: string) => void
	onSendToAgent?: (content: JSONContent) => void
	t: (key: string) => string
}) {
	const cardWidth = 280
	const cardMaxHeight = 260

	// Position card to the right of the element if space permits, else to the left
	let left = box.left + box.width + 8
	if (left + cardWidth > containerWidth) {
		left = box.left - cardWidth - 8
	}
	if (left < 4) left = 4

	// Vertically align with the element, but clamp to viewport
	let top = box.top
	if (top + cardMaxHeight > containerHeight) {
		top = containerHeight - cardMaxHeight - 4
	}
	if (top < 4) top = 4

	const handleCopy = () => {
		onCopySelector?.(info.selector)
		navigator.clipboard.writeText(info.selector)
	}

	const handleInsert = () => {
		onInsertToConsole?.(`document.querySelector('${info.selector}')`)
	}

	const handleSendToAgent = () => {
		onSendToAgent?.(buildAgentPromptContent(info, t))
	}

	const importantStyles = [
		"display",
		"position",
		"width",
		"height",
		"color",
		"backgroundColor",
		"fontSize",
		"fontFamily",
	] as const

	return (
		<div
			className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border bg-popover/95 shadow-lg backdrop-blur-sm"
			style={{ left, top, width: cardWidth, maxHeight: cardMaxHeight }}
			data-testid="element-inspector-info-card"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b px-2 py-1.5">
				<div className="flex items-center gap-1 truncate text-xs font-semibold">
					<MousePointer size={12} className="flex-shrink-0 text-orange-500" />
					<span className="truncate font-mono">{getShortSelector(info)}</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-5 w-5 flex-shrink-0"
					onClick={onClose}
				>
					<X size={10} />
				</Button>
			</div>

			{/* Body — scrollable */}
			<div className="flex-1 overflow-y-auto p-2 text-[11px]">
				{/* Size */}
				<div className="mb-1.5">
					<span className="text-muted-foreground">{t("stylePanel.inspector.size")}:</span>{" "}
					<span className="font-mono">
						{formatSize(info.rect.width, info.rect.height)}
					</span>
				</div>

				{/* Selector */}
				<div className="mb-1.5 flex items-start gap-1">
					<span className="flex-shrink-0 text-muted-foreground">
						{t("stylePanel.inspector.selector")}:
					</span>
					<span className="flex-1 break-all font-mono text-blue-600 dark:text-blue-400">
						{info.selector}
					</span>
				</div>

				{/* Box model summary */}
				<div className="mb-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
					<div>
						<span className="text-muted-foreground">margin:</span>{" "}
						<span className="font-mono">
							{info.margin.top} {info.margin.right} {info.margin.bottom}{" "}
							{info.margin.left}
						</span>
					</div>
					<div>
						<span className="text-muted-foreground">padding:</span>{" "}
						<span className="font-mono">
							{info.padding.top} {info.padding.right} {info.padding.bottom}{" "}
							{info.padding.left}
						</span>
					</div>
				</div>

				{/* Key computed styles */}
				<div className="border-t pt-1.5">
					<div className="mb-0.5 text-muted-foreground">
						{t("stylePanel.inspector.computedStyles")}
					</div>
					{importantStyles.map((prop) => {
						const value = info.computedStyles[prop]
						if (!value) return null
						return (
							<div key={prop} className="flex gap-1 py-px">
								<span className="text-purple-600 dark:text-purple-400">
									{prop}:
								</span>
								<span className="truncate font-mono">{value}</span>
							</div>
						)
					})}
				</div>

				{/* Text content preview */}
				{info.textContent && (
					<div className="mt-1.5 border-t pt-1.5">
						<span className="text-muted-foreground">
							{t("stylePanel.inspector.textContent")}:
						</span>
						<div className="mt-0.5 line-clamp-2 font-mono text-[10px] text-muted-foreground/80">
							{info.textContent}
						</div>
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="flex flex-wrap items-center gap-1 border-t px-2 py-1">
				<Button
					variant="ghost"
					size="sm"
					className="h-5 gap-1 px-1.5 text-[10px]"
					onClick={handleCopy}
				>
					<Copy size={10} />
					{t("stylePanel.inspector.copySelector")}
				</Button>
				{onInsertToConsole && (
					<Button
						variant="ghost"
						size="sm"
						className="h-5 gap-1 px-1.5 text-[10px]"
						onClick={handleInsert}
					>
						<Crosshair size={10} />
						{t("stylePanel.inspector.insertToConsole")}
					</Button>
				)}
				{onSendToAgent && (
					<Button
						variant="default"
						size="sm"
						className="h-5 gap-1 px-1.5 text-[10px]"
						onClick={handleSendToAgent}
						data-testid="inspector-send-to-agent-button"
					>
						<Send size={10} />
						{t("stylePanel.inspector.sendToAgent")}
					</Button>
				)}
			</div>
		</div>
	)
}
