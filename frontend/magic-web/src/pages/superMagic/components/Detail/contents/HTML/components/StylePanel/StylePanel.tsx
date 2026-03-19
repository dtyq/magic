import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Separator } from "@/components/shadcn-ui/separator"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/lib/utils"
import { LayoutPanelTop, Paintbrush, ScanEye, RectangleHorizontal } from "lucide-react"
import { useSelectedElement } from "./hooks/useSelectedElement"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import type { StylePanelProps } from "./types"
import LayoutSection from "./sections/LayoutSection"
import BackgroundSection from "./sections/BackgroundSection"
import BorderSection from "./sections/BorderSection"
import ShadowSection from "./sections/ShadowSection"
import {
	HistoryActions,
	FontFamilySelector,
	FontSizeSelector,
	FontSizeAdjuster,
	TextFormatTools,
	TextAlignTools,
	ColorPicker,
	StylePopoverButton,
	ElementActions,
} from "./controls"
import { useShowButtonText } from "@/hooks/useShowButtonText"

/**
 * Rich text editor style toolbar component
 * Provides visual style editing interface similar to rich text editors
 */
export const StylePanel = observer(function StylePanel({
	editorRef,
	onStyleChange,
	disabled = false,
	className,
}: StylePanelProps) {
	const { t } = useTranslation("super")
	const { selectedElement, updateStyle } = useSelectedElement(editorRef)
	const stylePanelStore = useStylePanelStore()

	// Local state for quick access
	const [fontSize, setFontSize] = useState("16")
	const [fontFamily, setFontFamily] = useState("sans-serif")

	const showButtonLabel = useShowButtonText(800)

	/**
	 * Sync local state with selected element styles
	 * Handles both single and multi-select mode
	 * Shows actual DOM font size (not scaled by zoom)
	 */
	useEffect(() => {
		// Update local state from selected element (single-select only)
		// In multi-select mode, we show mixed/default values
		if (selectedElement?.computedStyles) {
			const { fontSize: computedFontSize, fontFamily: computedFontFamily } =
				selectedElement.computedStyles

			// Extract font size number from "16px" format
			// Show actual DOM size (element's true font-size property)
			if (computedFontSize) {
				const sizeMatch = computedFontSize.match(/(\d+)/)
				if (sizeMatch) {
					const actualSize = Number.parseInt(sizeMatch[1], 10)
					setFontSize(actualSize.toString())
				}
			}

			// Extract first font family from comma-separated list
			if (computedFontFamily) {
				const firstFont = computedFontFamily.split(",")[0].trim().replace(/['"]/g, "")
				setFontFamily(firstFont)
			}
		} else if (stylePanelStore.selectedElements.length > 0) {
			// Multi-select mode: use first element's styles as default
			const firstElement = stylePanelStore.selectedElements[0]
			if (firstElement?.computedStyles) {
				const { fontSize: computedFontSize, fontFamily: computedFontFamily } =
					firstElement.computedStyles

				if (computedFontSize) {
					const sizeMatch = computedFontSize.match(/(\d+)/)
					if (sizeMatch) {
						const actualSize = Number.parseInt(sizeMatch[1], 10)
						setFontSize(actualSize.toString())
					}
				}

				if (computedFontFamily) {
					const firstFont = computedFontFamily.split(",")[0].trim().replace(/['"]/g, "")
					setFontFamily(firstFont)
				}
			}
		}
	}, [selectedElement, stylePanelStore, stylePanelStore.selectedElements])

	/**
	 * Handle style change
	 * Supports both single and multiple element selection
	 */
	const handleStyleChange = useCallback(
		async (property: string, value: string) => {
			// Get all selected selectors (handles both single and multi-select)
			const selectors = stylePanelStore.getSelectedSelectors()
			if (selectors.length === 0) {
				console.warn("[StylePanel] No elements selected")
				return
			}

			// Apply the style change (handles both single and multi-select)
			await updateStyle(property, value)

			// Notify callback with primary selector
			const primarySelector = selectors[0]
			onStyleChange?.(primarySelector, property, value)

			// For text selection changes, TextStyleManager will automatically select
			// the newly created/modified span, so we should NOT refresh the old element
			// selector here as it would override the automatic span selection
		},
		[updateStyle, onStyleChange, stylePanelStore, editorRef],
	)

	/**
	 * Handle text formatting
	 */
	const handleFormat = useCallback(
		(property: string, value: string) => {
			handleStyleChange(property, value)
		},
		[handleStyleChange],
	)

	/**
	 * Handle font family change
	 */
	const handleFontFamilyChange = useCallback(
		(value: string) => {
			setFontFamily(value)
			handleStyleChange("fontFamily", value)
		},
		[handleStyleChange],
	)

	/**
	 * Handle font size apply
	 * Applies the actual DOM font size directly
	 */
	const handleFontSizeApply = useCallback(
		(value: string) => {
			// Apply the actual font size directly (no scaling conversion)
			const fontSize = Number.parseInt(value, 10)
			handleStyleChange("fontSize", `${fontSize}px`)
		},
		[handleStyleChange],
	)

	/**
	 * Handle text align
	 */
	const handleAlign = useCallback(
		(value: string) => {
			handleStyleChange("textAlign", value)
		},
		[handleStyleChange],
	)

	/**
	 * Handle font size adjustment for selected element(s) and their children
	 * Adjusts font size relatively by a scale factor (10%)
	 * Uses dedicated command to ensure atomic undo/redo
	 * Supports both single and multi-select
	 */
	const handleFontSizeAdjust = useCallback(
		async (direction: "increase" | "decrease") => {
			// Get all selected selectors (handles both single and multi-select)
			const selectors = stylePanelStore.getSelectedSelectors()
			if (selectors.length === 0 || !editorRef?.current) {
				console.warn("[StylePanel] No elements selected for font size adjustment")
				return
			}

			try {
				// Scale factor for font size adjustment (10% increase/decrease)
				const scaleFactor = direction === "increase" ? 1.1 : 0.9
				// Minimum font size in actual DOM pixels
				const minFontSize = 8

				// Use the new recursive font size adjustment command for each selected element
				// This ensures all changes are recorded as a single atomic operation for each element
				for (const selector of selectors) {
					await editorRef.current.adjustFontSizeRecursive?.(
						selector,
						scaleFactor,
						minFontSize,
					)
				}

				// Update local state with computed font size after adjustment
				// Use first selector as representative
				const iframe = editorRef.current as { iframeRef?: { current?: HTMLIFrameElement } }
				const iframeWindow = iframe.iframeRef?.current?.contentWindow

				if (iframeWindow?.document) {
					const element = iframeWindow.document.querySelector(selectors[0])
					if (element && "style" in element) {
						const computedStyle = iframeWindow.getComputedStyle(element)
						const actualFontSize = Number.parseFloat(computedStyle.fontSize)
						if (!Number.isNaN(actualFontSize)) {
							// Show actual DOM font size (not scaled)
							setFontSize(Math.round(actualFontSize).toString())
						}
					}
				}
			} catch (error) {
				console.error("[StylePanel] Failed to adjust font size:", error)
			}
		},
		[stylePanelStore, editorRef],
	)

	// Get current computed styles
	// In multi-select mode, use first element's styles as reference for UI state
	const computedStyles =
		selectedElement?.computedStyles ||
		(stylePanelStore.selectedElements.length > 0
			? stylePanelStore.selectedElements[0]?.computedStyles
			: undefined)
	const isBold = !!(computedStyles?.fontWeight && parseInt(computedStyles.fontWeight) >= 700)
	const isItalic = computedStyles?.fontStyle === "italic"
	const hasUnderline = computedStyles?.textDecoration?.includes("underline") ?? false
	const hasLineThrough = computedStyles?.textDecoration?.includes("line-through") ?? false
	const textAlign = computedStyles?.textAlign || "left"
	const currentColor = computedStyles?.color || "#000000"

	// Disable controls when no element is selected or when saving
	// Check both single and multi-select modes
	const hasSelection = selectedElement !== null || stylePanelStore.selectedElements.length > 0
	const isDisabled = !hasSelection || disabled

	return (
		<TooltipProvider delayDuration={300}>
			<div
				className={cn(
					"flex flex-wrap items-center gap-1 border-b bg-card/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/60",
					className,
				)}
			>
				{/* History actions */}
				<HistoryActions editorRef={editorRef} />

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Element actions (duplicate, delete) */}
				<ElementActions editorRef={editorRef} disabled={isDisabled} />

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Font family selector */}
				<FontFamilySelector
					value={fontFamily}
					onChange={handleFontFamilyChange}
					disabled={isDisabled}
				/>

				{/* Font size selector */}
				<FontSizeSelector
					value={fontSize}
					onChange={setFontSize}
					onApply={handleFontSizeApply}
					disabled={isDisabled}
				/>

				{/* Font size adjuster */}
				<FontSizeAdjuster onAdjust={handleFontSizeAdjust} disabled={isDisabled} />

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Text formatting tools */}
				<TextFormatTools
					isBold={isBold}
					isItalic={isItalic}
					hasUnderline={hasUnderline}
					hasLineThrough={hasLineThrough}
					onFormat={handleFormat}
					disabled={isDisabled}
				/>

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Text alignment tools */}
				<TextAlignTools textAlign={textAlign} onAlign={handleAlign} disabled={isDisabled} />

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Text color picker */}
				<ColorPicker
					value={currentColor}
					onChangeComplete={(value) => handleStyleChange("color", value)}
					disabled={isDisabled}
				/>

				<Separator orientation="vertical" className="mx-1 !h-4" />

				{/* Layout settings */}
				<StylePopoverButton
					icon={<LayoutPanelTop className="h-4 w-4" />}
					tooltip={t("stylePanel.layoutSettings")}
					title={t("stylePanel.layout")}
					disabled={isDisabled}
					showLabel={showButtonLabel}
				>
					<LayoutSection
						selectedElement={selectedElement}
						editorRef={editorRef}
						onStyleChange={handleStyleChange}
					/>
				</StylePopoverButton>

				{/* Flex/Grid layout settings */}
				{/* <StylePopoverButton
					icon={<LayoutGrid className="h-4 w-4" />}
					tooltip={t("stylePanel.flexGridLayout")}
					title={t("stylePanel.flexGrid")}
					disabled={isDisabled}
				>
					<FlexGridSection
						selectedElement={selectedElement}
						editorRef={editorRef}
						onStyleChange={handleStyleChange}
					/>
				</StylePopoverButton> */}

				{/* Background settings */}
				<StylePopoverButton
					icon={<Paintbrush className="h-4 w-4" />}
					tooltip={t("stylePanel.backgroundSettings")}
					title={t("stylePanel.background")}
					disabled={isDisabled}
					showLabel={showButtonLabel}
				>
					<BackgroundSection
						selectedElement={selectedElement}
						editorRef={editorRef}
						onStyleChange={handleStyleChange}
					/>
				</StylePopoverButton>

				{/* Border settings */}
				<StylePopoverButton
					icon={<RectangleHorizontal className="h-4 w-4" />}
					tooltip={t("stylePanel.borderSettings")}
					title={t("stylePanel.border")}
					disabled={isDisabled}
					showLabel={showButtonLabel}
				>
					<BorderSection
						selectedElement={selectedElement}
						editorRef={editorRef}
						onStyleChange={handleStyleChange}
					/>
				</StylePopoverButton>

				{/* Shadow & effects */}
				<StylePopoverButton
					icon={<ScanEye className="h-4 w-4" />}
					tooltip={t("stylePanel.shadowAndEffects")}
					title={t("stylePanel.shadow")}
					disabled={isDisabled}
					showLabel={showButtonLabel}
				>
					<ShadowSection
						selectedElement={selectedElement}
						editorRef={editorRef}
						onStyleChange={handleStyleChange}
					/>
				</StylePopoverButton>
			</div>
		</TooltipProvider>
	)
})

StylePanel.displayName = "StylePanel"
