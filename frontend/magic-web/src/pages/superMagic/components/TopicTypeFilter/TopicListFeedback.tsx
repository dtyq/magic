import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

export default function TopicListFeedback({
	error,
	onRetry,
}: {
	error?: Error | null
	onRetry?: () => void
}) {
	const { t } = useTranslation("super")
	return (
		<div
			className="flex flex-col items-center gap-2 p-4 text-sm text-muted-foreground"
			role={error ? "alert" : "status"}
		>
			<span>{error ? t("topicTypeFilter.failed") : t("topicTypeFilter.empty")}</span>
			{error && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					{t("topicTypeFilter.retry")}
				</Button>
			)}
		</div>
	)
}
