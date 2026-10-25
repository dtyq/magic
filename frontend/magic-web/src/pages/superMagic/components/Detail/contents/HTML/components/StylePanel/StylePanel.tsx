import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Separator } from "@/components/shadcn-ui/separator"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import { LayoutPanelTop, Paintbrush, PanelRight, ScanEye, RectangleHorizontal } from "lucide-react"
import { useSelectedElement } from "./hooks/useSelectedElement"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import type { StylePanelProps } from "./types"
import LayoutSection from "./sections/LayoutSection"
import FlexGridSection from "./sections/FlexGridSection"
import ImageSection from "./sections/ImageSection"
import BackgroundSection from "./sections/BackgroundSection"
import BorderSection from "./sections/BorderSection"
import ShadowSection from "./sections/ShadowSection"
import {
	HistoryActions,
	FontFamilySelector,
	FontSizeSelector,
	LineHeightSelector,
	FontSizeAdjuster,
	TextFormatTools,
	TextAlignTools,
	ColorPicker,
	StylePopoverButton,
	ElementActions,
	BackgroundImageButton,
	SizePopover,
} from "./controls"
import { SelectionReadout } from "./controls/SelectionReadout"
import { ContextStyleToolbar } from "./ContextStyleToolbar"
import { useShowButtonText } from "@/hooks/useShowButtonText"
import { getElementCapabilities } from "./capabilities"
import {
	areLineHeightsEquivalent,
	getAuthoredLineHeight,
	resolveDisplayLineHeight,
} from "./utils/lineHeight"

const FullStylePanel = observer(function FullStylePanel({
	editorRef,
	onStyleChange,
	disabled = false,
	className,
	toolbarEndRef,
	variant = "full",
	sidebarOpen,
	onToggleSidebar,
	domTreeOpen = false,
	onToggleDomTree,
}: StylePanelProps) {
	const isSidebarOpen = sidebarOpen ?? domTreeOpen
	const toggleSidebar = onToggleSidebar ?? onToggleDomTree
	const { t } = useTranslation("super")
	const { selectedElement, updateStyle, updateBatchStyles } = useSelectedElement(editorRef)
	const stylePanelStore = useStylePanelStore()

	// Local state for quick access
	const [fontSize, setFontSize] = useState("16")
	const [lineHeight, setLineHeight] = useState("normal")
	const [fontFamily, setFontFamily] = useState("sans-serif")
	const [textContent, setTextContent] = useState("")
	// Computed styles normalize unitless line-height to pixels. Keep the user's
	// notation only while it still matches the latest computed value.
	const lineHeightDisplayRef = useRef<{ selector: string; value: string } | null>(null)

	const showButtonLabel = useShowButtonText(800)

	// Text elements keep text alignment even when they are flex items; other
	// flex items expose the parent container's justify-content controls.
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

	/**
	 * Sync local state with selected element styles
	 * Handles both single and multi-select mode
	 * Shows actual DOM font size (not scaled by zoom)
	 */
	useEffect(() => {
		// Update local state from selected element (single-select only)
		// In multi-select mode, we show mixed/default values
		if (selectedElement?.computedStyles) {
			setTextContent(selectedElement.textContent ?? "")
			const {
				fontSize: computedFontSize,
				fontFamily: computedFontFamily,
				lineHeight: computedLineHeight,
			} = selectedElement.computedStyles

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
			setTextContent("")
			// Multi-select mode: use first element's styles as default
			const firstElement = stylePanelStore.selectedElements[0]
			if (firstElement?.computedStyles) {
				const {
					fontSize: computedFontSize,
					fontFamily: computedFontFamily,
					lineHeight: computedLineHeight,
				} = firstElement.computedStyles

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
				setLineHeight(
					resolveDisplayLineHeight(
						computedLineHeight,
						getAuthoredLineHeight(firstElement.inlineStyles),
					),
				)
			}
		} else {
			lineHeightDisplayRef.current = null
			setTextContent("")
		}
	}, [selectedElement, stylePanelStore, stylePanelStore.selectedElements])

	const handleTextContentCommit = useCallback(
		async (value: string) => {
			if (
				!selectedElement?.isTextElement ||
				!selectedElement.selector ||
				!editorRef.current?.updateTextContent
			)
				return

			const nextContent = value.replace(/\r\n/g, "\n")
			if (nextContent === (selectedElement.textContent ?? "")) return

			await editorRef.current.updateTextContent(selectedElement.selector, nextContent)
			stylePanelStore.selectElement({
				...selectedElement,
				textContent: nextContent,
			})
		},
		[editorRef, selectedElement, stylePanelStore],
	)

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
		[updateStyle, onStyleChange, stylePanelStore],
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

	/** Apply the compact line-height value to the selected element(s). */
	const handleLineHeightApply = useCallback(
		(value: string) => {
			const normalizedValue = value.trim()
			if (!normalizedValue) return
			if (selectedElement?.selector) {
				lineHeightDisplayRef.current = {
					selector: selectedElement.selector,
					value: normalizedValue,
				}
			}
			setLineHeight(normalizedValue)
			handleStyleChange("lineHeight", normalizedValue)
		},
		[handleStyleChange, selectedElement?.selector],
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

	const handleAlignment = useCallback(
		async (value: string) => {
			if (!flexAlignment) {
				handleAlign(value)
				return
			}

			if (!editorRef.current) return

			await editorRef.current.setBatchStyles(flexAlignment.targetSelector, {
				justifyContent: value,
			})
			onStyleChange?.(flexAlignment.targetSelector, "justifyContent", value)

			if (selectedElement?.selector) {
				await editorRef.current.refreshSelectedElement(selectedElement.selector)
			}
		},
		[editorRef, flexAlignment, handleAlign, onStyleChange, selectedElement?.selector],
	)

	/**
	 * Handle linked size updates so image ratio locking can commit width/height together.
	 */
	const handleBatchStyleChange = useCallback(
		async (styles: Record<string, string>) => {
			await updateBatchStyles(styles)

			const selectors = stylePanelStore.getSelectedSelectors()
			const primarySelector = selectors[0]
			if (!primarySelector) return

			Object.entries(styles).forEach(([property, value]) => {
				onStyleChange?.(primarySelector, property, value)
			})
		},
		[onStyleChange, stylePanelStore, updateBatchStyles],
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

	const isBold = !!(computedStyles?.fontWeight && parseInt(computedStyles.fontWeight) >= 700)
	const isItalic = computedStyles?.fontStyle === "italic"
	const hasUnderline = computedStyles?.textDecoration?.includes("underline") ?? false
	const hasLineThrough = computedStyles?.textDecoration?.includes("line-through") ?? false
	const textAlign = computedStyles?.textAlign || "left"
	const currentColor = computedStyles?.color || "#000000"
	const capabilities = getElementCapabilities(selectedElement)
	const showAlignmentTools = capabilities.showParagraph || Boolean(flexAlignment)
	const showBackgroundImageAction =
		selectedElement !== null &&
		!selectedElement.isImageElement &&
		selectedElement.tagName.toLowerCase() !== "img"

	// Disable controls when no element is selected or when saving
	// Check both single and multi-select modes
	const hasSelection = selectedElement !== null || stylePanelStore.selectedElements.length > 0
	const isDisabled = !hasSelection || disabled
	const showElementControls = variant !== "global"
	const sidebarToggleLabel = isSidebarOpen
		? t("stylePanel.sidebar.collapseSection")
		: t("stylePanel.domTree.title")
	const textContentField = capabilities.showTypography ? (
		<div className="w-full min-w-0 basis-full">
			<label className="mb-2 block text-xs font-medium text-muted-foreground">
				<span className="mb-1 block">{t("stylePanel.textContent")}</span>
				<Textarea
					data-testid="html-editor-text-content-input"
					value={textContent}
					onChange={(event) => setTextContent(event.target.value)}
					onBlur={(event) => handleTextContentCommit(event.target.value)}
					placeholder={t("stylePanel.textContentPlaceholder")}
					rows={4}
					maxLength={5000}
					disabled={isDisabled}
					className="min-h-24 resize-y rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
		</div>
	) : null

	return (
		<TooltipProvider delayDuration={300}>
			<div
				data-testid="html-editor-style-toolbar"
				className={cn(
					"border-b bg-card/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/60",
					toolbarEndRef
						? "flex w-full min-w-0 items-center gap-2"
						: "flex flex-wrap items-center gap-1",
					className,
				)}
			>
				<div
					className={cn(
						"flex min-w-0 items-center gap-1",
						toolbarEndRef ? "shrink-0 flex-wrap" : "flex-wrap",
					)}
				>
					<HistoryActions editorRef={editorRef} />
					<SelectionReadout selectedElement={selectedElement} editorRef={editorRef} />
					{showElementControls ? (
						<Separator orientation="vertical" className="mx-1 !h-4" />
					) : null}

					{showElementControls ? (
						<>
							{/* Element actions (duplicate, delete) */}
							<ElementActions editorRef={editorRef} disabled={disabled} />
							<Separator orientation="vertical" className="mx-1 !h-4" />

							{capabilities.showTypography ? (
								<>
									{textContentField}
									<FontFamilySelector
										value={fontFamily}
										onChange={handleFontFamilyChange}
										disabled={isDisabled}
									/>
									{capabilities.showFontSize ? (
										<FontSizeSelector
											value={fontSize}
											onChange={setFontSize}
											onApply={handleFontSizeApply}
											disabled={isDisabled}
										/>
									) : null}
								</>
							) : null}

							{capabilities.showFontSizeAdjuster ? (
								<FontSizeAdjuster
									onAdjust={handleFontSizeAdjust}
									disabled={isDisabled}
								/>
							) : null}

							{capabilities.showTypography ? (
								<LineHeightSelector
									value={lineHeight}
									fontSize={fontSize}
									onChange={setLineHeight}
									onApply={handleLineHeightApply}
									disabled={isDisabled}
								/>
							) : null}

							{capabilities.showTypography || capabilities.showFontSizeAdjuster ? (
								<Separator orientation="vertical" className="mx-1 !h-4" />
							) : null}

							{capabilities.showTypography ? (
								<TextFormatTools
									isBold={isBold}
									isItalic={isItalic}
									hasUnderline={hasUnderline}
									hasLineThrough={hasLineThrough}
									onFormat={handleFormat}
									disabled={isDisabled}
								/>
							) : null}

							{capabilities.showTypography ? (
								<Separator orientation="vertical" className="mx-1 !h-4" />
							) : null}

							{showAlignmentTools ? (
								<TextAlignTools
									value={flexAlignment?.value || textAlign}
									onAlign={handleAlignment}
									mode={flexAlignment ? "flex" : "text"}
									flexDirection={flexAlignment?.direction}
									disabled={isDisabled}
								/>
							) : null}

							{showAlignmentTools ? (
								<Separator orientation="vertical" className="mx-1 !h-4" />
							) : null}

							{capabilities.showTypography ? (
								<ColorPicker
									value={currentColor}
									onChangeComplete={(value) => handleStyleChange("color", value)}
									disabled={isDisabled}
								/>
							) : null}

							{showBackgroundImageAction ? (
								<>
									<BackgroundImageButton
										selectedElement={selectedElement}
										editorRef={editorRef}
										disabled={isDisabled}
									/>
									<Separator orientation="vertical" className="mx-1 !h-4" />
								</>
							) : capabilities.showTypography ? (
								<Separator orientation="vertical" className="mx-1 !h-4" />
							) : null}

							<SizePopover
								selectedElement={selectedElement}
								editorRef={editorRef}
								disabled={isDisabled}
								showLabel={showButtonLabel}
								onStyleChange={(property, value) =>
									handleStyleChange(property, value)
								}
								onBatchStyleChange={handleBatchStyleChange}
							/>

							<Separator orientation="vertical" className="mx-1 !h-4" />

							{/* Layout settings */}
							<StylePopoverButton
								icon={<LayoutPanelTop className="h-4 w-4" />}
								tooltip={t("stylePanel.layoutSettings")}
								title={t("stylePanel.layout")}
								disabled={isDisabled}
								showLabel={showButtonLabel}
								triggerTestId="html-style-panel-layout-trigger"
								contentTestId="html-style-panel-layout-content"
							>
								<LayoutSection
									selectedElement={selectedElement}
									editorRef={editorRef}
									onStyleChange={handleStyleChange}
								/>
							</StylePopoverButton>
							{capabilities.showFlexGrid ? (
								<StylePopoverButton
									icon={<LayoutPanelTop className="h-4 w-4" />}
									tooltip={t("stylePanel.flexGridLayout")}
									title={t("stylePanel.flexGrid")}
									disabled={isDisabled}
									showLabel={showButtonLabel}
									triggerTestId="html-style-panel-flex-grid-trigger"
									contentTestId="html-style-panel-flex-grid-content"
								>
									<FlexGridSection
										selectedElement={selectedElement}
										editorRef={editorRef}
										onStyleChange={handleStyleChange}
									/>
								</StylePopoverButton>
							) : null}
							{capabilities.showImage ? (
								<StylePopoverButton
									icon={<Paintbrush className="h-4 w-4" />}
									tooltip={t("stylePanel.imageSettings")}
									title={t("stylePanel.imageSettings")}
									disabled={isDisabled}
									showLabel={showButtonLabel}
									triggerTestId="html-style-panel-image-trigger"
									contentTestId="html-style-panel-image-content"
								>
									<ImageSection
										selectedElement={selectedElement}
										editorRef={editorRef}
										onStyleChange={handleStyleChange}
									/>
								</StylePopoverButton>
							) : null}
							{capabilities.showBackground ? (
								<StylePopoverButton
									icon={<Paintbrush className="h-4 w-4" />}
									tooltip={t("stylePanel.backgroundSettings")}
									title={t("stylePanel.background")}
									disabled={isDisabled}
									showLabel={showButtonLabel}
									triggerTestId="html-style-panel-background-trigger"
									contentTestId="html-style-panel-background-content"
								>
									<BackgroundSection
										selectedElement={selectedElement}
										editorRef={editorRef}
										onStyleChange={handleStyleChange}
									/>
								</StylePopoverButton>
							) : null}
							<StylePopoverButton
								icon={<RectangleHorizontal className="h-4 w-4" />}
								tooltip={t("stylePanel.borderSettings")}
								title={t("stylePanel.border")}
								disabled={isDisabled}
								showLabel={showButtonLabel}
								triggerTestId="html-style-panel-border-trigger"
								contentTestId="html-style-panel-border-content"
							>
								<BorderSection
									selectedElement={selectedElement}
									editorRef={editorRef}
									onStyleChange={handleStyleChange}
								/>
							</StylePopoverButton>
							<StylePopoverButton
								icon={<ScanEye className="h-4 w-4" />}
								tooltip={t("stylePanel.shadowAndEffects")}
								title={t("stylePanel.shadow")}
								disabled={isDisabled}
								showLabel={showButtonLabel}
								triggerTestId="html-style-panel-shadow-trigger"
								contentTestId="html-style-panel-shadow-content"
							>
								<ShadowSection
									selectedElement={selectedElement}
									editorRef={editorRef}
									onStyleChange={handleStyleChange}
								/>
							</StylePopoverButton>
						</>
					) : null}
				</div>

				<div className="min-w-0 flex-1" />

				{toolbarEndRef ? (
					<div
						ref={toolbarEndRef as React.Ref<HTMLDivElement>}
						className="ml-1 flex shrink-0 items-center"
						data-testid="html-style-panel-toolbar-end"
					/>
				) : null}

				{toggleSidebar ? (
					<Button
						data-testid="html-editor-dom-tree-toggle-button"
						variant={isSidebarOpen ? "secondary" : "ghost"}
						size="sm"
						className="ml-1 h-8 shrink-0 gap-1 px-2"
						onClick={toggleSidebar}
						aria-expanded={isSidebarOpen}
						aria-label={sidebarToggleLabel}
					>
						<PanelRight className="h-4 w-4" />
						<span>{sidebarToggleLabel}</span>
					</Button>
				) : null}
			</div>
		</TooltipProvider>
	)
})

FullStylePanel.displayName = "FullStylePanel"

/**
 * Rich text editor style toolbar component
 * Provides visual style editing interface similar to rich text editors
 */
export const StylePanel = observer(function StylePanel(props: StylePanelProps) {
	if (props.variant === "context") {
		return (
			<ContextStyleToolbar
				editorRef={props.editorRef}
				onStyleChange={props.onStyleChange}
				disabled={props.disabled}
				className={props.className}
				contextToolbarOpen={props.contextToolbarOpen}
				selectionRect={props.selectionRect}
				boundaryRef={props.boundaryRef}
				availableWidth={props.availableWidth}
				onRevealMoreStyles={props.onRevealMoreStyles}
			/>
		)
	}

	return <FullStylePanel {...props} />
})

StylePanel.displayName = "StylePanel"
