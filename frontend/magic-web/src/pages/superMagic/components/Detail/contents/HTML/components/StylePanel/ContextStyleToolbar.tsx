import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Separator } from "@/components/shadcn-ui/separator"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import type { ElementRect } from "../SelectionOverlay/types"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import { useSelectedElement } from "./hooks/useSelectedElement"
import { getElementCapabilities } from "./capabilities"
import {
	areLineHeightsEquivalent,
	getAuthoredLineHeight,
	resolveDisplayLineHeight,
} from "./utils/lineHeight"
import {
	CONTEXT_TOOLBAR_PANEL_PADDING,
	getContextToolbarRowMaxWidth,
	partitionContextToolGroups,
} from "./utils/contextToolbarPartition"
import { ContextMorePopover, ContextToolbarMotion } from "./controls"
import { useContextToolbarGroups } from "./hooks/useContextToolbarGroups"
import type { ContextToolbarItemMotion } from "./types"

export interface ContextStyleToolbarProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	onStyleChange?: (selector: string, property: string, value: string) => void
	disabled?: boolean
	className?: string
	contextToolbarOpen?: boolean
	selectionRect?: ElementRect | null
	boundaryRef?: React.RefObject<HTMLElement | null>
	availableWidth?: number
	onRevealMoreStyles?: () => void
}

export const ContextStyleToolbar = observer(function ContextStyleToolbar({
	editorRef,
	onStyleChange: externalOnStyleChange,
	disabled = false,
	className,
	contextToolbarOpen = true,
	availableWidth,
	onRevealMoreStyles,
}: ContextStyleToolbarProps) {
	const { selectedElement, updateStyle } = useSelectedElement(editorRef)
	const stylePanelStore = useStylePanelStore()

	const [fontSize, setFontSize] = useState("16")
	const [lineHeight, setLineHeight] = useState("normal")
	const lineHeightDisplayRef = useRef<{ selector: string; value: string } | null>(null)

	const computedStyles =
		selectedElement?.computedStyles ||
		(stylePanelStore.selectedElements.length > 0
			? stylePanelStore.selectedElements[0]?.computedStyles
			: undefined)
	const isFlexContainer = computedStyles?.display === "flex"
	const isTextElement = selectedElement?.isTextElement === true
	const flexAlignment = useMemo(() => {
		if (stylePanelStore.textSelection?.hasSelection || !selectedElement || isTextElement)
			return null

		if (!isFlexContainer) return null

		return {
			value: computedStyles?.justifyContent || "flex-start",
			direction: computedStyles?.flexDirection || "row",
			targetSelector: selectedElement.selector,
		}
	}, [
		computedStyles,
		isFlexContainer,
		selectedElement,
		stylePanelStore.textSelection?.hasSelection,
		isTextElement,
	])

	useEffect(() => {
		if (selectedElement?.computedStyles) {
			const { fontSize: computedFontSize, lineHeight: computedLineHeight } =
				selectedElement.computedStyles

			if (computedFontSize) {
				const sizeMatch = computedFontSize.match(/(\d+)/)
				if (sizeMatch) {
					setFontSize(Number.parseInt(sizeMatch[1], 10).toString())
				}
			}

			const preservedLineHeight =
				lineHeightDisplayRef.current?.selector === selectedElement.selector &&
				areLineHeightsEquivalent(
					lineHeightDisplayRef.current.value,
					computedLineHeight || "normal",
					computedFontSize,
				)
					? lineHeightDisplayRef.current.value
					: null
			if (!preservedLineHeight) lineHeightDisplayRef.current = null
			setLineHeight(
				preservedLineHeight ||
					resolveDisplayLineHeight(
						computedLineHeight,
						getAuthoredLineHeight(selectedElement.inlineStyles),
					),
			)
		} else if (stylePanelStore.selectedElements.length > 0) {
			lineHeightDisplayRef.current = null
			const firstElement = stylePanelStore.selectedElements[0]
			if (firstElement?.computedStyles) {
				const { fontSize: computedFontSize, lineHeight: computedLineHeight } =
					firstElement.computedStyles

				if (computedFontSize) {
					const sizeMatch = computedFontSize.match(/(\d+)/)
					if (sizeMatch) {
						setFontSize(Number.parseInt(sizeMatch[1], 10).toString())
					}
				}

				setLineHeight(
					resolveDisplayLineHeight(
						computedLineHeight,
						getAuthoredLineHeight(firstElement.inlineStyles),
					),
				)
			}
		}
	}, [selectedElement, stylePanelStore.selectedElements])

	const handleStyleChange = useCallback(
		async (property: string, value: string) => {
			if (selectedElement) {
				externalOnStyleChange?.(selectedElement.selector, property, value)
			}
			await updateStyle(property, value)
		},
		[externalOnStyleChange, selectedElement, updateStyle],
	)

	const handleFontSizeApply = useCallback(
		(newSize: string) => {
			handleStyleChange("fontSize", `${newSize}px`)
		},
		[handleStyleChange],
	)

	const handleFontSizeAdjust = useCallback(
		async (direction: "increase" | "decrease") => {
			const selectors = stylePanelStore.getSelectedSelectors()
			if (selectors.length === 0 || !editorRef?.current) {
				console.warn("[StylePanel] No elements selected for font size adjustment")
				return
			}

			try {
				const scaleFactor = direction === "increase" ? 1.1 : 0.9
				const minFontSize = 8

				for (const selector of selectors) {
					await editorRef.current.adjustFontSizeRecursive?.(
						selector,
						scaleFactor,
						minFontSize,
					)
				}

				const iframe = editorRef.current as { iframeRef?: { current?: HTMLIFrameElement } }
				const iframeWindow = iframe.iframeRef?.current?.contentWindow

				if (iframeWindow?.document) {
					const element = iframeWindow.document.querySelector(selectors[0])
					if (element && "style" in element) {
						const computedStyle = iframeWindow.getComputedStyle(element)
						const actualFontSize = Number.parseFloat(computedStyle.fontSize)
						if (!Number.isNaN(actualFontSize)) {
							setFontSize(Math.round(actualFontSize).toString())
						}
					}
				}
			} catch (error) {
				console.error("[StylePanel] Failed to adjust font size:", error)
			}
		},
		[editorRef, stylePanelStore],
	)

	const handleLineHeightApply = useCallback(
		(newLineHeight: string) => {
			lineHeightDisplayRef.current = selectedElement
				? { selector: selectedElement.selector, value: newLineHeight }
				: null
			setLineHeight(newLineHeight)
			handleStyleChange("lineHeight", newLineHeight)
		},
		[handleStyleChange, selectedElement],
	)

	const handleFormat = useCallback(
		(property: string, value: string) => {
			handleStyleChange(property, value)
		},
		[handleStyleChange],
	)

	const handleAlignment = useCallback(
		(align: "left" | "center" | "right" | "justify") => {
			if (flexAlignment) {
				const flexAlignMap: Record<string, string> = {
					left: "flex-start",
					center: "center",
					right: "flex-end",
					justify: "space-between",
				}
				const flexValue = flexAlignMap[align] || align
				handleStyleChange("justifyContent", flexValue)
				return
			}
			handleStyleChange("textAlign", align)
		},
		[flexAlignment, handleStyleChange],
	)

	const isBold =
		computedStyles?.fontWeight === "bold" || Number(computedStyles?.fontWeight) >= 700
	const isItalic = computedStyles?.fontStyle === "italic"
	const hasUnderline = computedStyles?.textDecoration?.includes("underline") || false
	const hasLineThrough = computedStyles?.textDecoration?.includes("line-through") || false
	const textAlign =
		(computedStyles?.textAlign as "left" | "center" | "right" | "justify") || "left"
	const currentColor = computedStyles?.color || "#000000"

	const capabilities = getElementCapabilities(selectedElement)
	const showAlignmentTools = capabilities.showParagraph || Boolean(flexAlignment)
	const showBackgroundImageAction =
		selectedElement !== null &&
		!selectedElement.isImageElement &&
		selectedElement.tagName.toLowerCase() !== "img"

	const hasSelection = selectedElement !== null || stylePanelStore.selectedElements.length > 0
	const isDisabled = !hasSelection || disabled

	const renderContextToolbarItem = useCallback<ContextToolbarItemMotion>(
		(children, key) => (
			<ContextToolbarMotion key={key} enabled open={contextToolbarOpen} as="span">
				{children}
			</ContextToolbarMotion>
		),
		[contextToolbarOpen],
	)

	const contextMorePopover = (
		<ContextMorePopover disabled={isDisabled} onReveal={onRevealMoreStyles ?? (() => {})} />
	)

	const handleRevealLinkSettings = useCallback(() => {
		if (!selectedElement) return
		stylePanelStore.rememberMoreStylesTab(selectedElement.selector, "link")
		onRevealMoreStyles?.()
	}, [selectedElement, stylePanelStore, onRevealMoreStyles])

	// Build atomic tool groups for contextual editing
	const groups = useContextToolbarGroups({
		capabilities,
		editorRef,
		disabled,
		isDisabled,
		selectedElement,
		fontSize,
		setFontSize,
		handleFontSizeApply,
		handleFontSizeAdjust,
		lineHeight,
		setLineHeight,
		handleLineHeightApply,
		isBold,
		isItalic,
		hasUnderline,
		hasLineThrough,
		handleFormat,
		showAlignmentTools,
		flexAlignment,
		textAlign,
		handleAlignment,
		currentColor,
		handleStyleChange,
		showBackgroundImageAction,
		contextMorePopover,
		onRevealLinkSettings: onRevealMoreStyles ? handleRevealLinkSettings : undefined,
		renderContextToolbarItem,
	})

	const rows = useMemo(() => {
		const innerWidth =
			availableWidth == null ? undefined : availableWidth - CONTEXT_TOOLBAR_PANEL_PADDING
		return partitionContextToolGroups(groups, getContextToolbarRowMaxWidth(innerWidth))
	}, [availableWidth, groups])

	return (
		<TooltipProvider delayDuration={300}>
			<div
				data-testid="html-editor-context-style-toolbar"
				className={cn(
					"w-fit max-w-full overflow-visible border-0 bg-transparent p-0",
					rows.length > 1
						? "flex flex-col items-start gap-1.5"
						: "flex items-center gap-1",
					className,
				)}
			>
				{rows.map((row, rowIndex) => (
					<div
						key={rowIndex}
						data-context-toolbar-row={rowIndex}
						className="flex min-h-7 max-w-full flex-nowrap items-center gap-1"
					>
						{row.map((group, groupIndex) => (
							<Fragment key={`${group.id}-${group.items?.[0]?.id ?? "group"}`}>
								{groupIndex > 0 ? (
									<Separator
										orientation="vertical"
										className="mx-1 !h-4 shrink-0 bg-border/70"
									/>
								) : null}
								{group.items ? (
									<div className="flex items-center gap-1">
										{group.items.map((item) => (
											<Fragment key={item.id}>{item.data?.node}</Fragment>
										))}
									</div>
								) : (
									group.data?.node
								)}
							</Fragment>
						))}
					</div>
				))}
			</div>
		</TooltipProvider>
	)
})
