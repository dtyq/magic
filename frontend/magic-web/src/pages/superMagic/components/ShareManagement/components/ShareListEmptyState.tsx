import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { SharedResourceType } from "../types"
import { IconShare3 } from "@tabler/icons-react"

interface ShareListEmptyStateProps {
	resourceType: SharedResourceType
}

function ShareListEmptyState({ resourceType }: ShareListEmptyStateProps) {
	const { t } = useTranslation("super")

	// 根据资源类型获取对应的空状态文案
	const getEmptyText = () => {
		switch (resourceType) {
			case SharedResourceType.Project:
				return t("shareManagement.emptyProjectShare")
			case SharedResourceType.File:
				return t("shareManagement.emptyFileShare")
			case SharedResourceType.Topic:
				return t("shareManagement.emptyTopicShare")
			default:
				return t("shareManagement.emptyProjectShare")
		}
	}

	return (
		<Empty className="flex h-full items-center justify-center border border-dashed border-border p-6">
			<EmptyHeader>
				<EmptyMedia
					variant="icon"
					className="size-12 border border-border bg-transparent p-2"
				>
					<IconShare3 size={24} />
				</EmptyMedia>
				<EmptyTitle>{getEmptyText()}</EmptyTitle>
				<EmptyDescription>{t("shareManagement.emptyShareDescription")}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export default memo(ShareListEmptyState)
