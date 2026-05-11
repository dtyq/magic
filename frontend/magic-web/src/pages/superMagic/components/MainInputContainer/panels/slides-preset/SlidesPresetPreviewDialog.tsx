import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import magicToast from "@/components/base/MagicToaster/utils"
import type { OptionItem } from "../types"
import { useLocaleText } from "../hooks/useLocaleText"
import { X } from "lucide-react"

interface SlidesPresetPreviewDialogProps {
	template: OptionItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSelect?: (template: OptionItem) => void
}

function SlidesPresetPreviewDialog({
	template,
	open,
	onOpenChange,
	onSelect,
}: SlidesPresetPreviewDialogProps) {
	const lt = useLocaleText()
	const { t } = useTranslation("crew/create")

	const previewUrl = template?.preview_url
	const title = lt(template?.preview_title) ?? lt(template?.label) ?? lt(template?.value) ?? ""
	const description = lt(template?.preview_description) ?? lt(template?.description)

	function handleSelect() {
		if (!template) return
		onSelect?.(template)
		magicToast.success(t("playbook.edit.presets.form.selectedTemplate", { name: title }))
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				data-testid="slides-preset-preview-dialog-content"
				className="h-[min(90vh,920px)] !max-w-[min(96vw,1440px)] grid-rows-[auto_minmax(0,1fr)] gap-2 p-5"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
					<div className="min-w-0 flex-1">
						<DialogTitle className="truncate text-base">{title}</DialogTitle>
						<DialogDescription
							className={description ? "mt-1 line-clamp-2" : "sr-only"}
						>
							{description ?? title}
						</DialogDescription>
					</div>
					<div className="flex shrink-0 items-center gap-4 pr-2">
						<Button
							type="button"
							size="sm"
							data-testid="slides-preset-preview-dialog-use-button"
							onClick={handleSelect}
						>
							{t("playbook.edit.presets.form.useTemplate")}
						</Button>
						<button
							type="button"
							aria-label="Close"
							onClick={() => onOpenChange(false)}
							className="rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<X className="size-5" />
						</button>
					</div>
				</DialogHeader>
				{previewUrl ? (
					<iframe
						data-testid="slides-preset-preview-dialog-iframe"
						title={title}
						src={previewUrl}
						className="size-full rounded-lg border border-border/60 bg-background shadow-sm"
						referrerPolicy="no-referrer"
						sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
						allowFullScreen
					/>
				) : null}
			</DialogContent>
		</Dialog>
	)
}

export default SlidesPresetPreviewDialog
