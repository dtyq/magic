import { Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

interface ResearchStateViewProps {
	status: "loading" | "error"
	onRetry?: () => void
}

/** Full-page loading and error states for the research routes. */
export default function ResearchStateView({ status, onRetry }: ResearchStateViewProps) {
	const { t } = useTranslation("personaResearch")

	if (status === "loading") {
		return (
			<div className="flex h-full w-full items-center justify-center bg-background">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
			<p className="text-sm text-muted-foreground">{t("state.loadFailed")}</p>
			{onRetry ? (
				<Button variant="outline" size="sm" onClick={onRetry}>
					<RotateCw className="size-4" />
					{t("state.retry")}
				</Button>
			) : null}
		</div>
	)
}
