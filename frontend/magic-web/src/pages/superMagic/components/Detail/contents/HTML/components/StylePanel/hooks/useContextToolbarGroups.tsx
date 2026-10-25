import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link2 } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { STYLE_PANEL_STYLES } from "../styles"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ElementCapabilities } from "../capabilities"
import type { ContextToolbarItemMotion, SelectedElementInfo } from "../types"
import { getMetricControlWidth } from "../controls/metricControlWidth"
import {
	CONTEXT_TOOLBAR_ACTIONS_WIDTH,
	CONTEXT_TOOLBAR_FORMATTING_WIDTH,
	CONTEXT_TOOLBAR_ITEM_GAP,
	CONTEXT_TOOLBAR_MORE_WIDTH,
	getContextToolbarTypographyUnits,
	getContextToolbarTypographyWidth,
	type ContextToolGroup,
	type ContextToolItem,
} from "../utils/contextToolbarPartition"
import {
	BackgroundImageButton,
	ColorPicker,
	ElementActions,
	FontSizeAdjuster,
	FontSizeSelector,
	LineHeightSelector,
	TextAlignTools,
	TextFormatTools,
} from "../controls"

export interface UseContextToolbarGroupsParams {
	capabilities: ElementCapabilities
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled: boolean
	isDisabled: boolean
	selectedElement: SelectedElementInfo | null
	fontSize: string
	setFontSize: (size: string) => void
	handleFontSizeApply: (size: string) => void
	handleFontSizeAdjust: (direction: "increase" | "decrease") => Promise<void>
	lineHeight: string
	setLineHeight: (lh: string) => void
	handleLineHeightApply: (lh: string) => void
	isBold: boolean
	isItalic: boolean
	hasUnderline: boolean
	hasLineThrough: boolean
	handleFormat: (property: string, value: string) => void
	showAlignmentTools: boolean
	flexAlignment: { value: string; direction: string; targetSelector: string } | null
	textAlign: "left" | "center" | "right" | "justify"
	handleAlignment: (align: "left" | "center" | "right" | "justify") => void
	currentColor: string
	handleStyleChange: (property: string, value: string) => Promise<void>
	showBackgroundImageAction: boolean
	contextMorePopover: ReactNode
	onRevealLinkSettings?: () => void
	renderContextToolbarItem: ContextToolbarItemMotion
}

export function useContextToolbarGroups({
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
	onRevealLinkSettings,
	renderContextToolbarItem,
}: UseContextToolbarGroupsParams): ContextToolGroup<{ node: ReactNode }>[] {
	const { t } = useTranslation("super")
	return useMemo<ContextToolGroup<{ node: ReactNode }>[]>(() => {
		const list: ContextToolGroup<{ node: ReactNode }>[] = []

		// 1. Actions group
		list.push({
			id: "actions",
			estimatedWidth: CONTEXT_TOOLBAR_ACTIONS_WIDTH,
			data: {
				node: (
					<ElementActions
						editorRef={editorRef}
						disabled={disabled}
						itemMotion={renderContextToolbarItem}
					/>
				),
			},
		})

		list.push({
			id: "link",
			estimatedWidth: 28,
			data: {
				node: renderContextToolbarItem(
					<MagicTooltip title={t("stylePanel.clickLink")}>
						<Button
							variant="ghost"
							size="icon"
							className={STYLE_PANEL_STYLES.iconButton}
							disabled={isDisabled || !selectedElement || !onRevealLinkSettings}
							aria-label={t("stylePanel.clickLink")}
							onClick={onRevealLinkSettings}
						>
							<Link2 className="h-4 w-4" />
						</Button>
					</MagicTooltip>,
					"link",
				),
			},
		})

		// 2. Typography sizes group (fontSize, adjuster, lineHeight)
		if (capabilities.showTypography || capabilities.showFontSizeAdjuster) {
			const typographyItems: ContextToolItem<{ node: ReactNode }>[] = []
			const fontSizeNode = capabilities.showFontSize
				? renderContextToolbarItem(
						<FontSizeSelector
							key="fontSize"
							value={fontSize}
							onChange={setFontSize}
							onApply={handleFontSizeApply}
							disabled={isDisabled}
							className="max-w-[220px] shrink-0"
						/>,
						"fontSize",
					)
				: null
			const fontAdjusterNode = capabilities.showFontSizeAdjuster ? (
				<FontSizeAdjuster
					key="fontAdjuster"
					onAdjust={handleFontSizeAdjust}
					disabled={isDisabled}
					itemMotion={renderContextToolbarItem}
				/>
			) : null

			if (fontSizeNode || fontAdjusterNode) {
				const fontSizeUnit = getContextToolbarTypographyUnits({
					fontSize: capabilities.showFontSize ? fontSize : undefined,
					showAdjuster: capabilities.showFontSizeAdjuster,
				})[0]
				typographyItems.push({
					id: "fontSize",
					estimatedWidth: fontSizeUnit?.estimatedWidth ?? 0,
					data: {
						node: (
							<div className="flex items-center gap-1">
								{fontSizeNode}
								{fontAdjusterNode}
							</div>
						),
					},
				})
			}

			if (capabilities.showTypography) {
				typographyItems.push({
					id: "lineHeight",
					estimatedWidth: getMetricControlWidth(lineHeight),
					data: {
						node: renderContextToolbarItem(
							<LineHeightSelector
								key="lineHeight"
								value={lineHeight}
								fontSize={fontSize}
								onChange={setLineHeight}
								onApply={handleLineHeightApply}
								disabled={isDisabled}
								className="max-w-[220px] shrink-0"
							/>,
							"lineHeight",
						),
					},
				})
			}

			list.push({
				id: "typography",
				estimatedWidth: getContextToolbarTypographyWidth({
					fontSize: capabilities.showFontSize ? fontSize : undefined,
					lineHeight: capabilities.showTypography ? lineHeight : undefined,
					showAdjuster: capabilities.showFontSizeAdjuster,
				}),
				items: typographyItems,
			})
		}

		// 3. Formatting tools
		if (capabilities.showTypography) {
			list.push({
				id: "formatting",
				estimatedWidth: CONTEXT_TOOLBAR_FORMATTING_WIDTH,
				data: {
					node: (
						<TextFormatTools
							isBold={isBold}
							isItalic={isItalic}
							hasUnderline={hasUnderline}
							hasLineThrough={hasLineThrough}
							onFormat={handleFormat}
							disabled={isDisabled}
							itemMotion={renderContextToolbarItem}
						/>
					),
				},
			})
		}

		// 4. Alignment tools
		if (showAlignmentTools) {
			list.push({
				id: "alignment",
				estimatedWidth: 96,
				data: {
					node: (
						<TextAlignTools
							value={flexAlignment?.value || textAlign}
							onAlign={handleAlignment}
							mode={flexAlignment ? "flex" : "text"}
							flexDirection={flexAlignment?.direction}
							disabled={isDisabled}
							compact
							itemMotion={renderContextToolbarItem}
						/>
					),
				},
			})
		}

		// 5. Appearance tools (Color + Background Image)
		if (capabilities.showTypography || showBackgroundImageAction) {
			const appearanceItems: ContextToolItem<{ node: ReactNode }>[] = []

			if (capabilities.showTypography) {
				appearanceItems.push({
					id: "color",
					estimatedWidth: 32,
					data: {
						node: renderContextToolbarItem(
							<ColorPicker
								key="color"
								value={currentColor}
								onChangeComplete={(value) => handleStyleChange("color", value)}
								disabled={isDisabled}
							/>,
							"color",
						),
					},
				})
			}

			if (showBackgroundImageAction) {
				appearanceItems.push({
					id: "bgImage",
					estimatedWidth: 32,
					data: {
						node: (
							<BackgroundImageButton
								key="bgImage"
								selectedElement={selectedElement}
								editorRef={editorRef}
								disabled={isDisabled}
								itemMotion={renderContextToolbarItem}
							/>
						),
					},
				})
			}

			list.push({
				id: "appearance",
				estimatedWidth:
					appearanceItems.reduce((sum, item) => sum + item.estimatedWidth, 0) +
					Math.max(0, appearanceItems.length - 1) * CONTEXT_TOOLBAR_ITEM_GAP,
				items: appearanceItems,
			})
		}

		// 6. More styles entry
		list.push({
			id: "more",
			estimatedWidth: CONTEXT_TOOLBAR_MORE_WIDTH,
			data: {
				node: renderContextToolbarItem(contextMorePopover),
			},
		})

		return list
	}, [
		capabilities.showFontSize,
		capabilities.showFontSizeAdjuster,
		capabilities.showTypography,
		contextMorePopover,
		onRevealLinkSettings,
		t,
		currentColor,
		disabled,
		editorRef,
		flexAlignment,
		fontSize,
		handleAlignment,
		handleFontSizeAdjust,
		handleFontSizeApply,
		handleFormat,
		handleLineHeightApply,
		handleStyleChange,
		hasLineThrough,
		hasUnderline,
		isBold,
		isDisabled,
		isItalic,
		lineHeight,
		renderContextToolbarItem,
		selectedElement,
		setFontSize,
		setLineHeight,
		showAlignmentTools,
		showBackgroundImageAction,
		textAlign,
	])
}
