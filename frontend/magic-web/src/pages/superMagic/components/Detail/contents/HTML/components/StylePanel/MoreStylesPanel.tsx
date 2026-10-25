import { useCallback, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Textarea } from "@/components/shadcn-ui/textarea"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import { useSelectedElement } from "./hooks/useSelectedElement"
import { getElementCapabilities } from "./capabilities"
import { FontFamilySelector } from "./controls/FontFamilySelector"
import { MoreStylesTabs } from "./MoreStylesTabs"

export interface MoreStylesPanelProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled?: boolean
	onStyleChange?: (selector: string, property: string, value: string) => void
}

export const MoreStylesPanel = observer(function MoreStylesPanel({
	editorRef,
	disabled = false,
	onStyleChange: externalOnStyleChange,
}: MoreStylesPanelProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()
	const { selectedElement, updateStyle, updateBatchStyles, updateAttributes } =
		useSelectedElement(editorRef)
	const [fontFamily, setFontFamily] = useState("sans-serif")
	const [textContent, setTextContent] = useState("")
	const capabilities = getElementCapabilities(selectedElement)
	const hasSelection = selectedElement !== null || stylePanelStore.selectedElements.length > 0
	const isDisabled = !hasSelection || disabled

	useEffect(() => {
		if (selectedElement?.computedStyles) {
			setTextContent(selectedElement.textContent ?? "")
			const computedFontFamily = selectedElement.computedStyles.fontFamily
			if (computedFontFamily) {
				setFontFamily(computedFontFamily.split(",")[0].trim().replace(/['"]/g, ""))
			}
			return
		}
		setTextContent("")
	}, [selectedElement])

	const handleStyleChange = useCallback(
		async (property: string, value: string) => {
			if (selectedElement) {
				externalOnStyleChange?.(selectedElement.selector, property, value)
			}
			await updateStyle(property, value)
		},
		[externalOnStyleChange, selectedElement, updateStyle],
	)

	const handleBatchStyleChange = useCallback(
		async (styles: Record<string, string>) => {
			if (selectedElement) {
				for (const [property, value] of Object.entries(styles)) {
					externalOnStyleChange?.(selectedElement.selector, property, value)
				}
			}
			await updateBatchStyles(styles)
		},
		[externalOnStyleChange, selectedElement, updateBatchStyles],
	)

	const handleFontFamilyChange = useCallback(
		(newFontFamily: string) => {
			setFontFamily(newFontFamily)
			void handleStyleChange("fontFamily", newFontFamily)
		},
		[handleStyleChange],
	)

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

	if (!selectedElement) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground"
				data-testid="style-panel-more-styles-empty"
			>
				{t("stylePanel.sidebar.moreStylesEmpty")}
			</div>
		)
	}

	const textContentField = capabilities.showTypography ? (
		<div className="w-full min-w-0">
			<label className="mb-2 block text-xs font-medium text-muted-foreground">
				<span className="mb-1 block">{t("stylePanel.textContent")}</span>
				<Textarea
					data-testid="html-editor-text-content-input"
					value={textContent}
					onChange={(event) => setTextContent(event.target.value)}
					onBlur={(event) => void handleTextContentCommit(event.target.value)}
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
		<div className="h-full min-h-0 p-1.5" data-testid="style-panel-more-styles-panel">
			<MoreStylesTabs
				selectedElement={selectedElement}
				editorRef={editorRef}
				disabled={isDisabled}
				showTypography={capabilities.showTypography}
				showFlexGrid={capabilities.showFlexGrid}
				showImage={capabilities.showImage}
				showBackground={capabilities.showBackground}
				showBorder={capabilities.showBorder}
				showShadow={capabilities.showShadow}
				isLink={capabilities.isLink}
				fontFamilySelector={
					<FontFamilySelector
						value={fontFamily}
						onChange={handleFontFamilyChange}
						disabled={isDisabled}
					/>
				}
				textContentField={textContentField}
				onStyleChange={(property, value) => void handleStyleChange(property, value)}
				onBatchStyleChange={(styles) => void handleBatchStyleChange(styles)}
				onUpdateAttributes={updateAttributes}
			/>
		</div>
	)
})
