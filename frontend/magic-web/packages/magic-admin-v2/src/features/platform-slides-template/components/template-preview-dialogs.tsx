import { FileImage } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import type { SlidesTemplate } from "@magic-admin-v2/features/platform-slides-template/types"
import { resolveSlidesTemplateTitle } from "@magic-admin-v2/features/platform-slides-template/utils"

type TemplatePreviewDialogProps = {
	onOpenChange: (open: boolean) => void
	open: boolean
	template: SlidesTemplate | null
}

export function TemplatePreviewDialog({
	onOpenChange,
	open,
	template,
}: TemplatePreviewDialogProps) {
	const { t } = useTranslation()
	const [index, setIndex] = useState(0)
	const urls = template?.preview_image_urls?.length
		? template.preview_image_urls
		: [template?.thumbnail_url, template?.collage_url].filter((url): url is string =>
				Boolean(url),
			)

	useEffect(() => setIndex(0), [template?.id])

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-4xl" data-testid="platform-slides-template-dialog-content" closeButtonTestId="template-preview-dialogs-close-button">
				<DialogHeader>
					<DialogTitle>
						{template
							? resolveSlidesTemplateTitle(template)
							: t("slidesTemplate.preview")}
					</DialogTitle>
					<DialogDescription>{template?.code}</DialogDescription>
				</DialogHeader>
				<div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
					{urls[index] ? (
						<img
							alt={t("slidesTemplate.aria.templatePreview")}
							className="size-full object-contain"
							src={urls[index]}
						/>
					) : (
						<EmptyState icon={FileImage} title={t("slidesTemplate.form.noPreview")} testId="platform-slides-template-empty" />
					)}
				</div>
				<DialogFooter className="items-center sm:justify-between">
					<span className="text-sm text-muted-foreground">
						{urls.length > 0 ? `${index + 1} / ${urls.length}` : "0 / 0"}
					</span>
					<div className="flex gap-2">
						<Button
							disabled={index <= 0}
							onClick={() => setIndex((value) => value - 1)}
							variant="outline"
						 data-testid="platform-slides-template-view-button">
							{t("slidesTemplate.form.previous")}
						</Button>
						<Button
							disabled={index >= urls.length - 1}
							onClick={() => setIndex((value) => value + 1)}
							variant="outline"
						 data-testid="platform-slides-template-view-button">
							{t("slidesTemplate.form.next")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export function CoverPreviewDialog({
	onOpenChange,
	open,
	template,
}: TemplatePreviewDialogProps) {
	const { t } = useTranslation()

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-4xl" data-testid="platform-slides-template-dialog-content" closeButtonTestId="template-preview-dialogs-close-button">
				<DialogHeader>
					<DialogTitle>
						{template
							? resolveSlidesTemplateTitle(template)
							: t("slidesTemplate.cover")}
					</DialogTitle>
					<DialogDescription>{template?.code}</DialogDescription>
				</DialogHeader>
				<div className="flex max-h-[70vh] min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
					{template?.thumbnail_url ? (
						<img
							alt={resolveSlidesTemplateTitle(template)}
							className="max-h-[70vh] max-w-full object-contain"
							src={template.thumbnail_url}
						/>
					) : (
						<EmptyState icon={FileImage} title={t("slidesTemplate.form.noPreview")} testId="platform-slides-template-empty" />
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
