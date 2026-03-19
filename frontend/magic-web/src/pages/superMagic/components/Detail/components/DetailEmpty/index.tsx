import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "@/components/shadcn-ui/empty"
import { DetailEmptyIcon } from "./DetailEmptyIcon"

export default memo(function DetailEmpty() {
	const { t } = useTranslation("super")

	return (
		<Empty className="h-full w-full">
			<EmptyHeader className="gap-1">
				<EmptyMedia variant="default" className="-mb-1">
					<DetailEmptyIcon />
				</EmptyMedia>
				<EmptyTitle className="text-base font-semibold text-gray-900">
					{t("detail.emptyState.title")}
				</EmptyTitle>
				<EmptyDescription className="text-sm text-gray-500">
					{t("detail.emptyState.description")}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
})
