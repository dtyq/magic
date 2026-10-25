import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "@/components/shadcn-ui/empty"
import { Button } from "@/components/shadcn-ui/button"
import { DetailEmptyIcon } from "./DetailEmptyIcon"

export default memo(function DetailEmpty({
	title,
	onRetry,
}: { title?: string; onRetry?: () => void } = {}) {
	const { t } = useTranslation("super")

	return (
		<Empty className="h-full w-full">
			<EmptyHeader className="gap-1">
				<EmptyMedia variant="default" className="-mb-1">
					<DetailEmptyIcon />
				</EmptyMedia>
				<EmptyTitle className="text-base font-semibold text-gray-900">
					{title ?? t("detail.emptyState.title")}
				</EmptyTitle>
				{!title && (
					<EmptyDescription className="text-sm text-gray-500">
						{t("detail.emptyState.description")}
					</EmptyDescription>
				)}
				{onRetry && (
					<Button variant="outline" onClick={onRetry}>
						{t("common.retry")}
					</Button>
				)}
			</EmptyHeader>
		</Empty>
	)
})
