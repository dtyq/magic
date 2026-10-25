import { FileQuestion } from "lucide-react"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { useTranslation } from "react-i18next"

export default function NotFoundPage() {
	const { t } = useTranslation()

	return (
		<EmptyState
			icon={FileQuestion}
			testId="not-found-empty"
			title={t("notFound.title")}
			description={t("notFound.description")}
			className="min-h-[calc(100svh-7rem)]"
		/>
	)
}
