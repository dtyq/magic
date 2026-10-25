import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface AiCanvasDocumentStatusProps {
	isCreating: boolean
	onRetry: () => void
}

/**
 * Detail-panel placeholder while an AI canvas project has no canvas yet: either the default
 * canvas is being created, or creation failed and the user can retry it.
 */
function AiCanvasDocumentStatus({ isCreating, onRetry }: AiCanvasDocumentStatusProps) {
	const { t } = useTranslation("aiCanvas")

	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background text-sm text-muted-foreground"
			data-testid="ai-canvas-document-status"
		>
			{isCreating ? (
				<>
					<Loader2 size={16} className="animate-spin" aria-hidden="true" />
					<span>{t("project.preparingCanvas")}</span>
				</>
			) : (
				<>
					<span>{t("project.canvasCreateFailed")}</span>
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCw size={16} aria-hidden="true" />
						{t("project.retry")}
					</Button>
				</>
			)}
		</div>
	)
}

export default memo(AiCanvasDocumentStatus)
