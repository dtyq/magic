import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import type { SelectedElementInfo } from "./types"
import { resolveMoreStylesTab } from "./utils/moreStylesTab"
import BoxModelSection from "./sections/BoxModelSection"
import FlexGridSection from "./sections/FlexGridSection"
import ImageSection from "./sections/ImageSection"
import { ClickLinkSection } from "./sections/ClickLinkSection"
import BackgroundSection from "./sections/BackgroundSection"
import BorderSection from "./sections/BorderSection"
import ShadowSection from "./sections/ShadowSection"
import { CustomCSSSection } from "./sections/CustomCSSSection"

export interface MoreStylesTabsProps {
	selectedElement: SelectedElementInfo | null
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled: boolean
	showTypography: boolean
	showFlexGrid: boolean
	showImage: boolean
	showBackground: boolean
	showBorder: boolean
	showShadow: boolean
	isLink: boolean
	fontFamilySelector: ReactNode
	textContentField: ReactNode
	onStyleChange: (property: string, value: string) => void
	onBatchStyleChange: (styles: Record<string, string>) => void
	onUpdateAttributes: (attributes: Record<string, string | null>) => Promise<void>
}

export const MoreStylesTabs = observer(function MoreStylesTabs({
	selectedElement,
	editorRef,
	disabled,
	showTypography,
	showFlexGrid,
	showImage,
	showBackground,
	showBorder,
	showShadow,
	isLink,
	fontFamilySelector,
	textContentField,
	onStyleChange,
	onBatchStyleChange,
	onUpdateAttributes,
}: MoreStylesTabsProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()
	const firstTab =
		showTypography || isLink
			? "text"
			: showImage
				? "image"
				: showBackground
					? "background"
					: showBorder
						? "border"
						: showShadow
							? "shadow"
							: "layout"
	const tabs = [
		...(showTypography || isLink ? [{ value: "text", label: t("stylePanel.text") }] : []),
		...(showBackground ? [{ value: "background", label: t("stylePanel.background") }] : []),
		...(showBorder ? [{ value: "border", label: t("stylePanel.border") }] : []),
		...(showShadow ? [{ value: "shadow", label: t("stylePanel.shadow") }] : []),
		...(showImage ? [{ value: "image", label: t("stylePanel.imageSettings") }] : []),
		{ value: "link", label: t("stylePanel.clickLink") },
		{ value: "layout", label: t("stylePanel.layout") },
		{ value: "advanced", label: t("stylePanel.customCSS.title") },
	]
	const availableTabs = tabs.map((item) => item.value)
	const selector = selectedElement?.selector
	const resolvedTab = resolveMoreStylesTab(
		selector ? stylePanelStore.getMoreStylesTab(selector) : undefined,
		firstTab,
		availableTabs,
	)
	const [tab, setTab] = useState(resolvedTab)

	useEffect(() => {
		setTab(resolvedTab)
	}, [resolvedTab])

	function handleTabChange(value: string) {
		setTab(value)
		if (selector) stylePanelStore.rememberMoreStylesTab(selector, value)
	}

	return (
		<Tabs
			value={tab}
			onValueChange={handleTabChange}
			className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5"
			data-testid="style-panel-more-styles-content"
		>
			<TabsList
				className="flex h-auto min-h-7 w-max max-w-full flex-wrap justify-start gap-0.5 rounded-md bg-muted/60 p-0.5"
				data-testid="style-panel-more-tabs-list"
			>
				{tabs.map((item) => (
					<TabsTrigger
						key={item.value}
						value={item.value}
						className="h-6 flex-none shrink-0 px-2 text-[11px]"
						data-testid={`style-panel-more-${item.value}-tab`}
					>
						{item.label}
					</TabsTrigger>
				))}
			</TabsList>
			<div className="min-h-0 min-w-0 overflow-hidden">
				<ScrollArea
					type="auto"
					className="h-full max-h-full min-h-0"
					viewportClassName="h-full min-h-0 overflow-y-auto pr-4"
					data-testid="style-panel-more-content-scroll-area"
				>
					<TabsContent
						value="text"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-text"
					>
						{fontFamilySelector}
						{textContentField}
					</TabsContent>
					<TabsContent
						value="link"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-link"
					>
						{selectedElement ? (
							<ClickLinkSection
								key={selectedElement.selector}
								selectedElement={selectedElement}
								disabled={disabled}
								onUpdate={onUpdateAttributes}
							/>
						) : null}
					</TabsContent>
					<TabsContent
						value="layout"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-layout"
					>
						<BoxModelSection
							selectedElement={selectedElement}
							editorRef={editorRef}
							onStyleChange={onStyleChange}
						/>
						{showFlexGrid ? (
							<FlexGridSection
								selectedElement={selectedElement}
								editorRef={editorRef}
								onStyleChange={onStyleChange}
							/>
						) : null}
					</TabsContent>
					<TabsContent
						value="background"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-background"
					>
						<BackgroundSection
							selectedElement={selectedElement}
							editorRef={editorRef}
							onStyleChange={onStyleChange}
						/>
					</TabsContent>
					<TabsContent
						value="border"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-border"
					>
						<BorderSection
							selectedElement={selectedElement}
							editorRef={editorRef}
							onStyleChange={onStyleChange}
						/>
					</TabsContent>
					<TabsContent
						value="shadow"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-shadow"
					>
						<ShadowSection
							selectedElement={selectedElement}
							editorRef={editorRef}
							onStyleChange={onStyleChange}
						/>
					</TabsContent>
					<TabsContent
						value="image"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-image"
					>
						<ImageSection
							selectedElement={selectedElement}
							editorRef={editorRef}
							onStyleChange={onStyleChange}
						/>
					</TabsContent>
					<TabsContent
						value="advanced"
						className="mt-0 space-y-2"
						data-testid="style-panel-more-advanced"
					>
						<CustomCSSSection
							selectedElement={selectedElement}
							disabled={disabled}
							onApply={onBatchStyleChange}
						/>
					</TabsContent>
				</ScrollArea>
			</div>
		</Tabs>
	)
})
