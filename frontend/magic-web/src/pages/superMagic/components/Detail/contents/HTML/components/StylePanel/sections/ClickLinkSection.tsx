import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn-ui/select"
import { usePPTLinkOptions } from "../../../contexts/PPTLinkContext"
import {
	findPPTSlideIndex,
	getPPTSlideHref,
} from "../../../../../components/PPTRender/utils/slideNavigation"
import { EditorSelectContent } from "../../EditorFloating"
import type { SelectedElementInfo } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"
import { AnchorSection } from "./AnchorSection"

interface ClickLinkSectionProps {
	selectedElement: SelectedElementInfo
	disabled?: boolean
	onUpdate: (attributes: Record<string, string | null>) => Promise<void>
}

export function ClickLinkSection({ selectedElement, disabled, onUpdate }: ClickLinkSectionProps) {
	const { t } = useTranslation("super")
	const ppt = usePPTLinkOptions()
	const hrefField = selectedElement.tagName.toLowerCase() === "a" ? "href" : "dataMagicHref"
	const href = selectedElement.attributes?.[hrefField] ?? ""
	const slideIndex = ppt ? findPPTSlideIndex(ppt.slides, ppt.currentSlidePath, href) : -1
	const [mode, setMode] = useState(slideIndex >= 0 ? "slide" : "url")
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		setMode(slideIndex >= 0 ? "slide" : "url")
		setFailed(false)
	}, [selectedElement.selector, href, slideIndex])

	async function update(attributes: Record<string, string | null>) {
		setPending(true)
		setFailed(false)
		try {
			await onUpdate(attributes)
		} catch {
			setFailed(true)
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="space-y-3" data-testid="style-panel-click-link-section">
			{ppt ? (
				<label className="block space-y-1">
					<span className={STYLE_PANEL_STYLES.label}>{t("stylePanel.linkType")}</span>
					<Select value={mode} onValueChange={setMode} disabled={disabled || pending}>
						<SelectTrigger aria-label={t("stylePanel.linkType")}>
							<SelectValue />
						</SelectTrigger>
						<EditorSelectContent>
							<SelectItem value="url">{t("stylePanel.linkTypeUrl")}</SelectItem>
							<SelectItem value="slide">{t("stylePanel.linkTypeSlide")}</SelectItem>
						</EditorSelectContent>
					</Select>
				</label>
			) : null}
			{mode === "slide" && ppt ? (
				<label className="block space-y-1">
					<span className={STYLE_PANEL_STYLES.label}>{t("stylePanel.linkSlide")}</span>
					<Select
						value={slideIndex >= 0 ? ppt.slides[slideIndex].path : ""}
						onValueChange={(path) =>
							void update({
								[hrefField]: getPPTSlideHref(ppt.currentSlidePath, path),
								target: null,
								download: null,
							})
						}
						disabled={disabled || pending}
					>
						<SelectTrigger aria-label={t("stylePanel.linkSlide")}>
							<SelectValue placeholder={t("stylePanel.linkSlidePlaceholder")} />
						</SelectTrigger>
						<EditorSelectContent>
							{ppt.slides.map((slide, index) => (
								<SelectItem key={slide.path} value={slide.path}>
									{t("stylePanel.linkSlideOption", {
										page: index + 1,
										title: slide.title || slide.path.split("/").pop(),
									})}
								</SelectItem>
							))}
						</EditorSelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">{t("stylePanel.linkSlideHint")}</p>
				</label>
			) : (
				<AnchorSection
					key={`${selectedElement.selector}:${failed}`}
					selectedElement={selectedElement}
					disabled={disabled || pending}
					onUpdate={update}
				/>
			)}
			{href ? (
				<Button
					variant="outline"
					size="sm"
					disabled={disabled || pending}
					onClick={() => void update({ [hrefField]: null })}
				>
					{t("stylePanel.linkRemove")}
				</Button>
			) : null}
			{failed ? (
				<p role="alert" className="text-xs text-destructive">
					{t("stylePanel.linkUpdateFailed")}
				</p>
			) : null}
		</div>
	)
}
