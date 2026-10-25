import { ChevronLeft, ChevronRight, ImagePlus } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"
import { TemplateEditorPreviewImages } from "@magic-admin-v2/features/platform-slides-template/components/template-editor-preview-images"

type TemplateEditorPreviewProps = {
	isDetailReady: boolean
	onPreviewImagesChange: (keys: string[], urls: string[]) => void
	onPreviewIndexChange: Dispatch<SetStateAction<number>>
	onUploadPreviews: (files: File[]) => void
	previewImageFileKeys: string[]
	previewImageUrls: string[]
	previewIndex: number
	previewUrls: string[]
}

/** 模板编辑器左侧预览区域，包含主图切换和预览图管理。 */
export function TemplateEditorPreview({
	isDetailReady,
	onPreviewImagesChange,
	onPreviewIndexChange,
	onUploadPreviews,
	previewImageFileKeys,
	previewImageUrls,
	previewIndex,
	previewUrls,
}: TemplateEditorPreviewProps) {
	const { t } = useTranslation()

	return (
		<section
			className={cn(
				"border-b bg-muted/20 p-6 lg:border-b-0 lg:border-r",
				!isDetailReady && "pointer-events-none invisible",
			)}
		>
			<div className="sticky top-0 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold">{t("slidesTemplate.editor.templatePreview")}</h3>
					{previewUrls.length > 0 ? (
						<Badge variant="outline">
							{Math.min(previewIndex + 1, previewUrls.length)} / {previewUrls.length}
						</Badge>
					) : null}
				</div>
				<div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm">
					{previewUrls[previewIndex] ? (
						<img
							alt={t("slidesTemplate.aria.templatePreview")}
							className="size-full object-contain"
							src={previewUrls[previewIndex]}
						/>
					) : (
						<div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
							<ImagePlus className="size-8" />
							{t("slidesTemplate.form.noPreview")}
						</div>
					)}
				</div>
				<div className="flex items-center justify-between">
					<Button
						disabled={previewIndex <= 0}
						onClick={() => onPreviewIndexChange((index) => index - 1)}
						size="sm"
						variant="outline"
					 data-testid="platform-slides-template-edit-button">
						<ChevronLeft className="mr-1 size-4" />
						{t("slidesTemplate.form.previous")}
					</Button>
					<Button
						disabled={previewIndex >= previewUrls.length - 1}
						onClick={() => onPreviewIndexChange((index) => index + 1)}
						size="sm"
						variant="outline"
					 data-testid="platform-slides-template-edit-button">
						{t("slidesTemplate.form.next")}
						<ChevronRight className="ml-1 size-4" />
					</Button>
				</div>
				<TemplateEditorPreviewImages
					keys={previewImageFileKeys}
					onChange={onPreviewImagesChange}
					onUpload={onUploadPreviews}
					urls={previewImageUrls}
				/>
			</div>
		</section>
	)
}
