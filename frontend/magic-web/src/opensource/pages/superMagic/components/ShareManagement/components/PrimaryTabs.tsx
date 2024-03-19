import { memo, useMemo } from "react"
import { IconMessageCircle, IconFiles, IconFolder } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SmoothTabs } from "@/opensource/components/shadcn-ui/smooth-tabs"
import { SharedResourceType } from "../types"
import { cn } from "@/opensource/lib/utils"

interface PrimaryTabsProps {
	value: SharedResourceType
	onChange: (value: SharedResourceType) => void
	className?: string
}

function PrimaryTabs({ value, onChange, className }: PrimaryTabsProps) {
	const { t } = useTranslation("super")

	const tabs = useMemo(
		() => [
			{
				value: SharedResourceType.Project,
				label: t("shareManagement.projectShare"),
				icon: <IconFolder size={16} />,
			},
			{
				value: SharedResourceType.File,
				label: t("shareManagement.fileShare"),
				icon: <IconFiles size={16} />,
			},
			{
				value: SharedResourceType.Topic,
				label: t("shareManagement.topicShare"),
				icon: <IconMessageCircle size={16} />,
			},
		],
		[t],
	)

	return (
		<SmoothTabs<SharedResourceType>
			tabs={tabs}
			value={value}
			onChange={onChange}
			className={cn("h-10", className)}
		/>
	)
}

export default memo(PrimaryTabs)
