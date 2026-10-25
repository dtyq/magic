import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import SlidesTemplatePanelContent from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/SlidesTemplatePanelContent"
import { useSlidesTemplatePanelState } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/useSlidesTemplatePanelState"
import type { SlidesTemplateReplacementTarget } from "@/pages/superMagic/utils/slidesTemplateReplacementActions"
import SlidesTemplateSelectionDialog from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/SlidesTemplateSelectionDialog"

interface SlidesTemplateReplacementDialogProps {
	open: boolean
	target: SlidesTemplateReplacementTarget | null
	onOpenChange: (open: boolean) => void
	onConfirm: (template: OptionItem, target: SlidesTemplateReplacementTarget) => void
}

export default function SlidesTemplateReplacementDialog({
	open,
	target,
	onOpenChange,
	onConfirm,
}: SlidesTemplateReplacementDialogProps) {
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const [selectedTemplate, setSelectedTemplate] = useState<OptionItem | null>(null)
	const slidesState = useSlidesTemplatePanelState()

	if (!target) return null

	const scopeText =
		target.scope === "deck"
			? t("ppt.templateReplacement.scopeDeck")
			: t("ppt.templateReplacement.scopeSlide", { page: target.slideIndex + 1 })

	return (
		<SlidesTemplateSelectionDialog
			open={open}
			title={t("ppt.templateReplacement.title")}
			description={scopeText}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) setSelectedTemplate(null)
				onOpenChange(nextOpen)
			}}
			footer={
				<>
					<div className="mr-auto min-w-0 text-sm text-muted-foreground">
						{selectedTemplate
							? t("ppt.templateReplacement.selected", {
									name:
										lt(selectedTemplate.label) ||
										lt(selectedTemplate.value) ||
										"",
								})
							: t("ppt.templateReplacement.selectHint")}
					</div>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button
						disabled={!selectedTemplate}
						onClick={() => {
							if (!selectedTemplate) return
							onConfirm(selectedTemplate, target)
							setSelectedTemplate(null)
						}}
					>
						{t("ppt.templateReplacement.confirm")}
					</Button>
				</>
			}
		>
			<SlidesTemplatePanelContent
				slidesState={slidesState}
				selectedTemplate={selectedTemplate}
				onTemplateClick={setSelectedTemplate}
				className="h-full"
				// The dialog shell provides the inset; match the other picker without doubling it.
				toolbarClassName="sticky top-0 z-20 bg-background/95 px-0 pb-3 pt-0 backdrop-blur"
				gridClassName="min-h-0 flex-1 p-0 pt-1 ![grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]"
				showMyTemplates
				enableMyTemplateRemoval
			/>
		</SlidesTemplateSelectionDialog>
	)
}
