import { Loader2, Save, Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"

interface SlidesTemplatePreviewHeaderProps {
	isSaving: boolean
	onOpenSettings?: () => void
	onSaveToMyTemplates?: () => void
	title: string
}

export default function SlidesTemplatePreviewHeader({
	isSaving,
	onOpenSettings,
	onSaveToMyTemplates,
	title,
}: SlidesTemplatePreviewHeaderProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	return (
		<header
			className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-2.5 sm:h-[52px] sm:px-3"
			data-testid="slides-template-preview-header"
		>
			<div className="flex min-w-0 items-center gap-2">
				<h1
					className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base"
					data-testid="slides-template-preview-title"
					title={title}
				>
					{title}
				</h1>
				{onOpenSettings ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 shrink-0 rounded-lg transition-transform active:scale-[0.96]"
						aria-label={t("slidesTemplatePreview.settings.open")}
						onClick={onOpenSettings}
						data-testid="slides-template-preview-settings-button"
					>
						<Settings2 className="size-4" aria-hidden="true" />
					</Button>
				) : null}
			</div>

			{onSaveToMyTemplates ? (
				<Button
					type="button"
					size="sm"
					className="h-8 shrink-0 gap-1.5 rounded-lg px-3 transition-transform active:scale-[0.96] sm:h-9 sm:px-3.5"
					aria-label={t("slidesTemplatePreview.save.fullLabel")}
					disabled={isSaving}
					onClick={onSaveToMyTemplates}
					data-testid="slides-template-preview-save-button"
				>
					{isSaving ? (
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
					) : (
						<Save className="size-4" aria-hidden="true" />
					)}
					<span>
						{isMobile
							? t("slidesTemplatePreview.save.mobileLabel")
							: t("slidesTemplatePreview.save.fullLabel")}
					</span>
				</Button>
			) : null}
		</header>
	)
}
